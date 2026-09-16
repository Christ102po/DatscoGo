import { Capacitor, registerPlugin } from "@capacitor/core";
import type { BackgroundGeolocationPlugin, Location } from "@capacitor-community/background-geolocation";
import { LocalNotifications } from "@capacitor/local-notifications";
import { sendDriverLocationNative, type DriverAuth } from "./api";
import type { LatLng } from "../types/datsco";

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>("BackgroundGeolocation");

export type LiveLocation = LatLng & {
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  time: number;
};

type TrackingHandlers = {
  onLocation?: (location: LiveLocation) => void;
  onStatus?: (message: string) => void;
  onError?: (message: string) => void;
};

type TrackingSession = DriverAuth & { tripId: string };

let nativeWatcherId: string | null = null;
let browserWatcherId: number | null = null;
let activeSession: TrackingSession | null = null;
let lastSent: { lat: number; lng: number; at: number } | null = null;

const SESSION_KEY = "datscogo_active_trip_session";

function metersBetween(a: LatLng, b: LatLng) {
  const r = 6_371_000;
  const p1 = (a.lat * Math.PI) / 180;
  const p2 = (b.lat * Math.PI) / 180;
  const dp = ((b.lat - a.lat) * Math.PI) / 180;
  const dl = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

function normalizeLocation(location: Location | GeolocationPosition): LiveLocation {
  if ("coords" in location) {
    return {
      lat: location.coords.latitude,
      lng: location.coords.longitude,
      accuracy: Number.isFinite(location.coords.accuracy) ? location.coords.accuracy : null,
      heading: Number.isFinite(location.coords.heading) ? location.coords.heading : null,
      speed: Number.isFinite(location.coords.speed) ? location.coords.speed : null,
      time: location.timestamp || Date.now(),
    };
  }
  return {
    lat: location.latitude,
    lng: location.longitude,
    accuracy: typeof location.accuracy === "number" && Number.isFinite(location.accuracy) ? location.accuracy : null,
    heading: typeof location.bearing === "number" && Number.isFinite(location.bearing) ? location.bearing : null,
    speed: typeof location.speed === "number" && Number.isFinite(location.speed) ? location.speed : null,
    time: typeof location.time === "number" && Number.isFinite(location.time) ? location.time : Date.now(),
  };
}

async function maybeSend(location: LiveLocation, handlers: TrackingHandlers) {
  if (!activeSession) return;
  const previous = lastSent;
  const moved = previous ? metersBetween(previous, location) : Number.POSITIVE_INFINITY;
  const elapsed = previous ? Date.now() - previous.at : Number.POSITIVE_INFINITY;
  if (moved < 5 && elapsed < 10_000) return;

  await sendDriverLocationNative({
    ...activeSession,
    lat: location.lat,
    lng: location.lng,
    accuracy: location.accuracy,
    heading: location.heading,
    speed: location.speed,
  });
  lastSent = { lat: location.lat, lng: location.lng, at: Date.now() };
  handlers.onLocation?.(location);
  handlers.onStatus?.(`Live GPS updated ${new Date().toLocaleTimeString()}.`);
}

export function saveActiveTripSession(session: TrackingSession | null) {
  activeSession = session;
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(SESSION_KEY);
}

export function getSavedActiveTripSession(): TrackingSession | null {
  try {
    const value = localStorage.getItem(SESSION_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value);
    if (!parsed?.driverId || !parsed?.accessCode || !parsed?.tripId) return null;
    return parsed as TrackingSession;
  } catch {
    return null;
  }
}

export async function getFreshCurrentLocation(): Promise<LiveLocation> {
  if (Capacitor.isNativePlatform()) {
    return new Promise<LiveLocation>((resolve, reject) => {
      let last: Location | null = null;
      let watcherId = "";
      const timeout = window.setTimeout(async () => {
        if (watcherId) await BackgroundGeolocation.removeWatcher({ id: watcherId }).catch(() => undefined);
        if (last) resolve(normalizeLocation(last));
        else reject(new Error("Could not get the current GPS location."));
      }, 7000);
      BackgroundGeolocation.addWatcher(
        { requestPermissions: true, stale: false, distanceFilter: 0 },
        async (location, error) => {
          if (error) {
            window.clearTimeout(timeout);
            if (watcherId) await BackgroundGeolocation.removeWatcher({ id: watcherId }).catch(() => undefined);
            reject(new Error(error.message || "Location permission is required."));
            return;
          }
          if (!location) return;
          last = location;
          if (location.accuracy != null && location.accuracy <= 50) {
            window.clearTimeout(timeout);
            if (watcherId) await BackgroundGeolocation.removeWatcher({ id: watcherId }).catch(() => undefined);
            resolve(normalizeLocation(location));
          }
        },
      ).then((id) => { watcherId = id; }).catch((error) => {
        window.clearTimeout(timeout);
        reject(error);
      });
    });
  }

  if (!navigator.geolocation) throw new Error("GPS is not supported on this device.");
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(normalizeLocation(position)),
      (error) => reject(new Error(error.message || "Location permission is required.")),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
    );
  });
}

export async function startBackgroundTracking(session: TrackingSession, handlers: TrackingHandlers = {}) {
  await stopBackgroundTracking(false);
  activeSession = session;
  saveActiveTripSession(session);
  lastSent = null;

  if (Capacitor.isNativePlatform()) {
    try {
      await LocalNotifications.requestPermissions();
    } catch {
      // Notification permission is useful for Android 13+, but tracking can still attempt to start.
    }

    nativeWatcherId = await BackgroundGeolocation.addWatcher(
      {
        backgroundMessage: "DatscoGo is sharing this driver's live trip location.",
        backgroundTitle: "DatscoGo trip is active",
        requestPermissions: true,
        stale: false,
        distanceFilter: 5,
      },
      (location, error) => {
        if (error) {
          handlers.onError?.(error.message || "Background GPS error.");
          return;
        }
        if (!location) return;
        const normalized = normalizeLocation(location);
        handlers.onLocation?.(normalized);
        maybeSend(normalized, handlers).catch((sendError) => {
          handlers.onError?.(sendError instanceof Error ? sendError.message : "Could not send GPS location.");
        });
      },
    );
    handlers.onStatus?.("Background trip tracking is active. You may minimize or lock the phone.");
    return;
  }

  if (!navigator.geolocation) throw new Error("GPS is not supported on this device.");
  browserWatcherId = navigator.geolocation.watchPosition(
    (position) => {
      const normalized = normalizeLocation(position);
      handlers.onLocation?.(normalized);
      maybeSend(normalized, handlers).catch((error) => {
        handlers.onError?.(error instanceof Error ? error.message : "Could not send GPS location.");
      });
    },
    (error) => handlers.onError?.(error.message || "GPS permission is required."),
    { enableHighAccuracy: true, maximumAge: 3000, timeout: 15_000 },
  );
  handlers.onStatus?.("Trip tracking is active while this browser/PWA remains running.");
}

export async function stopBackgroundTracking(clearSession = true) {
  if (nativeWatcherId) {
    await BackgroundGeolocation.removeWatcher({ id: nativeWatcherId }).catch(() => undefined);
    nativeWatcherId = null;
  }
  if (browserWatcherId != null) {
    navigator.geolocation?.clearWatch(browserWatcherId);
    browserWatcherId = null;
  }
  lastSent = null;
  if (clearSession) saveActiveTripSession(null);
}

export function isNativeBackgroundTrackingSupported() {
  return Capacitor.isNativePlatform();
}
