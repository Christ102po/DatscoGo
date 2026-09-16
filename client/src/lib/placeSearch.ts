import type { SearchPlace, Snapshot, TransitRoute } from "../types/datsco";

function normalized(value: string) {
  return value.trim().toLocaleLowerCase();
}

export function buildSearchPlaces(data: Snapshot): SearchPlace[] {
  const byKey = new Map<string, SearchPlace>();

  for (const terminal of data.terminals) {
    const routeIds = data.routes
      .filter((route) => route.active && (route.fromTerminalId === terminal.id || route.toTerminalId === terminal.id))
      .map((route) => route.id);
    const key = `terminal:${terminal.id}`;
    byKey.set(key, {
      key,
      kind: "terminal",
      name: terminal.name,
      subtitle: terminal.address || "Terminal",
      lat: terminal.lat,
      lng: terminal.lng,
      terminalId: terminal.id,
      routeIds,
    });
  }

  for (const route of data.routes.filter((item) => item.active)) {
    for (const place of route.places || []) {
      const dedupe = `place:${normalized(place.name)}:${place.lat.toFixed(5)}:${place.lng.toFixed(5)}`;
      const existing = byKey.get(dedupe);
      if (existing) {
        if (!existing.routeIds.includes(route.id)) existing.routeIds.push(route.id);
        continue;
      }
      byKey.set(dedupe, {
        key: dedupe,
        kind: "route-place",
        name: place.name,
        subtitle: place.barangay || place.note || `Along ${route.name}`,
        lat: place.lat,
        lng: place.lng,
        routeIds: [route.id],
      });
    }
  }

  return Array.from(byKey.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function searchPlaces(all: SearchPlace[], query: string, limit = 8): SearchPlace[] {
  const q = normalized(query);
  if (!q) return all.slice(0, limit);
  return all
    .filter((place) => normalized(`${place.name} ${place.subtitle}`).includes(q))
    .sort((a, b) => {
      const an = normalized(a.name);
      const bn = normalized(b.name);
      const aStarts = an.startsWith(q) ? 0 : 1;
      const bStarts = bn.startsWith(q) ? 0 : 1;
      return aStarts - bStarts || a.name.localeCompare(b.name);
    })
    .slice(0, limit);
}

export function routesForPlace(data: Snapshot, place: SearchPlace): TransitRoute[] {
  return place.routeIds
    .map((id) => data.routes.find((route) => route.id === id))
    .filter((route): route is TransitRoute => Boolean(route && route.active));
}

export function activeTripsForPlace(data: Snapshot, place: SearchPlace) {
  const routeIds = new Set(place.routeIds);
  return data.currentTrips.filter((trip) => trip.status === "active" && routeIds.has(trip.routeId));
}
