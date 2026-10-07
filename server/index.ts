import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import postgres from "postgres";
import { pbkdf2 as pbkdf2Callback, randomBytes, randomUUID, timingSafeEqual, createHash } from "crypto";
import { promisify } from "util";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type JsonObject = Record<string, unknown>;

const LEGACY_PASSWORD_SALT = "datscogo-v1:";
const DEFAULT_ADMIN_PROFILE = {
  id: "admin-1",
  username: "admin123",
  displayName: "DatscoGo Administrator",
  role: "admin" as const,
  active: true,
};

const pbkdf2 = promisify(pbkdf2Callback);
const PASSWORD_ITERATIONS = 210_000;
const SESSION_COOKIE = "datscogo_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

type AuthUser = { id: string; username: string; displayName: string; role: "admin" | "driver"; active: boolean };

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const digest = await pbkdf2(password, salt, PASSWORD_ITERATIONS, 32, "sha512");
  return `pbkdf2_sha512$${PASSWORD_ITERATIONS}$${salt}$${Buffer.from(digest).toString("hex")}`;
}

async function verifyPassword(password: string, encoded: string) {
  if (encoded.startsWith("legacy_sha256$")) {
    const expected = encoded.slice("legacy_sha256$".length);
    const actual = createHash("sha256").update(`${LEGACY_PASSWORD_SALT}${password}`).digest("hex");
    return timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
  }
  const [scheme, iterationsRaw, salt, expectedHex] = encoded.split("$");
  if (scheme !== "pbkdf2_sha512" || !iterationsRaw || !salt || !expectedHex) return false;
  const iterations = Number(iterationsRaw);
  if (!Number.isInteger(iterations) || iterations < 100_000 || expectedHex.length !== 64) return false;
  const actual = Buffer.from(await pbkdf2(password, salt, iterations, 32, "sha512"));
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function parseCookies(header: string | undefined) {
  const result: Record<string, string> = {};
  for (const part of (header ?? "").split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    result[decodeURIComponent(part.slice(0, index).trim())] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return result;
}

function sessionCookie(value: string, secure: boolean, maxAgeSeconds = 0) {
  const parts = [`${SESSION_COOKIE}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", secure ? "SameSite=None" : "SameSite=Lax"];
  if (secure) parts.push("Secure");
  if (maxAgeSeconds > 0) parts.push(`Max-Age=${maxAgeSeconds}`);
  else parts.push("Max-Age=0");
  return parts.join("; ");
}

function safeLog(label: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(label, message.replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[redacted-database-url]").replace(/(sk-[A-Za-z0-9_-]+)/g, "[redacted-secret]"));
}

const EMPTY_PUBLIC_STATE = {
  routes: [],
  schedules: [],
  terminals: [],
  repairShops: [],
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
    CREATE TABLE IF NOT EXISTS datscogo_driver_reports (
      report_id TEXT PRIMARY KEY,
      report_value JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS datscogo_driver_report_images (
      report_id TEXT PRIMARY KEY,
      content_type TEXT NOT NULL,
      image_data BYTEA NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS datscogo_accounts (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'driver')),
      password_hash TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS datscogo_sessions (
      session_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES datscogo_accounts(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // PostgreSQL row-level security is enabled for credential/session rows.
  // The API never exposes password hashes or raw session tokens.
  await sql`ALTER TABLE datscogo_accounts ENABLE ROW LEVEL SECURITY`;
  await sql`ALTER TABLE datscogo_sessions ENABLE ROW LEVEL SECURITY`;
  await sql`ALTER TABLE datscogo_live_trips ENABLE ROW LEVEL SECURITY`;

  // Policies provide a database-level ownership boundary for deployments that
  // connect through a non-owner PostgreSQL role and set datscogo.user_id/role.
  await sql`DROP POLICY IF EXISTS datscogo_accounts_rls ON datscogo_accounts`;
  await sql`CREATE POLICY datscogo_accounts_rls ON datscogo_accounts
    USING (current_setting('datscogo.role', true) = 'admin' OR id = current_setting('datscogo.user_id', true))
    WITH CHECK (current_setting('datscogo.role', true) = 'admin' OR id = current_setting('datscogo.user_id', true))`;
  await sql`DROP POLICY IF EXISTS datscogo_sessions_rls ON datscogo_sessions`;
  await sql`CREATE POLICY datscogo_sessions_rls ON datscogo_sessions
    USING (current_setting('datscogo.role', true) = 'admin' OR user_id = current_setting('datscogo.user_id', true))
    WITH CHECK (current_setting('datscogo.role', true) = 'admin' OR user_id = current_setting('datscogo.user_id', true))`;
  await sql`DROP POLICY IF EXISTS datscogo_live_trips_select_rls ON datscogo_live_trips`;
  await sql`CREATE POLICY datscogo_live_trips_select_rls ON datscogo_live_trips FOR SELECT USING (TRUE)`;
  await sql`DROP POLICY IF EXISTS datscogo_live_trips_write_rls ON datscogo_live_trips`;
  await sql`CREATE POLICY datscogo_live_trips_write_rls ON datscogo_live_trips FOR ALL
    USING (current_setting('datscogo.role', true) = 'admin' OR driver_id = current_setting('datscogo.user_id', true))
    WITH CHECK (current_setting('datscogo.role', true) = 'admin' OR driver_id = current_setting('datscogo.user_id', true))`;

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

  await sql`ALTER TABLE datscogo_trip_history ENABLE ROW LEVEL SECURITY`;
  await sql`DROP POLICY IF EXISTS datscogo_trip_history_rls ON datscogo_trip_history`;
  await sql`CREATE POLICY datscogo_trip_history_rls ON datscogo_trip_history
    USING (current_setting('datscogo.role', true) = 'admin' OR driver_id = current_setting('datscogo.user_id', true))
    WITH CHECK (current_setting('datscogo.role', true) = 'admin' OR driver_id = current_setting('datscogo.user_id', true))`;

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

  const legacyAccountRows = await sql`
    SELECT state_value FROM datscogo_app_state WHERE state_key = 'accounts' LIMIT 1
  `;
  const legacyAccounts = Array.isArray(legacyAccountRows[0]?.state_value)
    ? legacyAccountRows[0].state_value
    : [];

  for (const candidate of legacyAccounts) {
    if (!validObject(candidate)) continue;
    const id = String(candidate.id || "").trim();
    const username = String(candidate.username || "").trim().toLowerCase();
    const displayName = String(candidate.displayName || username).trim();
    const role = candidate.role === "admin" ? "admin" : candidate.role === "driver" ? "driver" : null;
    let passwordHash = String(candidate.passwordHash || "").trim();
    if (passwordHash && !passwordHash.includes("$")) passwordHash = `legacy_sha256$${passwordHash}`;
    if (!id || !username || !role || !passwordHash) continue;
    await sql`
      INSERT INTO datscogo_accounts (id, username, display_name, role, password_hash, active, updated_at)
      VALUES (${id}, ${username}, ${displayName}, ${role}, ${passwordHash}, ${candidate.active !== false}, NOW())
      ON CONFLICT (id) DO NOTHING
    `;
  }

  const adminRows = await sql`SELECT id FROM datscogo_accounts WHERE role = 'admin' LIMIT 1`;
  if (!adminRows[0]) {
    const initialAdminPassword = process.env.INITIAL_ADMIN_PASSWORD || "";
    const initialAdminUsername = (process.env.INITIAL_ADMIN_USERNAME || DEFAULT_ADMIN_PROFILE.username).trim().toLowerCase();
    if (initialAdminPassword.length < 12) {
      throw new Error("INITIAL_ADMIN_PASSWORD must be set to at least 12 characters for a fresh DatscoGo deployment.");
    }
    const passwordHash = await hashPassword(initialAdminPassword);
    await sql`
      INSERT INTO datscogo_accounts (id, username, display_name, role, password_hash, active)
      VALUES (${DEFAULT_ADMIN_PROFILE.id}, ${initialAdminUsername}, ${DEFAULT_ADMIN_PROFILE.displayName}, ${DEFAULT_ADMIN_PROFILE.role}, ${passwordHash}, TRUE)
    `;
  }

  // Remove the old JSON credential blob after migration so password hashes are no longer mixed into app state.
  await sql`DELETE FROM datscogo_app_state WHERE state_key = 'accounts'`;

  const app = express();
  const server = createServer(app);
  app.disable("x-powered-by");

  app.use(express.json({ limit: "6mb" }));

  const configuredOrigins = new Set(
    (process.env.ALLOWED_ORIGINS || process.env.APP_ORIGIN || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
  if (process.env.NODE_ENV !== "production") {
    configuredOrigins.add("http://localhost:3000");
    configuredOrigins.add("http://localhost:5173");
    configuredOrigins.add("capacitor://localhost");
  }

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
    const protocol = forwardedProto || req.protocol;
    const host = req.get("host");
    const sameOrigin = Boolean(origin && host && origin === `${protocol}://${host}`);
    const allowedOrigin = Boolean(origin && (sameOrigin || configuredOrigins.has(origin)));

    if (origin && allowedOrigin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    }
    if (req.method === "OPTIONS") return allowedOrigin ? res.sendStatus(204) : res.sendStatus(403);
    if (origin && !allowedOrigin) return res.status(403).json({ error: "Origin not allowed." });
    next();
  });

  async function getAuthUser(req: express.Request): Promise<AuthUser | null> {
    const rawToken = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    if (!rawToken) return null;
    const sessionHash = createHash("sha256").update(rawToken).digest("hex");
    const rows = await sql`
      SELECT a.id, a.username, a.display_name, a.role, a.active
      FROM datscogo_sessions s
      JOIN datscogo_accounts a ON a.id = s.user_id
      WHERE s.session_hash = ${sessionHash}
        AND s.expires_at > NOW()
        AND a.active = TRUE
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) return null;
    return { id: row.id, username: row.username, displayName: row.display_name, role: row.role, active: row.active };
  }

  const requireRole = (...roles: AuthUser["role"][]) => async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const user = await getAuthUser(req);
      if (!user) return res.status(401).json({ error: "Authentication required." });
      if (!roles.includes(user.role)) return res.status(403).json({ error: "You do not have permission to perform this action." });
      res.locals.authUser = user;
      next();
    } catch (error) {
      safeLog("Authentication check failed:", error);
      res.status(500).json({ error: "Unable to verify your session." });
    }
  };

  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Permissions-Policy", "geolocation=(self), camera=(), microphone=()");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");

    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self' https://*.openstreetmap.org https://cdnjs.cloudflare.com https://images.unsplash.com https://*.tile.openstreetmap.org https://www.google.com; script-src 'self' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com; img-src 'self' data: https:; connect-src 'self' https://*.openstreetmap.org https://router.project-osrm.org;"
    );

    next();
  });

  // --------------------------------------------------
  // SERVER-SIDE AUTHENTICATION
  // --------------------------------------------------

  app.post("/api/auth/login", async (req, res) => {
    const username = validObject(req.body) && typeof req.body.username === "string" ? req.body.username.trim().toLowerCase() : "";
    const password = validObject(req.body) && typeof req.body.password === "string" ? req.body.password : "";
    if (!username || !password || password.length > 256) return res.status(400).json({ error: "Invalid credentials." });
    try {
      const rows = await sql`SELECT id, username, display_name, role, password_hash, active FROM datscogo_accounts WHERE lower(username) = ${username} LIMIT 1`;
      const account = rows[0];
      if (!account || !account.active || !(await verifyPassword(password, account.password_hash))) {
        return res.status(401).json({ error: "Invalid credentials." });
      }
      if (String(account.password_hash).startsWith("legacy_sha256$")) {
        const upgraded = await hashPassword(password);
        await sql`UPDATE datscogo_accounts SET password_hash = ${upgraded}, updated_at = NOW() WHERE id = ${account.id}`;
      }
      const token = randomBytes(32).toString("base64url");
      const sessionHash = createHash("sha256").update(token).digest("hex");
      await sql`DELETE FROM datscogo_sessions WHERE expires_at <= NOW()`;
      await sql`INSERT INTO datscogo_sessions (session_hash, user_id, expires_at) VALUES (${sessionHash}, ${account.id}, NOW() + INTERVAL '12 hours')`;
      res.setHeader("Set-Cookie", sessionCookie(token, process.env.NODE_ENV === "production", Math.floor(SESSION_TTL_MS / 1000)));
      res.setHeader("Cache-Control", "no-store");
      res.json({ user: { id: account.id, username: account.username, displayName: account.display_name, role: account.role, active: account.active } });
    } catch (error) {
      safeLog("Login failed:", error);
      res.status(500).json({ error: "Unable to sign in." });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    try {
      const user = await getAuthUser(req);
      res.setHeader("Cache-Control", "no-store");
      if (!user) return res.status(401).json({ user: null });
      res.json({ user });
    } catch (error) {
      safeLog("Session read failed:", error);
      res.status(500).json({ user: null });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    try {
      const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
      if (token) {
        const sessionHash = createHash("sha256").update(token).digest("hex");
        await sql`DELETE FROM datscogo_sessions WHERE session_hash = ${sessionHash}`;
      }
    } catch (error) {
      safeLog("Logout cleanup failed:", error);
    }
    res.setHeader("Set-Cookie", sessionCookie("", process.env.NODE_ENV === "production"));
    res.json({ ok: true });
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
      safeLog("PostgreSQL health check failed:", error);

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
      safeLog("Read public state failed:", error);

      res.status(500).json({
        error: "Unable to read shared transit data.",
      });
    }
  });

  app.put("/api/public-state", requireRole("admin"), async (req, res) => {
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
      safeLog("Write public state failed:", error);

      res.status(500).json({
        ok: false,
        error: "Unable to save shared transit data.",
      });
    }
  });

  // --------------------------------------------------
  // ANNOUNCEMENT IMAGES
  // --------------------------------------------------

  app.put('/api/announcement-images/:announcementId', requireRole("admin"), async (req, res) => {
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
      safeLog('Announcement image upload failed:', error);
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
      safeLog('Announcement image read failed:', error);
      res.status(500).end();
    }
  });

  app.delete('/api/announcement-images/:announcementId', requireRole("admin"), async (req, res) => {
    try {
      await sql`DELETE FROM datscogo_announcement_images WHERE announcement_id = ${String(req.params.announcementId || '')}`;
      res.json({ ok: true });
    } catch (error) {
      safeLog('Announcement image delete failed:', error);
      res.status(500).json({ ok: false, error: 'Unable to remove the announcement image.' });
    }
  });

  // --------------------------------------------------
  // PASSENGER DRIVER REPORTS
  // --------------------------------------------------

  app.post('/api/driver-reports', async (req, res) => {
    if (!validObject(req.body)) return res.status(400).json({ ok: false, error: 'Invalid report.' });

    const routeId = typeof req.body.routeId === 'string' ? req.body.routeId.trim() : '';
    const routeTitle = typeof req.body.routeTitle === 'string' ? req.body.routeTitle.trim().slice(0, 160) : '';
    const issueType = typeof req.body.issueType === 'string' ? req.body.issueType.trim().slice(0, 80) : '';
    const details = typeof req.body.details === 'string' ? req.body.details.trim().slice(0, 2000) : '';
    const reporterName = typeof req.body.reporterName === 'string' ? req.body.reporterName.trim().slice(0, 120) : '';
    const imageDataUrl = typeof req.body.imageDataUrl === 'string' ? req.body.imageDataUrl : '';

    if (!routeId || !routeTitle || !issueType || !details) {
      return res.status(400).json({ ok: false, error: 'Choose the route, issue type, and describe what happened.' });
    }

    const reportId = `driver-report-${randomUUID()}`;
    const createdAt = Date.now();
    const reportValue = {
      id: reportId,
      routeId,
      routeTitle,
      issueType,
      details,
      reporterName: reporterName || null,
      anonymous: !reporterName,
      hasPhoto: Boolean(imageDataUrl),
      status: 'open',
      createdAt,
    };

    try {
      if (imageDataUrl) {
        const match = /^data:(image\/(?:png|jpe?g|webp));base64,([A-Za-z0-9+/=]+)$/.exec(imageDataUrl);
        if (!match) return res.status(400).json({ ok: false, error: 'Use a PNG, JPG, JPEG, or WEBP photo.' });
        const imageData = Buffer.from(match[2], 'base64');
        if (imageData.length === 0 || imageData.length > 3 * 1024 * 1024) {
          return res.status(413).json({ ok: false, error: 'Report photos must be 3 MB or smaller after processing.' });
        }
        await sql`
          INSERT INTO datscogo_driver_report_images (report_id, content_type, image_data, updated_at)
          VALUES (${reportId}, ${match[1]}, ${imageData}, NOW())
        `;
      }

      await sql`
        INSERT INTO datscogo_driver_reports (report_id, report_value, created_at, updated_at)
        VALUES (${reportId}, ${sql.json(reportValue)}, NOW(), NOW())
      `;
      res.json({ ok: true, reportId });
    } catch (error) {
      safeLog('Create driver report failed:', error);
      await sql`DELETE FROM datscogo_driver_report_images WHERE report_id = ${reportId}`.catch(() => undefined);
      res.status(500).json({ ok: false, error: 'Unable to submit the report right now.' });
    }
  });

  app.get('/api/driver-reports', requireRole("admin"), async (_req, res) => {
    try {
      const rows = await sql`
        SELECT report_id, report_value, created_at, updated_at
        FROM datscogo_driver_reports
        ORDER BY created_at DESC
      `;
      res.setHeader('Cache-Control', 'no-store');
      res.json(rows.map((row) => ({
        ...row.report_value,
        id: row.report_id,
        createdAt: new Date(row.created_at).getTime(),
        updatedAt: new Date(row.updated_at).getTime(),
        photoUrl: row.report_value?.hasPhoto ? `/api/driver-report-images/${encodeURIComponent(row.report_id)}` : undefined,
      })));
    } catch (error) {
      safeLog('Read driver reports failed:', error);
      res.status(500).json({ error: 'Unable to read passenger reports.' });
    }
  });

  app.patch('/api/driver-reports/:reportId', requireRole("admin"), async (req, res) => {
    const reportId = String(req.params.reportId || '').trim();
    const status = validObject(req.body) && (req.body.status === 'open' || req.body.status === 'reviewed') ? req.body.status : null;
    if (!reportId || !status) return res.status(400).json({ ok: false, error: 'Invalid report update.' });
    try {
      const rows = await sql`SELECT report_value FROM datscogo_driver_reports WHERE report_id = ${reportId} LIMIT 1`;
      if (!rows[0]) return res.status(404).json({ ok: false, error: 'Report not found.' });
      const next = { ...rows[0].report_value, status };
      await sql`UPDATE datscogo_driver_reports SET report_value = ${sql.json(next)}, updated_at = NOW() WHERE report_id = ${reportId}`;
      res.json({ ok: true });
    } catch (error) {
      safeLog('Update driver report failed:', error);
      res.status(500).json({ ok: false, error: 'Unable to update the report.' });
    }
  });

  app.delete('/api/driver-reports/:reportId', requireRole("admin"), async (req, res) => {
    const reportId = String(req.params.reportId || '').trim();
    if (!reportId) return res.status(400).json({ ok: false, error: 'Report ID is required.' });
    try {
      await sql.begin(async (tx) => {
        await tx`DELETE FROM datscogo_driver_report_images WHERE report_id = ${reportId}`;
        await tx`DELETE FROM datscogo_driver_reports WHERE report_id = ${reportId}`;
      });
      res.json({ ok: true });
    } catch (error) {
      safeLog('Delete driver report failed:', error);
      res.status(500).json({ ok: false, error: 'Unable to delete the report.' });
    }
  });

  app.get('/api/driver-report-images/:reportId', requireRole("admin"), async (req, res) => {
    try {
      const rows = await sql`SELECT content_type, image_data FROM datscogo_driver_report_images WHERE report_id = ${String(req.params.reportId || '')} LIMIT 1`;
      if (!rows[0]) return res.status(404).end();
      res.setHeader('Content-Type', rows[0].content_type);
      res.setHeader('Cache-Control', 'private, max-age=3600');
      res.send(rows[0].image_data);
    } catch (error) {
      safeLog('Read driver report image failed:', error);
      res.status(500).end();
    }
  });

  // --------------------------------------------------
  // ACCOUNTS (SANITIZED + ADMIN MUTATIONS)
  // --------------------------------------------------

  app.get("/api/accounts", async (req, res) => {
    try {
      const user = await getAuthUser(req);
      const rows = user?.role === "admin"
        ? await sql`SELECT id, username, display_name, role, active FROM datscogo_accounts ORDER BY role, display_name`
        : await sql`SELECT id, display_name, role, active FROM datscogo_accounts WHERE role = 'driver' AND active = TRUE ORDER BY display_name`;
      res.setHeader("Cache-Control", "no-store");
      res.json(rows.map((row) => ({
        id: row.id,
        ...(user?.role === "admin" ? { username: row.username } : {}),
        displayName: row.display_name,
        role: row.role,
        active: row.active,
      })));
    } catch (error) {
      safeLog("Read accounts failed:", error);
      res.status(500).json({ error: "Unable to read accounts." });
    }
  });

  app.post("/api/admin/drivers", requireRole("admin"), async (req, res) => {
    const displayName = validObject(req.body) && typeof req.body.displayName === "string" ? req.body.displayName.trim().slice(0, 120) : "";
    const username = validObject(req.body) && typeof req.body.username === "string" ? req.body.username.trim().toLowerCase() : "";
    const password = validObject(req.body) && typeof req.body.password === "string" ? req.body.password : "";
    if (username.length < 4 || displayName.length < 2 || password.length < 10 || password.length > 256) return res.status(400).json({ ok: false, error: "Use a name, a 4+ character username, and a 10+ character password." });
    try {
      const id = `driver-${randomUUID()}`;
      const passwordHash = await hashPassword(password);
      await sql`INSERT INTO datscogo_accounts (id, username, display_name, role, password_hash, active) VALUES (${id}, ${username}, ${displayName}, 'driver', ${passwordHash}, TRUE)`;
      res.status(201).json({ ok: true, account: { id, username, displayName, role: "driver", active: true } });
    } catch (error: any) {
      if (String(error?.code) === "23505") return res.status(409).json({ ok: false, error: "This username is already in use." });
      safeLog("Create driver failed:", error);
      res.status(500).json({ ok: false, error: "Unable to create the driver account." });
    }
  });

  app.delete("/api/admin/drivers/:driverId", requireRole("admin"), async (req, res) => {
    const driverId = String(req.params.driverId || "").trim();
    if (!driverId) return res.status(400).json({ ok: false, error: "Driver ID is required." });
    try {
      await sql.begin(async (tx) => {
        await tx`DELETE FROM datscogo_live_trips WHERE driver_id = ${driverId}`;
        await tx`DELETE FROM datscogo_hidden_live_trips WHERE driver_id = ${driverId}`;
        await tx`DELETE FROM datscogo_accounts WHERE id = ${driverId} AND role = 'driver'`;
      });
      res.json({ ok: true });
    } catch (error) {
      safeLog("Delete driver failed:", error);
      res.status(500).json({ ok: false, error: "Unable to delete the driver account." });
    }
  });

  app.patch("/api/admin/password", requireRole("admin"), async (req, res) => {
    const currentPassword = validObject(req.body) && typeof req.body.currentPassword === "string" ? req.body.currentPassword : "";
    const newPassword = validObject(req.body) && typeof req.body.newPassword === "string" ? req.body.newPassword : "";
    if (newPassword.length < 12 || newPassword.length > 256) return res.status(400).json({ ok: false, error: "Use at least 12 characters for the new password." });
    const user = res.locals.authUser as AuthUser;
    try {
      const rows = await sql`SELECT password_hash FROM datscogo_accounts WHERE id = ${user.id} LIMIT 1`;
      if (!rows[0] || !(await verifyPassword(currentPassword, rows[0].password_hash))) return res.status(403).json({ ok: false, error: "Your current password is incorrect." });
      const passwordHash = await hashPassword(newPassword);
      await sql`UPDATE datscogo_accounts SET password_hash = ${passwordHash}, updated_at = NOW() WHERE id = ${user.id}`;
      await sql`DELETE FROM datscogo_sessions WHERE user_id = ${user.id} AND session_hash <> ${createHash("sha256").update(parseCookies(req.headers.cookie)[SESSION_COOKIE] || "").digest("hex")}`;
      res.json({ ok: true });
    } catch (error) {
      safeLog("Password update failed:", error);
      res.status(500).json({ ok: false, error: "Unable to update the administrator password." });
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
      safeLog("Read trips failed:", error);

      res.status(500).json({
        error: "Unable to read live trips.",
      });
    }
  });

  app.delete("/api/trips/:driverId", requireRole("admin"), async (req, res) => {
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
      safeLog("Delete live trip failed:", error);
      res.status(500).json({ ok: false, error: "Unable to remove the driver's live location." });
    }
  });

  app.put("/api/trips/:driverId", requireRole("driver", "admin"), async (req, res) => {
    const driverId = String(req.params.driverId || "").trim();
    const incomingTrip = req.body;
    const authUser = res.locals.authUser as AuthUser;
    if (authUser.role === "driver" && authUser.id !== driverId) return res.status(403).json({ ok: false, error: "Drivers may update only their own live trip." });

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
      const accountRows = await sql`SELECT id FROM datscogo_accounts WHERE id = ${driverId} AND role = 'driver' AND active = TRUE LIMIT 1`;
      const driverIsActive = Boolean(accountRows[0]);

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
      safeLog("Write trip failed:", error);
      res.status(500).json({ ok: false, error: "Unable to save live trip." });
    }
  });

  app.patch("/api/trips/:driverId/safety", requireRole("driver", "admin"), async (req, res) => {
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
      safeLog("Trip safety action failed:", error);
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
      safeLog("Driver safety watchdog failed:", error);
    } finally {
      safetyWatchdogRunning = false;
    }
  };

  const safetyWatchdogTimer = setInterval(() => void runSafetyWatchdog(), 2_000);
  void runSafetyWatchdog();

  // --------------------------------------------------
  // DRIVER TRIP HISTORY
  // --------------------------------------------------

  app.get("/api/trip-records", requireRole("admin"), async (_req, res) => {
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
      safeLog("Read trip history failed:", error);
      res.status(500).json({ error: "Unable to read driver trip records." });
    }
  });

  app.delete("/api/trip-records/:tripId", requireRole("admin"), async (req, res) => {
    const tripId = String(req.params.tripId || "").trim();
    if (!tripId) return res.status(400).json({ ok: false, error: "Trip ID is required." });

    try {
      await sql`DELETE FROM datscogo_trip_history WHERE trip_id = ${tripId}`;
      res.json({ ok: true });
    } catch (error) {
      safeLog("Delete trip history failed:", error);
      res.status(500).json({ ok: false, error: "Unable to delete the trip record." });
    }
  });

  app.delete("/api/trip-records", requireRole("admin"), async (_req, res) => {
    try {
      await sql`DELETE FROM datscogo_trip_history`;
      res.json({ ok: true });
    } catch (error) {
      safeLog("Delete all trip history failed:", error);
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
  safeLog("DatscoGo startup failed:", error);
  process.exit(1);
});