export type LatLngPoint = [number, number];

export interface RoadRouteResult {
  points: LatLngPoint[];
  distanceMeters: number | null;
  durationSeconds: number | null;
}

interface FetchRoadRouteOptions {
  signal?: AbortSignal;
  alternatives?: boolean;
  prefer?: 'shortest' | 'fastest';
}

interface OsrmRoute {
  distance?: number;
  duration?: number;
  geometry?: { coordinates?: [number, number][] };
}

interface OsrmResponse {
  code?: string;
  routes?: OsrmRoute[];
}

/**
 * Resolve an ordered set of map points onto the drivable road network.
 * OSRM snaps each supplied point to the nearest routable road and returns
 * road-following geometry instead of simply connecting points with straight lines.
 */
export async function fetchRoadRoute(
  points: LatLngPoint[],
  options: FetchRoadRouteOptions = {},
): Promise<RoadRouteResult> {
  if (points.length < 2) throw new Error('At least two route points are required.');

  const coordinates = points
    .map(([latitude, longitude]) => `${longitude},${latitude}`)
    .join(';');
  const params = new URLSearchParams({
    overview: 'full',
    geometries: 'geojson',
    steps: 'false',
    alternatives: options.alternatives ? 'true' : 'false',
  });

  const response = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${coordinates}?${params.toString()}`,
    { signal: options.signal },
  );

  if (!response.ok) throw new Error(`Road routing service returned ${response.status}.`);

  const data = await response.json() as OsrmResponse;
  const validRoutes = (data.routes ?? []).filter((route) => (route.geometry?.coordinates?.length ?? 0) >= 2);
  if (data.code !== 'Ok' || validRoutes.length === 0) throw new Error('No drivable road route was found.');

  const preference = options.prefer ?? 'fastest';
  const selected = [...validRoutes].sort((a, b) => {
    const aValue = preference === 'shortest' ? (a.distance ?? Number.POSITIVE_INFINITY) : (a.duration ?? Number.POSITIVE_INFINITY);
    const bValue = preference === 'shortest' ? (b.distance ?? Number.POSITIVE_INFINITY) : (b.duration ?? Number.POSITIVE_INFINITY);
    return aValue - bValue;
  })[0];

  return {
    points: selected.geometry!.coordinates!.map(([longitude, latitude]) => [latitude, longitude]),
    distanceMeters: typeof selected.distance === 'number' ? selected.distance : null,
    durationSeconds: typeof selected.duration === 'number' ? selected.duration : null,
  };
}
