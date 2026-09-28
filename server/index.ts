import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import postgres from "postgres";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type JsonObject = Record<string, unknown>;

const DEFAULT_ADMIN = {
  id: "admin-1",
  username: "admin123",
  displayName: "DatscoGo Administrator",
  role: "admin",
  passwordHash:
    "f23f36eba2232bf1ca13855cb58386c1fbe29e884bc2ce0a646db4d60656c204",
  active: true,
};

const EMPTY_PUBLIC_STATE = {
  routes: [],
  schedules: [],
  terminals: [],
  announcements: [],
  contact: { facebook: "", phone: "", email: "" },
};

function validObject(value: unknown): value is JsonObject {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

const NO_MOVEMENT_THRESHOLD_MS = 30 * 60 * 1000;
const SAFETY_RESPONSE_WINDOW_MS = 10 * 1000;
const MOVEMENT_DISTANCE_METERS = 25;

function numericValue(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const earthRadiusMeters = 6_371_000;
  const deltaLatitude = toRadians(lat2 - lat1);
  const deltaLongitude = toRadians(lon2 - lon1);
  const a = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2))
    * Math.sin(deltaLongitude / 2) ** 2;
  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function withoutUndefined(value: JsonObject) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

async function startServer() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is required. DatscoGo now stores shared data in PostgreSQL."
    );
  }

  // PostgreSQL connection.
  // SSL is required by the connected hosted PostgreSQL database.
  const sql = postgres(process.env.DATABASE_URL, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 15,
    ssl: "require",
  });

  // JSONB keeps the frontend's existing data shape exactly the same,
  // so the PostgreSQL upgrade does not require UI/layout changes.
  await sql`
    CREATE TABLE IF NOT EXISTS datscogo_app_state (
      state_key TEXT PRIMARY KEY,
      state_value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS datscogo_live_trips (
      driver_id TEXT PRIMARY KEY,
      trip_value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;


  await sql`
    CREATE TABLE IF NOT EXISTS datscogo_hidden_live_trips (
      driver_id TEXT PRIMARY KEY,
      trip_id TEXT NOT NULL,
      hidden_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS datscogo_announcement_images (
      announcement_id TEXT PRIMARY KEY,
      content_type TEXT NOT NULL,
      image_data BYTEA NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS datscogo_trip_history (
      trip_id TEXT PRIMARY KEY,
      driver_id TEXT NOT NULL,
      route_id TEXT NOT NULL,
      trip_value JSONB NOT NULL,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      arrived_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Preserve any completed live trips that existed before trip history was added.
  await sql`
    INSERT INTO datscogo_trip_history (trip_id, driver_id, route_id, trip_value, started_at, arrived_at, updated_at)
    SELECT
      trip_value->>'id',
      driver_id,
      trip_value->>'routeId',
      trip_value,
      COALESCE(
        to_timestamp(NULLIF(trip_value->>'startedAt', '')::double precision / 1000.0),
        updated_at
      ),
      COALESCE(
        to_timestamp(NULLIF(trip_value->>'arrivedAt', '')::double precision / 1000.0),
        updated_at
      ),
      updated_at
    FROM datscogo_live_trips
    WHERE trip_value->>'status' = 'arrived'
      AND COALESCE(trip_value->>'id', '') <> ''
      AND COALESCE(trip_value->>'routeId', '') <> ''
    ON CONFLICT (trip_id) DO NOTHING
  `;

  await sql`
    INSERT INTO datscogo_app_state (state_key, state_value)
    VALUES ('public-state', ${sql.json(EMPTY_PUBLIC_STATE)})
    ON CONFLICT (state_key) DO NOTHING
  `;

  await sql`
    INSERT INTO datscogo_app_state (state_key, state_value)
    VALUES ('accounts', ${sql.json([DEFAULT_ADMIN])})
    ON CONFLICT (state_key) DO NOTHING
  `;

  const app = express();
  const server = createServer(app);

  app.use(express.json({ limit: "6mb" }));

  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self' https://*.openstreetmap.org https://cdnjs.cloudflare.com https://images.unsplash.com https://*.tile.openstreetmap.org https://www.google.com; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com; img-src 'self' data: https: http:; connect-src 'self' https://*.openstreetmap.org https://router.project-osrm.org;"
    );

    next();
  });

  // --------------------------------------------------
  // HEALTH CHECK
  // --------------------------------------------------

  app.get("/api/health", async (_req, res) => {
    try {
      await sql`SELECT 1`;

      res.json({
        ok: true,
        storage: "postgresql",
      });
    } catch (error) {
      console.error("PostgreSQL health check failed:", error);

      res.status(503).json({
        ok: false,
        storage: "postgresql",
      });
    }
  });

  // --------------------------------------------------
  // SHARED PUBLIC DATA
  // --------------------------------------------------

  app.get("/api/public-state", async (_req, res) => {
    try {
      const rows = await sql`
        SELECT state_value
        FROM datscogo_app_state
        WHERE state_key = 'public-state'
        LIMIT 1
      `;

      res.setHeader("Cache-Control", "no-store");

      res.json(rows[0]?.state_value ?? EMPTY_PUBLIC_STATE);
    } catch (error) {
      console.error("Read public state failed:", error);

      res.status(500).json({
        error: "Unable to read shared transit data.",
      });
    }
  });

  app.put("/api/public-state", async (req, res) => {
    if (!validObject(req.body)) {
      return res.status(400).json({
        ok: false,
        error: "Invalid public transit state.",
      });
    }

    try {
      await sql`
        INSERT INTO datscogo_app_state (
          state_key,
          state_value,
          updated_at
        )
        VALUES (
          'public-state',
          ${sql.json(req.body)},
          NOW()
        )
        ON CONFLICT (state_key)
        DO UPDATE SET
          state_value = EXCLUDED.state_value,
          updated_at = NOW()
      `;

      res.json({ ok: true });
    } catch (error) {
      console.error("Write public state failed:", error);

      res.status(500).json({
        ok: false,
        error: "Unable to save shared transit data.",
      });
    }
  });

  // --------------------------------------------------
  // ANNOUNCEMENT IMAGES
  // --------------------------------------------------

  app.put('/api/announcement-images/:announcementId', async (req, res) => {
    const announcementId = String(req.params.announcementId || '').trim();
    const dataUrl = validObject(req.body) && typeof req.body.dataUrl === 'string' ? req.body.dataUrl : '';
    const match = /^data:(image\/(?:png|jpe?g|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
    if (!announcementId || !match) return res.status(400).json({ ok: false, error: 'Use a PNG, JPG, JPEG, or WEBP image.' });

    try {
      const imageData = Buffer.from(match[2], 'base64');
      if (imageData.length === 0 || imageData.length > 3 * 1024 * 1024) {
        return res.status(413).json({ ok: false, error: 'Announcement images must be 3 MB or smaller after processing.' });
      }
      await sql`
        INSERT INTO datscogo_announcement_images (announcement_id, content_type, image_data, updated_at)
        VALUES (${announcementId}, ${match[1]}, ${imageData}, NOW())
        ON CONFLICT (announcement_id) DO UPDATE SET
          content_type = EXCLUDED.content_type,
          image_data = EXCLUDED.image_data,
          updated_at = NOW()
      `;
      res.json({ ok: true });
    } catch (error) {
      console.error('Announcement image upload failed:', error);
      res.status(500).json({ ok: false, error: 'Unable to save the announcement image.' });
    }
  });

  app.get('/api/announcement-images/:announcementId', async (req, res) => {
    try {
      const rows = await sql`
        SELECT content_type, image_data
        FROM datscogo_announcement_images
        WHERE announcement_id = ${String(req.params.announcementId || '')}
        LIMIT 1
      `;
      if (!rows[0]) return res.status(404).end();
      res.setHeader('Content-Type', rows[0].content_type);
      res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
      res.send(rows[0].image_data);
    } catch (error) {
      console.error('Announcement image read failed:', error);
      res.status(500).end();
    }
  });

  app.delete('/api/announcement-images/:announcementId', async (req, res) => {
    try {
      await sql`DELETE FROM datscogo_announcement_images WHERE announcement_id = ${String(req.params.announcementId || '')}`;
      res.json({ ok: true });
    } catch (error) {
      console.error('Announcement image delete failed:', error);
      res.status(500).json({ ok: false, error: 'Unable to remove the announcement image.' });
    }
  });

  // --------------------------------------------------
  // SHARED ACCOUNTS
  // --------------------------------------------------

  app.get("/api/accounts", async (_req, res) => {
    try {
      const rows = await sql`
        SELECT state_value
        FROM datscogo_app_state
        WHERE state_key = 'accounts'
        LIMIT 1
      `;

      const accounts = rows[0]?.state_value;

      res.setHeader("Cache-Control", "no-store");

      res.json(
        Array.isArray(accounts)
          ? accounts
          : [DEFAULT_ADMIN]
      );
    } catch (error) {
      console.error("Read accounts failed:", error);

      res.status(500).json({
        error: "Unable to read shared accounts.",
      });
    }
  });

  app.put("/api/accounts", async (req, res) => {
    if (!Array.isArray(req.body)) {
      return res.status(400).json({
        ok: false,
        error: "Invalid accounts data.",
      });
    }

    try {
      await sql`
        INSERT INTO datscogo_app_state (
          state_key,
          state_value,
          updated_at
        )
        VALUES (
          'accounts',
          ${sql.json(req.body)},
          NOW()
        )
        ON CONFLICT (state_key)
        DO UPDATE SET
          state_value = EXCLUDED.state_value,
          updated_at = NOW()
      `;

      // Keep live vehicle markers consistent with driver accounts. If a driver
      // account is removed, any shared live trip for that driver is removed too.
      const activeDriverIds = req.body
        .filter((account: unknown) => validObject(account) && account.role === "driver" && account.active !== false)
        .map((account: JsonObject) => String(account.id || "").trim())
        .filter(Boolean);

      const liveDriverRows = await sql`SELECT driver_id FROM datscogo_live_trips`;
      const activeDriverIdSet = new Set(activeDriverIds);
      const removedDriverIds = liveDriverRows
        .map((row) => String(row.driver_id || "").trim())
        .filter((driverId) => driverId && !activeDriverIdSet.has(driverId));

      for (const removedDriverId of removedDriverIds) {
        await sql`
          DELETE FROM datscogo_live_trips
          WHERE driver_id = ${removedDriverId}
        `;
      }

      res.json({ ok: true });
    } catch (error) {
      console.error("Write accounts failed:", error);

      res.status(500).json({
        ok: false,
        error: "Unable to save shared accounts.",
      });
    }
  });

  // --------------------------------------------------
  // LIVE DRIVER TRIPS
  // --------------------------------------------------

  app.get("/api/trips", async (_req, res) => {
    try {
      const rows = await sql`
        SELECT trip_value
        FROM datscogo_live_trips
        ORDER BY updated_at DESC
      `;

      res.setHeader("Cache-Control", "no-store");

      res.json(
        rows.map((row) => row.trip_value)
      );
    } catch (error) {
      console.error("Read trips failed:", error);

      res.status(500).json({
        error: "Unable to read live trips.",
      });
    }
  });

  app.delete("/api/trips/:driverId", async (req, res) => {
    const driverId = String(req.params.driverId || "").trim();
    if (!driverId) {
      return res.status(400).json({ ok: false, error: "Invalid driver ID." });
    }

    try {
      const rows = await sql`
        SELECT trip_value
        FROM datscogo_live_trips
        WHERE driver_id = ${driverId}
        LIMIT 1
      `;
      const trip = validObject(rows[0]?.trip_value) ? rows[0].trip_value : null;
      const tripId = trip ? String(trip.id || "").trim() : "";

      if (tripId) {
        await sql`
          INSERT INTO datscogo_hidden_live_trips (driver_id, trip_id, hidden_at)
          VALUES (${driverId}, ${tripId}, NOW())
          ON CONFLICT (driver_id) DO UPDATE SET
            trip_id = EXCLUDED.trip_id,
            hidden_at = NOW()
        `;
      }

      await sql`
        DELETE FROM datscogo_live_trips
        WHERE driver_id = ${driverId}
      `;
      res.json({ ok: true });
    } catch (error) {
      console.error("Delete live trip failed:", error);
      res.status(500).json({ ok: false, error: "Unable to remove the driver's live location." });
    }
  });

  app.put("/api/trips/:driverId", async (req, res) => {
    const driverId = String(req.params.driverId || "").trim();
    const incomingTrip = req.body;

    if (
      !driverId ||
      !validObject(incomingTrip) ||
      String(incomingTrip.driverId || "") !== driverId
    ) {
      return res.status(400).json({ ok: false, error: "Invalid live trip update." });
    }

    try {
      // Reject location updates from deleted/disabled driver accounts so a
      // stale driver session cannot recreate a marker after admin deletion.
      const accountRows = await sql`
        SELECT state_value
        FROM datscogo_app_state
        WHERE state_key = 'accounts'
        LIMIT 1
      `;
      const accounts = accountRows[0]?.state_value;
      const driverIsActive = Array.isArray(accounts) && accounts.some((account) =>
        validObject(account) &&
        String(account.id || "") === driverId &&
        account.role === "driver" &&
        account.active !== false
      );

      if (!driverIsActive) {
        await sql`DELETE FROM datscogo_live_trips WHERE driver_id = ${driverId}`;
        await sql`DELETE FROM datscogo_hidden_live_trips WHERE driver_id = ${driverId}`;
        return res.status(403).json({ ok: false, error: "Driver account is no longer active." });
      }

      const incomingTripId = String(incomingTrip.id || "").trim();
      const hiddenRows = await sql`
        SELECT trip_id
        FROM datscogo_hidden_live_trips
        WHERE driver_id = ${driverId}
        LIMIT 1
      `;
      const hiddenTripId = String(hiddenRows[0]?.trip_id || "").trim();

      // If an administrator removed this exact live trip from the public map,
      // ignore subsequent automatic GPS updates from the same trip. A newly
      // started trip has a new ID and is allowed to appear again normally.
      if (hiddenTripId && hiddenTripId === incomingTripId) {
        await sql`DELETE FROM datscogo_live_trips WHERE driver_id = ${driverId}`;
        return res.status(409).json({ ok: false, error: "This trip was removed from the public map by an administrator." });
      }
      if (hiddenTripId && hiddenTripId !== incomingTripId) {
        await sql`DELETE FROM datscogo_hidden_live_trips WHERE driver_id = ${driverId}`;
      }

      const existingRows = await sql`
        SELECT trip_value
        FROM datscogo_live_trips
        WHERE driver_id = ${driverId}
        LIMIT 1
      `;
      const existingTrip = validObject(existingRows[0]?.trip_value) ? existingRows[0].trip_value : null;
      const sameTrip = existingTrip && String(existingTrip.id || "") === String(incomingTrip.id || "");
      const now = Date.now();
      const tripTimestamp = numericValue(incomingTrip.lastUpdated, now);
      const latitude = numericValue(incomingTrip.latitude);
      const longitude = numericValue(incomingTrip.longitude);

      let trip: JsonObject = { ...incomingTrip };
      if (sameTrip && existingTrip) {
        const anchorLatitude = numericValue(existingTrip.movementAnchorLatitude, numericValue(existingTrip.latitude, latitude));
        const anchorLongitude = numericValue(existingTrip.movementAnchorLongitude, numericValue(existingTrip.longitude, longitude));
        const movedMeters = haversineMeters(anchorLatitude, anchorLongitude, latitude, longitude);
        const actuallyMoved = movedMeters >= MOVEMENT_DISTANCE_METERS;

        trip = {
          ...trip,
          lastMovedAt: actuallyMoved
            ? tripTimestamp
            : numericValue(existingTrip.lastMovedAt, numericValue(existingTrip.startedAt, tripTimestamp)),
          movementAnchorLatitude: actuallyMoved ? latitude : anchorLatitude,
          movementAnchorLongitude: actuallyMoved ? longitude : anchorLongitude,
          safetyCheckStatus: existingTrip.safetyCheckStatus,
          safetyCheckStartedAt: existingTrip.safetyCheckStartedAt,
          safetyCheckDeadlineAt: existingTrip.safetyCheckDeadlineAt,
          safetyResetAt: existingTrip.safetyResetAt,
          safetyIncident: existingTrip.safetyIncident,
        };
      } else {
        trip = {
          ...trip,
          lastMovedAt: numericValue(incomingTrip.startedAt, tripTimestamp),
          movementAnchorLatitude: latitude,
          movementAnchorLongitude: longitude,
          safetyCheckStatus: "idle",
          safetyResetAt: numericValue(incomingTrip.startedAt, tripTimestamp),
        };
      }

      if (trip.status === "arrived") {
        trip.safetyCheckStatus = "idle";
        trip.safetyCheckStartedAt = undefined;
        trip.safetyCheckDeadlineAt = undefined;
      }
      trip = withoutUndefined(trip);

      await sql`
        INSERT INTO datscogo_live_trips (driver_id, trip_value, updated_at)
        VALUES (${driverId}, ${sql.json(trip)}, NOW())
        ON CONFLICT (driver_id)
        DO UPDATE SET trip_value = EXCLUDED.trip_value, updated_at = NOW()
      `;

      const tripId = String(trip.id || "").trim();
      const routeId = String(trip.routeId || "").trim();
      if (tripId && routeId && trip.status === "arrived") {
        const startedAtValue = numericValue(trip.startedAt, numericValue(trip.lastUpdated, now));
        const arrivedAtValue = numericValue(trip.arrivedAt, numericValue(trip.lastUpdated, now));
        const startedAt = new Date(startedAtValue);
        const arrivedAt = new Date(arrivedAtValue);

        await sql`
          INSERT INTO datscogo_trip_history (
            trip_id, driver_id, route_id, trip_value, started_at, arrived_at, updated_at
          )
          VALUES (
            ${tripId}, ${driverId}, ${routeId}, ${sql.json(trip)}, ${startedAt}, ${arrivedAt}, NOW()
          )
          ON CONFLICT (trip_id)
          DO UPDATE SET
            driver_id = EXCLUDED.driver_id,
            route_id = EXCLUDED.route_id,
            trip_value = EXCLUDED.trip_value,
            arrived_at = COALESCE(EXCLUDED.arrived_at, datscogo_trip_history.arrived_at),
            updated_at = NOW()
        `;
      }

      res.json({ ok: true, trip });
    } catch (error) {
      console.error("Write trip failed:", error);
      res.status(500).json({ ok: false, error: "Unable to save live trip." });
    }
  });

  app.patch("/api/trips/:driverId/safety", async (req, res) => {
    const driverId = String(req.params.driverId || "").trim();
    const action = String(req.body?.action || "").trim();
    if (!driverId || !["cancel", "report", "resolve"].includes(action)) {
      return res.status(400).json({ ok: false, error: "Invalid safety action." });
    }

    try {
      const rows = await sql`
        SELECT trip_value
        FROM datscogo_live_trips
        WHERE driver_id = ${driverId}
        LIMIT 1
      `;
      if (!validObject(rows[0]?.trip_value)) {
        return res.status(404).json({ ok: false, error: "Active driver trip not found." });
      }

      const current = rows[0].trip_value;
      if (action !== "resolve" && current.status !== "departed") {
        return res.status(409).json({ ok: false, error: "This safety action requires an active departure." });
      }

      const now = Date.now();
      const next: JsonObject = { ...current };
      if (action === "cancel") {
        next.safetyCheckStatus = "idle";
        next.safetyCheckStartedAt = undefined;
        next.safetyCheckDeadlineAt = undefined;
        next.safetyResetAt = now;
        next.movementAnchorLatitude = numericValue(current.latitude);
        next.movementAnchorLongitude = numericValue(current.longitude);
      } else if (action === "report") {
        next.safetyCheckStatus = "alerted";
        next.safetyCheckStartedAt = undefined;
        next.safetyCheckDeadlineAt = undefined;
        next.safetyIncident = {
          id: `incident-${driverId}-${now}`,
          active: true,
          source: "driver_reported",
          createdAt: now,
          message: "Driver reported that an accident or emergency may have occurred.",
          latitude: numericValue(current.latitude),
          longitude: numericValue(current.longitude),
        };
      } else if (action === "resolve") {
        const incident = validObject(current.safetyIncident) ? current.safetyIncident : {};
        next.safetyCheckStatus = "idle";
        next.safetyCheckStartedAt = undefined;
        next.safetyCheckDeadlineAt = undefined;
        next.safetyResetAt = now;
        next.safetyIncident = {
          ...incident,
          active: false,
          resolvedAt: now,
        };
      }

      const cleaned = withoutUndefined(next);
      await sql`
        UPDATE datscogo_live_trips
        SET trip_value = ${sql.json(cleaned)}, updated_at = NOW()
        WHERE driver_id = ${driverId}
      `;
      res.json({ ok: true, trip: cleaned });
    } catch (error) {
      console.error("Trip safety action failed:", error);
      res.status(500).json({ ok: false, error: "Unable to update the driver safety alert." });
    }
  });

  let safetyWatchdogRunning = false;
  const runSafetyWatchdog = async () => {
    if (safetyWatchdogRunning) return;
    safetyWatchdogRunning = true;
    try {
      const rows = await sql`
        SELECT driver_id, trip_value
        FROM datscogo_live_trips
        WHERE trip_value->>'status' = 'departed'
      `;
      const now = Date.now();

      for (const row of rows) {
        if (!validObject(row.trip_value)) continue;
        const trip = row.trip_value;
        const incident = validObject(trip.safetyIncident) ? trip.safetyIncident : null;
        if (incident?.active === true) continue;

        if (trip.safetyCheckStatus === "pending") {
          const deadline = numericValue(trip.safetyCheckDeadlineAt);
          if (deadline && now >= deadline) {
            const next = withoutUndefined({
              ...trip,
              safetyCheckStatus: "alerted",
              safetyCheckStartedAt: undefined,
              safetyCheckDeadlineAt: undefined,
              safetyIncident: {
                id: `incident-${row.driver_id}-${now}`,
                active: true,
                source: "no_response",
                createdAt: now,
                message: "The Datsco remained stationary for 30 minutes and the driver did not respond to the 10-second safety check.",
                latitude: numericValue(trip.latitude),
                longitude: numericValue(trip.longitude),
              },
            });
            await sql`
              UPDATE datscogo_live_trips
              SET trip_value = ${sql.json(next)}, updated_at = NOW()
              WHERE driver_id = ${row.driver_id}
            `;
          }
          continue;
        }

        const movementBase = Math.max(
          numericValue(trip.lastMovedAt, numericValue(trip.startedAt, numericValue(trip.lastUpdated, now))),
          numericValue(trip.safetyResetAt, 0),
        );
        if (now - movementBase >= NO_MOVEMENT_THRESHOLD_MS) {
          const next = withoutUndefined({
            ...trip,
            safetyCheckStatus: "pending",
            safetyCheckStartedAt: now,
            safetyCheckDeadlineAt: now + SAFETY_RESPONSE_WINDOW_MS,
          });
          await sql`
            UPDATE datscogo_live_trips
            SET trip_value = ${sql.json(next)}, updated_at = NOW()
            WHERE driver_id = ${row.driver_id}
          `;
        }
      }
    } catch (error) {
      console.error("Driver safety watchdog failed:", error);
    } finally {
      safetyWatchdogRunning = false;
    }
  };

  const safetyWatchdogTimer = setInterval(() => void runSafetyWatchdog(), 2_000);
  void runSafetyWatchdog();

  // --------------------------------------------------
  // DRIVER TRIP HISTORY
  // --------------------------------------------------

  app.get("/api/trip-records", async (_req, res) => {
    try {
      const rows = await sql`
        SELECT trip_id, driver_id, route_id, trip_value, started_at, arrived_at, updated_at
        FROM datscogo_trip_history
        ORDER BY started_at DESC, updated_at DESC
      `;

      res.setHeader("Cache-Control", "no-store");
      res.json(rows.map((row) => ({
        ...row.trip_value,
        id: row.trip_id,
        driverId: row.driver_id,
        routeId: row.route_id,
        startedAt: new Date(row.started_at).getTime(),
        arrivedAt: row.arrived_at ? new Date(row.arrived_at).getTime() : undefined,
        lastUpdated: new Date(row.updated_at).getTime(),
      })));
    } catch (error) {
      console.error("Read trip history failed:", error);
      res.status(500).json({ error: "Unable to read driver trip records." });
    }
  });

  app.delete("/api/trip-records/:tripId", async (req, res) => {
    const tripId = String(req.params.tripId || "").trim();
    if (!tripId) return res.status(400).json({ ok: false, error: "Trip ID is required." });

    try {
      await sql`DELETE FROM datscogo_trip_history WHERE trip_id = ${tripId}`;
      res.json({ ok: true });
    } catch (error) {
      console.error("Delete trip history failed:", error);
      res.status(500).json({ ok: false, error: "Unable to delete the trip record." });
    }
  });

  app.delete("/api/trip-records", async (_req, res) => {
    try {
      await sql`DELETE FROM datscogo_trip_history`;
      res.json({ ok: true });
    } catch (error) {
      console.error("Delete all trip history failed:", error);
      res.status(500).json({ ok: false, error: "Unable to delete all trip records." });
    }
  });

  // --------------------------------------------------
  // FRONTEND
  // --------------------------------------------------

  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  app.get("*", (_req, res) => {
    res.sendFile(
      path.join(staticPath, "index.html")
    );
  });

  // --------------------------------------------------
  // SERVER
  // --------------------------------------------------

  const port =
    Number(process.env.PORT) || 3000;

  server.listen(port, "0.0.0.0", () => {
    console.log(
      `DatscoGo running on port ${port} with PostgreSQL shared storage.`
    );
  });

  const shutdown = async () => {
    clearInterval(safetyWatchdogTimer);
    await sql.end({ timeout: 5 });

    server.close(() => {
      process.exit(0);
    });
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

startServer().catch((error) => {
  console.error(
    "DatscoGo startup failed:",
    error
  );

  process.exit(1);
});