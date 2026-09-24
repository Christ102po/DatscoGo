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

  app.use(express.json({ limit: "2mb" }));

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

  app.put("/api/trips/:driverId", async (req, res) => {
    const driverId = String(
      req.params.driverId || ""
    ).trim();

    const trip = req.body;

    if (
      !driverId ||
      !validObject(trip) ||
      String(trip.driverId || "") !== driverId
    ) {
      return res.status(400).json({
        ok: false,
        error: "Invalid live trip update.",
      });
    }

    try {
      await sql`
        INSERT INTO datscogo_live_trips (
          driver_id,
          trip_value,
          updated_at
        )
        VALUES (
          ${driverId},
          ${sql.json(trip)},
          NOW()
        )
        ON CONFLICT (driver_id)
        DO UPDATE SET
          trip_value = EXCLUDED.trip_value,
          updated_at = NOW()
      `;

      const tripId = String(trip.id || "").trim();
      const routeId = String(trip.routeId || "").trim();
      if (tripId && routeId && trip.status === "arrived") {
        const startedAtValue = Number(trip.startedAt || trip.lastUpdated || Date.now());
        const arrivedAtValue = trip.status === "arrived"
          ? Number(trip.arrivedAt || trip.lastUpdated || Date.now())
          : null;
        const startedAt = new Date(Number.isFinite(startedAtValue) ? startedAtValue : Date.now());
        const arrivedAt = arrivedAtValue && Number.isFinite(arrivedAtValue)
          ? new Date(arrivedAtValue)
          : null;

        await sql`
          INSERT INTO datscogo_trip_history (
            trip_id,
            driver_id,
            route_id,
            trip_value,
            started_at,
            arrived_at,
            updated_at
          )
          VALUES (
            ${tripId},
            ${driverId},
            ${routeId},
            ${sql.json(trip)},
            ${startedAt},
            ${arrivedAt},
            NOW()
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

      res.json({ ok: true });
    } catch (error) {
      console.error("Write trip failed:", error);

      res.status(500).json({
        ok: false,
        error: "Unable to save live trip.",
      });
    }
  });

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