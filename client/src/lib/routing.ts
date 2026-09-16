import type { LatLng, Terminal, TransitRoute } from "../types/datsco";

const OSRM_BASE = (import.meta.env.VITE_OSRM_URL || "https://router.project-osrm.org").replace(/\/$/, "");

export type RoadRoute = {
  points: LatLng[];
  distanceMeters: number;
  durationSeconds: number;
};

export type RoutePoint = [number, number];

export type FetchRoadRouteOptions = {
  signal?: AbortSignal;
  alternatives?: boolean;
  prefer?: "shortest" | "fastest";
};

export type FetchRoadRouteResult = {
  points: RoutePoint[];
  distanceMeters: number;
  durationSeconds: number;
};

function coords(points: LatLng[]) {
  return points.map((point) => `${point.lng},${point.lat}`).join(";");
}

export async function roadRoute(points: LatLng[]): Promise<RoadRoute> {
  if (points.length < 2) throw new Error("At least two map points are required.");
  const response = await fetch(
    `${OSRM_BASE}/route/v1/driving/${coords(points)}?overview=full&geometries=geojson&steps=false&alternatives=true`,
  );
  if (!response.ok) throw new Error("The road routing service is currently unavailable.");
  const data = await response.json();
  if (data.code !== "Ok" || !data.routes?.length) throw new Error("No drivable road route was found.");
  const route = [...data.routes].sort((a: any, b: any) => Number(a.distance) - Number(b.distance))[0];
  return {
    points: route.geometry.coordinates.map(([lng, lat]: [number, number]) => ({ lat, lng })),
    distanceMeters: route.distance,
    durationSeconds: route.duration,
  };
}

/**
 * Tuple-coordinate version used by the existing map/admin components.
 * Input/output points are [latitude, longitude]. OSRM itself expects lng,lat.
 */
export async function fetchRoadRoute(
  points: RoutePoint[],
  options: FetchRoadRouteOptions = {},
): Promise<FetchRoadRouteResult> {
  if (points.length < 2) throw new Error("At least two map points are required.");

  const routeCoordinates = points
    .map(([latitude, longitude]) => `${longitude},${latitude}`)
    .join(";");
  const alternatives = options.alternatives ?? true;
  const response = await fetch(
    `${OSRM_BASE}/route/v1/driving/${routeCoordinates}?overview=full&geometries=geojson&steps=false&alternatives=${alternatives}`,
    { signal: options.signal },
  );

  if (!response.ok) throw new Error("The road routing service is currently unavailable.");
  const data = await response.json();
  if (data.code !== "Ok" || !Array.isArray(data.routes) || data.routes.length === 0) {
    throw new Error("No drivable road route was found.");
  }

  const availableRoutes = data.routes as Array<{
    distance: number;
    duration: number;
    geometry: { coordinates: Array<[number, number]> };
  }>;
  const route = options.prefer === "shortest"
    ? Array.from(availableRoutes).sort((a, b) => Number(a.distance) - Number(b.distance))[0]
    : availableRoutes[0];

  return {
    points: route.geometry.coordinates.map(([longitude, latitude]) => [latitude, longitude] as RoutePoint),
    distanceMeters: Number(route.distance),
    durationSeconds: Number(route.duration),
  };
}

export function routeControlPoints(route: TransitRoute, terminals: Terminal[]): LatLng[] {
  const from = terminals.find((terminal) => terminal.id === route.fromTerminalId);
  const to = terminals.find((terminal) => terminal.id === route.toTerminalId);
  if (!from || !to) return [];
  const routePlaces = (route.places || []).map(({ lat, lng }) => ({ lat, lng }));
  const middle = route.waypoints?.length ? route.waypoints : routePlaces;
  return [
    { lat: from.lat, lng: from.lng },
    ...middle,
    { lat: to.lat, lng: to.lng },
  ];
}

export function haversineMeters(a: LatLng, b: LatLng): number {
  const r = 6_371_000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

export async function closestTerminalByRoad(origin: LatLng, terminals: Terminal[]): Promise<Terminal> {
  if (!terminals.length) throw new Error("No terminals have been added by the admin yet.");
  try {
    const all = [origin, ...terminals.map((terminal) => ({ lat: terminal.lat, lng: terminal.lng }))];
    const destinations = terminals.map((_, index) => index + 1).join(";");
    const response = await fetch(
      `${OSRM_BASE}/table/v1/driving/${coords(all)}?sources=0&destinations=${destinations}&annotations=duration,distance`,
    );
    if (!response.ok) throw new Error("table failed");
    const data = await response.json();
    const durations: Array<number | null> = data.durations?.[0] || [];
    let bestIndex = -1;
    let bestDuration = Number.POSITIVE_INFINITY;
    durations.forEach((duration, index) => {
      if (typeof duration === "number" && duration < bestDuration) {
        bestDuration = duration;
        bestIndex = index;
      }
    });
    if (bestIndex >= 0) return terminals[bestIndex];
  } catch {
    // Straight-line fallback is only used when OSRM table routing is unavailable.
  }
  return [...terminals].sort((a, b) => haversineMeters(origin, a) - haversineMeters(origin, b))[0];
}

export function formatDistance(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

export function formatDuration(seconds: number) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours} hr${rest ? ` ${rest} min` : ""}`;
}
