import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type LatLng = { lat: number; lng: number };

export type RoutePlace = LatLng & {
  id: string;
  name: string;
  barangay?: string;
  note?: string;
};

export type Terminal = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  createdAt: string;
  updatedAt: string;
};

export type TransitRoute = {
  id: string;
  name: string;
  fromTerminalId: string;
  toTerminalId: string;
  waypoints: LatLng[];
  places: RoutePlace[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Schedule = {
  id: string;
  routeId: string;
  days: string[];
  departureTime: string;
  arrivalTime: string;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type DriverTripStatus = "idle" | "active" | "arrived";

export type Driver = {
  id: string;
  name: string;
  accessCode: string;
  routeId: string | null;
  activeTripId: string | null;
  tripStatus: DriverTripStatus;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  updatedAt: string | null;
  createdAt: string;
};

export type TripLocation = LatLng & {
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  at: string;
};

export type DriverTrip = {
  id: string;
  driverId: string;
  driverName: string;
  routeId: string;
  routeName: string;
  status: "active" | "arrived" | "cancelled";
  startedAt: string;
  arrivedAt: string | null;
  startLocation: TripLocation;
  lastLocation: TripLocation;
  arrivalLocation: TripLocation | null;
  locationHistory: TripLocation[];
};

export type PublicTrip = Omit<DriverTrip, "locationHistory">;

export type DatscoData = {
  terminals: Terminal[];
  routes: TransitRoute[];
  schedules: Schedule[];
  drivers: Driver[];
  trips: DriverTrip[];
};

const EMPTY_DATA: DatscoData = {
  terminals: [],
  routes: [],
  schedules: [],
  drivers: [],
  trips: [],
};

const dataFile = process.env.DATSCO_DATA_FILE
  ? path.resolve(process.env.DATSCO_DATA_FILE)
  : path.resolve(process.cwd(), "data", "datscogo.json");

let cache: DatscoData | null = null;
let writeQueue: Promise<void> = Promise.resolve();

function finiteNumber(value: unknown, name: string): number {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${name} must be a valid number.`);
  return number;
}

function coordinate(value: unknown, name: string, min: number, max: number): number {
  const number = finiteNumber(value, name);
  if (number < min || number > max) throw new Error(`${name} is out of range.`);
  return number;
}

function text(value: unknown, name: string, max = 180): string {
  const result = String(value ?? "").trim();
  if (!result) throw new Error(`${name} is required.`);
  if (result.length > max) throw new Error(`${name} is too long.`);
  return result;
}

function optionalText(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function nullableNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function now(): string {
  return new Date().toISOString();
}

async function ensureFile(): Promise<void> {
  await fs.mkdir(path.dirname(dataFile), { recursive: true });
  try {
    await fs.access(dataFile);
  } catch {
    await fs.writeFile(dataFile, JSON.stringify(EMPTY_DATA, null, 2), "utf8");
  }
}

function migrate(parsed: Partial<DatscoData>): DatscoData {
  const routes = (Array.isArray(parsed.routes) ? parsed.routes : []).map((route: any) => ({
    ...route,
    waypoints: Array.isArray(route?.waypoints) ? route.waypoints : [],
    places: Array.isArray(route?.places) ? route.places : [],
    active: route?.active !== false,
  }));

  const drivers = (Array.isArray(parsed.drivers) ? parsed.drivers : []).map((driver: any) => ({
    ...driver,
    activeTripId: driver?.activeTripId ?? null,
    tripStatus: driver?.tripStatus === "active" || driver?.tripStatus === "arrived" ? driver.tripStatus : "idle",
  }));

  return {
    terminals: Array.isArray(parsed.terminals) ? parsed.terminals : [],
    routes,
    schedules: Array.isArray(parsed.schedules) ? parsed.schedules : [],
    drivers,
    trips: Array.isArray(parsed.trips) ? parsed.trips : [],
  };
}

export async function loadData(): Promise<DatscoData> {
  if (cache) return cache;
  await ensureFile();
  try {
    const raw = await fs.readFile(dataFile, "utf8");
    cache = migrate(JSON.parse(raw) as Partial<DatscoData>);
  } catch {
    cache = structuredClone(EMPTY_DATA);
    await saveData(cache);
  }
  return cache;
}

async function saveData(data: DatscoData): Promise<void> {
  cache = data;
  writeQueue = writeQueue.then(async () => {
    await ensureFile();
    const temp = `${dataFile}.tmp`;
    await fs.writeFile(temp, JSON.stringify(data, null, 2), "utf8");
    await fs.rename(temp, dataFile);
  });
  await writeQueue;
}

function safeDriver(driver: Driver): Omit<Driver, "accessCode"> {
  const { accessCode: _accessCode, ...safe } = driver;
  return safe;
}

function publicTrip(trip: DriverTrip): PublicTrip {
  const { locationHistory: _locationHistory, ...safe } = trip;
  return safe;
}

function currentPublicTrips(data: DatscoData): PublicTrip[] {
  const active = data.trips.filter((trip) => trip.status === "active");
  const latestArrivedByDriver = new Map<string, DriverTrip>();
  for (const trip of data.trips) {
    if (trip.status !== "arrived") continue;
    const current = latestArrivedByDriver.get(trip.driverId);
    if (!current || new Date(trip.arrivedAt || trip.startedAt).getTime() > new Date(current.arrivedAt || current.startedAt).getTime()) {
      latestArrivedByDriver.set(trip.driverId, trip);
    }
  }
  return active.concat(Array.from(latestArrivedByDriver.values())).map(publicTrip);
}

export function publicSnapshot(data: DatscoData) {
  return {
    terminals: data.terminals,
    routes: data.routes,
    schedules: data.schedules,
    drivers: data.drivers.map(safeDriver),
    currentTrips: currentPublicTrips(data),
    serverTime: now(),
  };
}

export async function getAdminTrips(): Promise<DriverTrip[]> {
  const data = await loadData();
  return [...data.trips].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
}

export async function createTerminal(input: any): Promise<Terminal> {
  const data = await loadData();
  const stamp = now();
  const terminal: Terminal = {
    id: randomUUID(),
    name: text(input.name, "Terminal name"),
    address: optionalText(input.address, 250),
    lat: coordinate(input.lat, "Latitude", -90, 90),
    lng: coordinate(input.lng, "Longitude", -180, 180),
    createdAt: stamp,
    updatedAt: stamp,
  };
  data.terminals.push(terminal);
  await saveData(data);
  return terminal;
}

export async function updateTerminal(id: string, input: any): Promise<Terminal> {
  const data = await loadData();
  const terminal = data.terminals.find((item) => item.id === id);
  if (!terminal) throw new Error("Terminal not found.");
  terminal.name = text(input.name, "Terminal name");
  terminal.address = optionalText(input.address, 250);
  terminal.lat = coordinate(input.lat, "Latitude", -90, 90);
  terminal.lng = coordinate(input.lng, "Longitude", -180, 180);
  terminal.updatedAt = now();
  await saveData(data);
  return terminal;
}

export async function deleteTerminal(id: string): Promise<void> {
  const data = await loadData();
  const deletedRouteIds = new Set(
    data.routes
      .filter((route) => route.fromTerminalId === id || route.toTerminalId === id)
      .map((route) => route.id),
  );
  data.terminals = data.terminals.filter((terminal) => terminal.id !== id);
  data.routes = data.routes.filter((route) => !deletedRouteIds.has(route.id));
  data.schedules = data.schedules.filter((schedule) => !deletedRouteIds.has(schedule.routeId));
  data.drivers.forEach((driver) => {
    if (driver.routeId && deletedRouteIds.has(driver.routeId)) driver.routeId = null;
  });
  await saveData(data);
}

function normalizeWaypoints(value: unknown): LatLng[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 80).map((point: any) => ({
    lat: coordinate(point?.lat, "Waypoint latitude", -90, 90),
    lng: coordinate(point?.lng, "Waypoint longitude", -180, 180),
  }));
}

function normalizePlaces(value: unknown): RoutePlace[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 120).map((place: any) => ({
    id: String(place?.id || randomUUID()),
    name: text(place?.name, "Route place name", 120),
    barangay: optionalText(place?.barangay, 120) || undefined,
    note: optionalText(place?.note, 240) || undefined,
    lat: coordinate(place?.lat, "Route place latitude", -90, 90),
    lng: coordinate(place?.lng, "Route place longitude", -180, 180),
  }));
}

function assertTerminalExists(data: DatscoData, id: string): void {
  if (!data.terminals.some((terminal) => terminal.id === id)) {
    throw new Error("Selected terminal does not exist.");
  }
}

export async function createRoute(input: any): Promise<TransitRoute> {
  const data = await loadData();
  const fromTerminalId = text(input.fromTerminalId, "Starting terminal", 80);
  const toTerminalId = text(input.toTerminalId, "Destination terminal", 80);
  if (fromTerminalId === toTerminalId) throw new Error("A route needs two different terminals.");
  assertTerminalExists(data, fromTerminalId);
  assertTerminalExists(data, toTerminalId);
  const stamp = now();
  const route: TransitRoute = {
    id: randomUUID(),
    name: text(input.name, "Route name"),
    fromTerminalId,
    toTerminalId,
    waypoints: normalizeWaypoints(input.waypoints),
    places: normalizePlaces(input.places),
    active: input.active !== false,
    createdAt: stamp,
    updatedAt: stamp,
  };
  data.routes.push(route);
  await saveData(data);
  return route;
}

export async function updateRoute(id: string, input: any): Promise<TransitRoute> {
  const data = await loadData();
  const route = data.routes.find((item) => item.id === id);
  if (!route) throw new Error("Route not found.");
  const fromTerminalId = text(input.fromTerminalId, "Starting terminal", 80);
  const toTerminalId = text(input.toTerminalId, "Destination terminal", 80);
  if (fromTerminalId === toTerminalId) throw new Error("A route needs two different terminals.");
  assertTerminalExists(data, fromTerminalId);
  assertTerminalExists(data, toTerminalId);
  route.name = text(input.name, "Route name");
  route.fromTerminalId = fromTerminalId;
  route.toTerminalId = toTerminalId;
  route.waypoints = normalizeWaypoints(input.waypoints);
  if (Object.prototype.hasOwnProperty.call(input, "places")) route.places = normalizePlaces(input.places);
  route.active = input.active !== false;
  route.updatedAt = now();
  await saveData(data);
  return route;
}

export async function deleteRoute(id: string): Promise<void> {
  const data = await loadData();
  data.routes = data.routes.filter((route) => route.id !== id);
  data.schedules = data.schedules.filter((schedule) => schedule.routeId !== id);
  data.drivers.forEach((driver) => {
    if (driver.routeId === id) driver.routeId = null;
  });
  await saveData(data);
}

function normalizeDays(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((day) => String(day).trim()).filter(Boolean).slice(0, 7);
}

export async function createSchedule(input: any): Promise<Schedule> {
  const data = await loadData();
  const routeId = text(input.routeId, "Route", 80);
  if (!data.routes.some((route) => route.id === routeId)) throw new Error("Selected route does not exist.");
  const stamp = now();
  const schedule: Schedule = {
    id: randomUUID(),
    routeId,
    days: normalizeDays(input.days),
    departureTime: text(input.departureTime, "Departure time", 20),
    arrivalTime: optionalText(input.arrivalTime, 20),
    note: optionalText(input.note, 250),
    createdAt: stamp,
    updatedAt: stamp,
  };
  data.schedules.push(schedule);
  await saveData(data);
  return schedule;
}

export async function updateSchedule(id: string, input: any): Promise<Schedule> {
  const data = await loadData();
  const schedule = data.schedules.find((item) => item.id === id);
  if (!schedule) throw new Error("Schedule not found.");
  const routeId = text(input.routeId, "Route", 80);
  if (!data.routes.some((route) => route.id === routeId)) throw new Error("Selected route does not exist.");
  schedule.routeId = routeId;
  schedule.days = normalizeDays(input.days);
  schedule.departureTime = text(input.departureTime, "Departure time", 20);
  schedule.arrivalTime = optionalText(input.arrivalTime, 20);
  schedule.note = optionalText(input.note, 250);
  schedule.updatedAt = now();
  await saveData(data);
  return schedule;
}

export async function deleteSchedule(id: string): Promise<void> {
  const data = await loadData();
  data.schedules = data.schedules.filter((schedule) => schedule.id !== id);
  await saveData(data);
}

export async function createDriver(input: any): Promise<Driver> {
  const data = await loadData();
  const routeId = input.routeId ? String(input.routeId) : null;
  if (routeId && !data.routes.some((route) => route.id === routeId)) throw new Error("Selected route does not exist.");
  const driver: Driver = {
    id: randomUUID(),
    name: text(input.name, "Driver name"),
    accessCode: text(input.accessCode, "Driver access code", 80),
    routeId,
    activeTripId: null,
    tripStatus: "idle",
    lat: null,
    lng: null,
    accuracy: null,
    heading: null,
    speed: null,
    updatedAt: null,
    createdAt: now(),
  };
  data.drivers.push(driver);
  await saveData(data);
  return driver;
}

export async function updateDriver(id: string, input: any): Promise<Driver> {
  const data = await loadData();
  const driver = data.drivers.find((item) => item.id === id);
  if (!driver) throw new Error("Driver not found.");
  const routeId = input.routeId ? String(input.routeId) : null;
  if (routeId && !data.routes.some((route) => route.id === routeId)) throw new Error("Selected route does not exist.");
  driver.name = text(input.name, "Driver name");
  if (String(input.accessCode ?? "").trim()) driver.accessCode = text(input.accessCode, "Driver access code", 80);
  driver.routeId = routeId;
  await saveData(data);
  return driver;
}

export async function deleteDriver(id: string): Promise<void> {
  const data = await loadData();
  if (data.trips.some((trip) => trip.driverId === id && trip.status === "active")) {
    throw new Error("This driver has an active trip. Mark the trip as arrived before deleting the driver.");
  }
  data.drivers = data.drivers.filter((driver) => driver.id !== id);
  await saveData(data);
}

function locationFromInput(input: any, fallback?: Driver): TripLocation {
  const lat = input?.lat != null ? coordinate(input.lat, "Latitude", -90, 90) : fallback?.lat;
  const lng = input?.lng != null ? coordinate(input.lng, "Longitude", -180, 180) : fallback?.lng;
  if (lat == null || lng == null) throw new Error("A current GPS location is required.");
  return {
    lat,
    lng,
    accuracy: input?.accuracy != null ? nullableNumber(input.accuracy) : fallback?.accuracy ?? null,
    heading: input?.heading != null ? nullableNumber(input.heading) : fallback?.heading ?? null,
    speed: input?.speed != null ? nullableNumber(input.speed) : fallback?.speed ?? null,
    at: now(),
  };
}

function verifyDriver(data: DatscoData, driverId: string, accessCode: unknown): Driver {
  const driver = data.drivers.find((item) => item.id === driverId);
  if (!driver) throw new Error("Driver not found.");
  if (driver.accessCode !== String(accessCode ?? "")) throw new Error("Invalid driver access code.");
  return driver;
}

function distanceMeters(a: LatLng, b: LatLng): number {
  const r = 6_371_000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

export async function startDriverTrip(input: any): Promise<{ driver: Omit<Driver, "accessCode">; trip: PublicTrip }> {
  const data = await loadData();
  const driverId = text(input.driverId, "Driver", 80);
  const driver = verifyDriver(data, driverId, input.accessCode);
  if (driver.activeTripId) {
    const existing = data.trips.find((trip) => trip.id === driver.activeTripId && trip.status === "active");
    if (existing) return { driver: safeDriver(driver), trip: publicTrip(existing) };
    driver.activeTripId = null;
  }
  const routeId = String(input.routeId || driver.routeId || "").trim();
  if (!routeId) throw new Error("This driver does not have a route assigned.");
  const route = data.routes.find((item) => item.id === routeId && item.active);
  if (!route) throw new Error("The assigned route is not available.");

  const startLocation = locationFromInput(input, driver);
  const trip: DriverTrip = {
    id: randomUUID(),
    driverId: driver.id,
    driverName: driver.name,
    routeId: route.id,
    routeName: route.name,
    status: "active",
    startedAt: startLocation.at,
    arrivedAt: null,
    startLocation,
    lastLocation: startLocation,
    arrivalLocation: null,
    locationHistory: [startLocation],
  };

  driver.routeId = route.id;
  driver.activeTripId = trip.id;
  driver.tripStatus = "active";
  driver.lat = startLocation.lat;
  driver.lng = startLocation.lng;
  driver.accuracy = startLocation.accuracy;
  driver.heading = startLocation.heading;
  driver.speed = startLocation.speed;
  driver.updatedAt = startLocation.at;
  data.trips.push(trip);
  await saveData(data);
  return { driver: safeDriver(driver), trip: publicTrip(trip) };
}

export async function updateDriverLocation(input: any): Promise<{ driver: Omit<Driver, "accessCode">; trip: PublicTrip }> {
  const data = await loadData();
  const driverId = text(input.driverId, "Driver", 80);
  const driver = verifyDriver(data, driverId, input.accessCode);
  const trip = data.trips.find((item) => item.id === driver.activeTripId && item.status === "active");
  if (!trip) throw new Error("Start Departure before sharing live location.");
  if (input.tripId && String(input.tripId) !== trip.id) throw new Error("This location update belongs to a different trip.");

  const location = locationFromInput(input, driver);
  driver.lat = location.lat;
  driver.lng = location.lng;
  driver.accuracy = location.accuracy;
  driver.heading = location.heading;
  driver.speed = location.speed;
  driver.updatedAt = location.at;
  driver.tripStatus = "active";
  trip.lastLocation = location;

  const previous = trip.locationHistory[trip.locationHistory.length - 1];
  const elapsed = previous ? new Date(location.at).getTime() - new Date(previous.at).getTime() : Number.POSITIVE_INFINITY;
  const moved = previous ? distanceMeters(previous, location) : Number.POSITIVE_INFINITY;
  if (!previous || moved >= 8 || elapsed >= 15_000) trip.locationHistory.push(location);
  if (trip.locationHistory.length > 5000) trip.locationHistory.splice(0, trip.locationHistory.length - 5000);

  await saveData(data);
  return { driver: safeDriver(driver), trip: publicTrip(trip) };
}

export async function arriveDriverTrip(input: any): Promise<{ driver: Omit<Driver, "accessCode">; trip: PublicTrip }> {
  const data = await loadData();
  const driverId = text(input.driverId, "Driver", 80);
  const driver = verifyDriver(data, driverId, input.accessCode);
  const trip = data.trips.find((item) => item.id === driver.activeTripId && item.status === "active");
  if (!trip) throw new Error("No active trip was found for this driver.");

  const finalLocation = locationFromInput(input, driver);
  driver.lat = finalLocation.lat;
  driver.lng = finalLocation.lng;
  driver.accuracy = finalLocation.accuracy;
  driver.heading = finalLocation.heading;
  driver.speed = finalLocation.speed;
  driver.updatedAt = finalLocation.at;
  driver.tripStatus = "arrived";
  driver.activeTripId = null;

  trip.status = "arrived";
  trip.arrivedAt = finalLocation.at;
  trip.arrivalLocation = finalLocation;
  trip.lastLocation = finalLocation;
  const previous = trip.locationHistory[trip.locationHistory.length - 1];
  if (!previous || distanceMeters(previous, finalLocation) >= 2 || previous.at !== finalLocation.at) {
    trip.locationHistory.push(finalLocation);
  }

  await saveData(data);
  return { driver: safeDriver(driver), trip: publicTrip(trip) };
}

export async function clearOperationalData(): Promise<void> {
  await saveData(structuredClone(EMPTY_DATA));
}
