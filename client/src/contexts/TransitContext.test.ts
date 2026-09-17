import { describe, expect, it } from 'vitest';
import { getArrivalLocation, getRoutePassingPoints, getRoutesUsingTerminal, isTripLocationStale, replaceDriverActiveTrip, type ActiveTrip, type Terminal, type TransitRoute } from './TransitContext';

const route = (id: string, originTerminalId: string, destinationTerminalId: string): TransitRoute => ({
  id,
  title: `Route ${id}`,
  origin: 'Renamed terminal label',
  destination: 'Other terminal label',
  originTerminalId,
  destinationTerminalId,
  type: 'bus',
  fare: 30,
  discountedFare: null,
  eta: '30 mins',
  duration: '30 min',
  available: true,
  coordinates: [[9.7, 126.0], [9.8, 126.1]],
});

describe('getRoutesUsingTerminal', () => {
  it('uses stable terminal IDs rather than mutable terminal display names', () => {
    const routes = [route('1', 'terminal-dapa', 'terminal-general-luna'), route('2', 'terminal-del-carmen', 'terminal-dapa')];

    expect(getRoutesUsingTerminal(routes, 'terminal-dapa').map((item) => item.id)).toEqual(['1', '2']);
    expect(getRoutesUsingTerminal(routes, 'terminal-general-luna').map((item) => item.id)).toEqual(['1']);
    expect(getRoutesUsingTerminal(routes, 'terminal-missing')).toEqual([]);
  });
});

describe('getRoutePassingPoints', () => {
  it('returns only named administrator-defined passing points in travel order', () => {
    const plannedRoute: TransitRoute = {
      ...route('planned', 'terminal-dapa', 'terminal-general-luna'),
      waypoints: [
        { id: 'point-1', latitude: 9.77, longitude: 126.1, label: 'Dapa–General Luna road' },
        { id: 'point-2', latitude: 9.78, longitude: 126.13, label: '  Catangnan junction  ' },
        { id: 'point-3', latitude: 9.79, longitude: 126.15, label: ' ' },
      ],
    };

    expect(getRoutePassingPoints(plannedRoute)).toEqual(['Dapa–General Luna road', 'Catangnan junction']);
  });
});

describe('getArrivalLocation', () => {
  it('moves an arrived vehicle to the destination terminal rather than retaining its previous live location', () => {
    const routes = [route('dapa-to-general-luna', 'terminal-dapa', 'terminal-general-luna')];
    const terminals: Terminal[] = [
      { id: 'terminal-dapa', name: 'Dapa Terminal', details: '', latitude: 9.7578, longitude: 126.0689 },
      { id: 'terminal-general-luna', name: 'General Luna Terminal', details: '', latitude: 9.7895, longitude: 126.1554 },
    ];
    const activeTrip: ActiveTrip = { id: 'trip-1', driverId: 'driver-1', routeId: 'dapa-to-general-luna', status: 'departed', latitude: 9.77, longitude: 126.1, lastUpdated: 0 };

    expect(getArrivalLocation(activeTrip, routes, terminals)).toEqual({ latitude: 9.7895, longitude: 126.1554 });
  });
});

describe('isTripLocationStale', () => {
  it('flags only departed vehicles whose last update is older than the freshness window', () => {
    const liveTrip: ActiveTrip = { id: 'trip-live', driverId: 'driver-1', routeId: 'route-1', status: 'departed', latitude: 9.7, longitude: 126, lastUpdated: 100_000 };
    const arrivedTrip: ActiveTrip = { ...liveTrip, id: 'trip-arrived', status: 'arrived', lastUpdated: 0 };

    expect(isTripLocationStale(liveTrip, 159_999)).toBe(false);
    expect(isTripLocationStale(liveTrip, 160_001)).toBe(true);
    expect(isTripLocationStale(arrivedTrip, 160_001)).toBe(false);
  });
});

describe('replaceDriverActiveTrip', () => {
  it('keeps separate driver trips while replacing only the trip for the matching driver', () => {
    const driverOneTrip: ActiveTrip = { id: 'trip-1', driverId: 'driver-1', routeId: 'route-1', status: 'departed', latitude: 9.7, longitude: 126, lastUpdated: 1 };
    const driverTwoTrip: ActiveTrip = { id: 'trip-2', driverId: 'driver-2', routeId: 'route-2', status: 'departed', latitude: 9.8, longitude: 126.1, lastUpdated: 1 };
    const replacementTrip: ActiveTrip = { ...driverOneTrip, id: 'trip-3', routeId: 'route-3', lastUpdated: 2 };

    expect(replaceDriverActiveTrip([driverOneTrip, driverTwoTrip], replacementTrip)).toEqual([driverTwoTrip, replacementTrip]);
  });
});
