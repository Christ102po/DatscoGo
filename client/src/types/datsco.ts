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
  locationHistory?: TripLocation[];
};

export type Snapshot = {
  terminals: Terminal[];
  routes: TransitRoute[];
  schedules: Schedule[];
  drivers: Driver[];
  currentTrips: DriverTrip[];
  serverTime?: string;
};

export type DriverTripResponse = {
  ok: true;
  driver: Driver;
  trip: DriverTrip;
};

export type SearchPlace = {
  key: string;
  kind: "terminal" | "route-place";
  name: string;
  subtitle: string;
  lat: number;
  lng: number;
  terminalId?: string;
  routeIds: string[];
};
