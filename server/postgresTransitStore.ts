import pg, { type PoolClient } from "pg";

const { Pool } = pg;

export type PublicTransitState = {
  routes: unknown[];
  schedules: unknown[];
  terminals: unknown[];
  announcements: unknown[];
  contact: { facebook: string; phone: string; email: string };
  initialized?: boolean;
};

export type ActiveTripRecord = {
  id: string;
  driverId: string;
  routeId: string;
  status: "idle" | "departed" | "arrived";
  latitude: number;
  longitude: number;
  lastUpdated: number;
};

const connectionString = process.env.DATABASE_URL;

export const pool = connectionString
  ? new Pool({
      connectionString,
      max: Number(process.env.PG_POOL_MAX || 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ...(process.env.DATABASE_SSL === "true" ? { ssl: { rejectUnauthorized: false } } : {}),
    })
  : null;

function requirePool() {
  if (!pool) {
    throw new Error("DATABASE_URL is not configured. Add the Render PostgreSQL Internal Database URL to DATABASE_URL.");
  }
  return pool;
}

export async function initPostgresTransitStore(): Promise<void> {
  const db = requirePool();
  await db.query(`
    CREATE TABLE IF NOT EXISTS transit_routes (
      id TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS transit_schedules (
      id TEXT PRIMARY KEY,
      route_id TEXT,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS transit_terminals (
      id TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS transit_announcements (
      id TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      created_at BIGINT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );


    CREATE TABLE IF NOT EXISTS transit_meta (
      singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
      initialized BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS transit_contact (
      singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
      facebook TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS driver_trips (
      id TEXT PRIMARY KEY,
      driver_id TEXT NOT NULL,
      route_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('idle', 'departed', 'arrived')),
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      last_updated BIGINT NOT NULL,
      started_at BIGINT NOT NULL,
      arrived_at BIGINT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS driver_trips_driver_idx
      ON driver_trips (driver_id, last_updated DESC);

    CREATE INDEX IF NOT EXISTS driver_trips_status_idx
      ON driver_trips (status, last_updated DESC);

    CREATE TABLE IF NOT EXISTS driver_trip_locations (
      id BIGSERIAL PRIMARY KEY,
      trip_id TEXT NOT NULL REFERENCES driver_trips(id) ON DELETE CASCADE,
      driver_id TEXT NOT NULL,
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      recorded_at BIGINT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS driver_trip_locations_trip_idx
      ON driver_trip_locations (trip_id, recorded_at);
  `);

  await db.query(`
    INSERT INTO transit_meta (singleton, initialized)
    VALUES (TRUE, FALSE)
    ON CONFLICT (singleton) DO NOTHING;

    INSERT INTO transit_contact (singleton, facebook, phone, email)
    VALUES (TRUE, '', '', '')
    ON CONFLICT (singleton) DO NOTHING;
  `);
}

function arrayValue(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function publicStateInput(input: any): PublicTransitState {
  const contact = input?.contact && typeof input.contact === "object" ? input.contact : {};
  return {
    routes: arrayValue(input?.routes),
    schedules: arrayValue(input?.schedules),
    terminals: arrayValue(input?.terminals),
    announcements: arrayValue(input?.announcements),
    contact: {
      facebook: String(contact.facebook ?? "").slice(0, 500),
      phone: String(contact.phone ?? "").slice(0, 120),
      email: String(contact.email ?? "").slice(0, 320),
    },
  };
}

export async function getPublicTransitState(): Promise<PublicTransitState> {
  const db = requirePool();
  const [routes, schedules, terminals, announcements, contact, meta] = await Promise.all([
    db.query(`SELECT payload FROM transit_routes ORDER BY updated_at, id`),
    db.query(`SELECT payload FROM transit_schedules ORDER BY updated_at, id`),
    db.query(`SELECT payload FROM transit_terminals ORDER BY updated_at, id`),
    db.query(`SELECT payload FROM transit_announcements ORDER BY created_at DESC, id`),
    db.query(`SELECT facebook, phone, email FROM transit_contact WHERE singleton = TRUE LIMIT 1`),
    db.query(`SELECT initialized FROM transit_meta WHERE singleton = TRUE LIMIT 1`),
  ]);

  return {
    routes: routes.rows.map((row) => row.payload),
    schedules: schedules.rows.map((row) => row.payload),
    terminals: terminals.rows.map((row) => row.payload),
    announcements: announcements.rows.map((row) => row.payload),
    contact: contact.rows[0] ?? { facebook: "", phone: "", email: "" },
    initialized: Boolean(meta.rows[0]?.initialized),
  };
}

async function replaceJsonRows(
  client: PoolClient,
  table: "transit_routes" | "transit_schedules" | "transit_terminals" | "transit_announcements",
  items: any[],
) {
  await client.query(`DELETE FROM ${table}`);
  for (const item of items) {
    const id = String(item?.id ?? "").trim();
    if (!id) continue;
    if (table === "transit_schedules") {
      await client.query(
        `INSERT INTO transit_schedules (id, route_id, payload, updated_at) VALUES ($1, $2, $3::jsonb, NOW())`,
        [id, item?.routeId ? String(item.routeId) : null, JSON.stringify(item)],
      );
    } else if (table === "transit_announcements") {
      await client.query(
        `INSERT INTO transit_announcements (id, payload, created_at, updated_at) VALUES ($1, $2::jsonb, $3, NOW())`,
        [id, JSON.stringify(item), Number.isFinite(Number(item?.createdAt)) ? Number(item.createdAt) : 0],
      );
    } else {
      await client.query(
        `INSERT INTO ${table} (id, payload, updated_at) VALUES ($1, $2::jsonb, NOW())`,
        [id, JSON.stringify(item)],
      );
    }
  }
}

export async function replacePublicTransitState(input: unknown): Promise<PublicTransitState> {
  const state = publicStateInput(input);
  const db = requirePool();
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await replaceJsonRows(client, "transit_routes", state.routes);
    await replaceJsonRows(client, "transit_schedules", state.schedules);
    await replaceJsonRows(client, "transit_terminals", state.terminals);
    await replaceJsonRows(client, "transit_announcements", state.announcements);
    await client.query(
      `INSERT INTO transit_contact (singleton, facebook, phone, email, updated_at)
       VALUES (TRUE, $1, $2, $3, NOW())
       ON CONFLICT (singleton) DO UPDATE SET
         facebook = EXCLUDED.facebook,
         phone = EXCLUDED.phone,
         email = EXCLUDED.email,
         updated_at = NOW()`,
      [state.contact.facebook, state.contact.phone, state.contact.email],
    );
    await client.query(`
      INSERT INTO transit_meta (singleton, initialized, updated_at)
      VALUES (TRUE, TRUE, NOW())
      ON CONFLICT (singleton) DO UPDATE SET initialized = TRUE, updated_at = NOW()
    `);
    await client.query("COMMIT");
    return state;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function normalizeTrip(driverIdFromPath: string, input: any): ActiveTripRecord {
  const id = String(input?.id ?? "").trim();
  const driverId = String(input?.driverId ?? driverIdFromPath).trim();
  const routeId = String(input?.routeId ?? "").trim();
  const status = String(input?.status ?? "") as ActiveTripRecord["status"];
  const latitude = Number(input?.latitude);
  const longitude = Number(input?.longitude);
  const lastUpdated = Number(input?.lastUpdated);

  if (!id || !driverId || !routeId) throw new Error("Trip id, driver id, and route id are required.");
  if (driverId !== driverIdFromPath) throw new Error("Trip driver does not match the requested driver.");
  if (!["idle", "departed", "arrived"].includes(status)) throw new Error("Invalid trip status.");
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw new Error("Invalid trip latitude.");
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new Error("Invalid trip longitude.");
  if (!Number.isFinite(lastUpdated) || lastUpdated <= 0) throw new Error("Invalid trip update time.");

  return { id, driverId, routeId, status, latitude, longitude, lastUpdated };
}

export async function upsertTrip(driverId: string, input: unknown): Promise<ActiveTripRecord> {
  const trip = normalizeTrip(driverId, input);
  const db = requirePool();
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO driver_trips
        (id, driver_id, route_id, status, latitude, longitude, last_updated, started_at, arrived_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7, CASE WHEN $4 = 'arrived' THEN $7 ELSE NULL END, NOW())
       ON CONFLICT (id) DO UPDATE SET
         driver_id = EXCLUDED.driver_id,
         route_id = EXCLUDED.route_id,
         status = EXCLUDED.status,
         latitude = EXCLUDED.latitude,
         longitude = EXCLUDED.longitude,
         last_updated = EXCLUDED.last_updated,
         arrived_at = CASE WHEN EXCLUDED.status = 'arrived' THEN EXCLUDED.last_updated ELSE driver_trips.arrived_at END,
         updated_at = NOW()`,
      [trip.id, trip.driverId, trip.routeId, trip.status, trip.latitude, trip.longitude, trip.lastUpdated],
    );

    const previous = await client.query(
      `SELECT latitude, longitude, recorded_at
       FROM driver_trip_locations
       WHERE trip_id = $1
       ORDER BY recorded_at DESC
       LIMIT 1`,
      [trip.id],
    );
    const row = previous.rows[0];
    const shouldRecord = !row
      || Number(row.latitude) !== trip.latitude
      || Number(row.longitude) !== trip.longitude
      || Number(row.recorded_at) !== trip.lastUpdated;

    if (shouldRecord) {
      await client.query(
        `INSERT INTO driver_trip_locations (trip_id, driver_id, latitude, longitude, recorded_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [trip.id, trip.driverId, trip.latitude, trip.longitude, trip.lastUpdated],
      );
    }
    await client.query("COMMIT");
    return trip;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function rowToTrip(row: any): ActiveTripRecord {
  return {
    id: String(row.id),
    driverId: String(row.driver_id),
    routeId: String(row.route_id),
    status: row.status as ActiveTripRecord["status"],
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    lastUpdated: Number(row.last_updated),
  };
}

export async function getCurrentTrips(): Promise<ActiveTripRecord[]> {
  const db = requirePool();
  const result = await db.query(`
    SELECT DISTINCT ON (driver_id)
      id, driver_id, route_id, status, latitude, longitude, last_updated
    FROM driver_trips
    ORDER BY driver_id, last_updated DESC
  `);
  return result.rows.map(rowToTrip);
}

export async function getTripHistory(): Promise<ActiveTripRecord[]> {
  const db = requirePool();
  const result = await db.query(`
    SELECT id, driver_id, route_id, status, latitude, longitude, last_updated
    FROM driver_trips
    ORDER BY started_at DESC, last_updated DESC
  `);
  return result.rows.map(rowToTrip);
}

export async function databaseHealth(): Promise<boolean> {
  if (!pool) return false;
  await pool.query("SELECT 1");
  return true;
}
