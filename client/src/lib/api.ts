import { Capacitor, CapacitorHttp } from "@capacitor/core";
import type { Driver, DriverTrip, DriverTripResponse, Snapshot } from "../types/datsco";

const API_BASE = String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (API_BASE) return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  return path;
}

async function parse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${response.status}).`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function jsonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  return parse<T>(await fetch(apiUrl(path), { cache: "no-store", ...init }));
}

export async function getSnapshot(): Promise<Snapshot> {
  return jsonFetch<Snapshot>("/api/datsco/snapshot");
}

export function openLiveUpdates(
  onSnapshot: (snapshot: Snapshot) => void,
  onDriver: (driver: Driver, trip?: DriverTrip) => void,
  onTrip?: (trip: DriverTrip, driver: Driver) => void,
) {
  const source = new EventSource(apiUrl("/api/datsco/live"));
  source.addEventListener("snapshot", (event) => {
    onSnapshot(JSON.parse((event as MessageEvent).data));
  });
  source.addEventListener("driver-location", (event) => {
    const payload = JSON.parse((event as MessageEvent).data) as DriverTripResponse;
    onDriver(payload.driver, payload.trip);
  });
  source.addEventListener("trip-started", (event) => {
    const payload = JSON.parse((event as MessageEvent).data) as DriverTripResponse;
    onTrip?.(payload.trip, payload.driver);
  });
  source.addEventListener("trip-arrived", (event) => {
    const payload = JSON.parse((event as MessageEvent).data) as DriverTripResponse;
    onTrip?.(payload.trip, payload.driver);
  });
  return source;
}

function adminHeaders(adminKey: string) {
  return {
    "Content-Type": "application/json",
    "x-admin-key": adminKey,
  };
}

export async function verifyAdmin(adminKey: string) {
  return jsonFetch<{ ok: true }>("/api/datsco/admin/verify", {
    headers: { "x-admin-key": adminKey },
  });
}

export async function adminCreate<T>(resource: string, adminKey: string, body: unknown): Promise<T> {
  return jsonFetch<T>(`/api/datsco/admin/${resource}`, {
    method: "POST",
    headers: adminHeaders(adminKey),
    body: JSON.stringify(body),
  });
}

export async function adminUpdate<T>(resource: string, id: string, adminKey: string, body: unknown): Promise<T> {
  return jsonFetch<T>(`/api/datsco/admin/${resource}/${id}`, {
    method: "PUT",
    headers: adminHeaders(adminKey),
    body: JSON.stringify(body),
  });
}

export async function adminDelete(resource: string, id: string, adminKey: string): Promise<void> {
  await jsonFetch<void>(`/api/datsco/admin/${resource}/${id}`, {
    method: "DELETE",
    headers: { "x-admin-key": adminKey },
  });
}

export async function getAdminTrips(adminKey: string): Promise<DriverTrip[]> {
  return jsonFetch<DriverTrip[]>("/api/datsco/admin/trips", {
    headers: { "x-admin-key": adminKey },
  });
}

export async function clearAll(adminKey: string): Promise<void> {
  await jsonFetch("/api/datsco/admin/clear", {
    method: "POST",
    headers: { "x-admin-key": adminKey },
  });
}

export type DriverAuth = {
  driverId: string;
  accessCode: string;
};

export type DriverLocationPayload = DriverAuth & {
  tripId?: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
};

export async function startDriverTrip(body: DriverLocationPayload & { routeId?: string }): Promise<DriverTripResponse> {
  return jsonFetch<DriverTripResponse>("/api/datsco/driver-trip/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function sendDriverLocation(body: DriverLocationPayload): Promise<DriverTripResponse> {
  return jsonFetch<DriverTripResponse>("/api/datsco/driver-location", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function arriveDriverTrip(body: DriverLocationPayload): Promise<DriverTripResponse> {
  return jsonFetch<DriverTripResponse>("/api/datsco/driver-trip/arrive", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * Native-safe POST used by the background location watcher.
 * CapacitorHttp avoids Android WebView request throttling while the app is backgrounded.
 */
export async function sendDriverLocationNative(body: DriverLocationPayload): Promise<DriverTripResponse> {
  if (!Capacitor.isNativePlatform()) return sendDriverLocation(body);
  const url = apiUrl("/api/datsco/driver-location");
  if (!/^https?:\/\//i.test(url)) {
    throw new Error("Set VITE_API_BASE_URL to your Render HTTPS URL before building the Android app.");
  }
  const response = await CapacitorHttp.post({
    url,
    headers: { "Content-Type": "application/json" },
    data: body,
  });
  if (response.status < 200 || response.status >= 300) {
    const message = response.data?.error || `Location update failed (${response.status}).`;
    throw new Error(message);
  }
  return response.data as DriverTripResponse;
}
