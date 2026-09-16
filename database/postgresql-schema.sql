-- DatscoGo PostgreSQL operational schema.
-- The server creates these tables automatically at startup; this file is included
-- as a readable/reference copy for Render/PostgreSQL administration.

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

CREATE INDEX IF NOT EXISTS driver_trips_driver_idx ON driver_trips (driver_id, last_updated DESC);
CREATE INDEX IF NOT EXISTS driver_trips_status_idx ON driver_trips (status, last_updated DESC);

CREATE TABLE IF NOT EXISTS driver_trip_locations (
  id BIGSERIAL PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES driver_trips(id) ON DELETE CASCADE,
  driver_id TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  recorded_at BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS driver_trip_locations_trip_idx ON driver_trip_locations (trip_id, recorded_at);
