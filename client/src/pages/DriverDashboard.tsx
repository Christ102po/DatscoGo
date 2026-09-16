import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Play, Radio } from "lucide-react";
import { DatscoMap } from "../components/DatscoMap";
import { arriveDriverTrip, getSnapshot, openLiveUpdates, startDriverTrip } from "../lib/api";
import {
  getFreshCurrentLocation,
  getSavedActiveTripSession,
  saveActiveTripSession,
  startBackgroundTracking,
  stopBackgroundTracking,
  type LiveLocation,
} from "../lib/driverTracking";
import { roadRoute, routeControlPoints, type RoadRoute } from "../lib/routing";
import type { Driver, DriverTrip, LatLng, Snapshot } from "../types/datsco";

const empty: Snapshot = { terminals: [], routes: [], schedules: [], drivers: [], currentTrips: [] };

function mergeDriver(data: Snapshot, driver: Driver, trip?: DriverTrip): Snapshot {
  const drivers = data.drivers.some((item) => item.id === driver.id)
    ? data.drivers.map((item) => item.id === driver.id ? driver : item)
    : [...data.drivers, driver];
  const currentTrips = trip
    ? (data.currentTrips.some((item) => item.id === trip.id)
      ? data.currentTrips.map((item) => item.id === trip.id ? trip : item)
      : [...data.currentTrips, trip])
    : data.currentTrips;
  return { ...data, drivers, currentTrips };
}

function payloadFromLocation(location: LiveLocation) {
  return {
    lat: location.lat,
    lng: location.lng,
    accuracy: location.accuracy,
    heading: location.heading,
    speed: location.speed,
  };
}

export function DriverDashboard() {
  const [data, setData] = useState<Snapshot>(empty);
  const [driverId, setDriverId] = useState(localStorage.getItem("datsco_driver_id") || "");
  const [accessCode, setAccessCode] = useState(localStorage.getItem("datsco_driver_code") || "");
  const [tracking, setTracking] = useState(false);
  const [position, setPosition] = useState<LatLng | null>(null);
  const [status, setStatus] = useState("Choose your driver account, enter the access code, then tap Start Departure.");
  const [routeRoad, setRouteRoad] = useState<RoadRoute | null>(null);
  const resumingRef = useRef(false);

  useEffect(() => {
    let alive = true;
    getSnapshot().then((snapshot) => alive && setData(snapshot)).catch((error) => setStatus(error.message));
    const source = openLiveUpdates(
      (snapshot) => alive && setData(snapshot),
      (driver, trip) => alive && setData((current) => mergeDriver(current, driver, trip)),
      (trip, driver) => alive && setData((current) => mergeDriver(current, driver, trip)),
    );
    const fallbackRefresh = window.setInterval(() => {
      getSnapshot().then((snapshot) => alive && setData(snapshot)).catch(() => undefined);
    }, 30_000);
    return () => {
      alive = false;
      source.close();
      window.clearInterval(fallbackRefresh);
    };
  }, []);

  const driver = data.drivers.find((item) => item.id === driverId) || null;
  const assignedRoute = useMemo(
    () => data.routes.find((route) => route.id === driver?.routeId) || null,
    [data.routes, driver],
  );
  const activeTrip = useMemo(
    () => data.currentTrips.find((trip) => trip.driverId === driverId && trip.status === "active") || null,
    [data.currentTrips, driverId],
  );

  useEffect(() => {
    if (!assignedRoute) {
      setRouteRoad(null);
      return;
    }
    const points = routeControlPoints(assignedRoute, data.terminals);
    if (points.length < 2) return;
    roadRoute(points).then(setRouteRoad).catch(() => setRouteRoad(null));
  }, [assignedRoute, data.terminals]);

  useEffect(() => {
    if (!activeTrip || !driverId || !accessCode || tracking || resumingRef.current) return;
    const saved = getSavedActiveTripSession();
    const sameSavedSession = saved?.driverId === driverId && saved?.tripId === activeTrip.id;
    if (!sameSavedSession && localStorage.getItem("datsco_driver_id") !== driverId) return;
    resumingRef.current = true;
    startBackgroundTracking(
      { driverId, accessCode, tripId: activeTrip.id },
      {
        onLocation: (location) => setPosition({ lat: location.lat, lng: location.lng }),
        onStatus: (message) => setStatus(message),
        onError: (message) => setStatus(message),
      },
    ).then(() => {
      setTracking(true);
      setStatus("Your active departure was restored. Live location sharing is running again.");
    }).catch((error) => {
      setStatus(error instanceof Error ? error.message : "Could not resume live GPS.");
    }).finally(() => {
      resumingRef.current = false;
    });
  }, [activeTrip, accessCode, driverId, tracking]);

  useEffect(() => () => {
    // Do not stop the native background watcher during normal app backgrounding/navigation.
    // The explicit Mark as Arrived action stops it. Browser watchers end with the page naturally.
  }, []);

  async function startDeparture() {
    if (!driverId || !accessCode) {
      setStatus("Select your driver name and enter the access code given by Admin.");
      return;
    }
    if (!driver?.routeId) {
      setStatus("Admin must assign a route to this driver before departure.");
      return;
    }
    localStorage.setItem("datsco_driver_id", driverId);
    localStorage.setItem("datsco_driver_code", accessCode);
    setStatus("Getting your current GPS position…");

    try {
      const location = await getFreshCurrentLocation();
      setPosition({ lat: location.lat, lng: location.lng });
      const result = await startDriverTrip({
        driverId,
        accessCode,
        routeId: driver.routeId,
        ...payloadFromLocation(location),
      });
      setData((current) => mergeDriver(current, result.driver, result.trip));
      saveActiveTripSession({ driverId, accessCode, tripId: result.trip.id });
      await startBackgroundTracking(
        { driverId, accessCode, tripId: result.trip.id },
        {
          onLocation: (next) => setPosition({ lat: next.lat, lng: next.lng }),
          onStatus: (message) => setStatus(message),
          onError: (message) => setStatus(message),
        },
      );
      setTracking(true);
      setStatus(`Departure started at ${new Date(result.trip.startedAt).toLocaleTimeString()}. Your Datsco is now visible to users.`);
    } catch (error) {
      setTracking(false);
      setStatus(error instanceof Error ? error.message : "Could not start the departure.");
    }
  }

  async function markArrived() {
    if (!driverId || !accessCode || !activeTrip) {
      setStatus("There is no active trip to mark as arrived.");
      return;
    }
    setStatus("Saving your actual arrival GPS position…");
    try {
      let location: LiveLocation;
      try {
        location = await getFreshCurrentLocation();
      } catch {
        const fallback = data.drivers.find((item) => item.id === driverId);
        if (fallback?.lat == null || fallback.lng == null) throw new Error("Could not get an arrival GPS position.");
        location = {
          lat: fallback.lat,
          lng: fallback.lng,
          accuracy: fallback.accuracy,
          heading: fallback.heading,
          speed: fallback.speed,
          time: Date.now(),
        };
      }

      const result = await arriveDriverTrip({
        driverId,
        accessCode,
        tripId: activeTrip.id,
        ...payloadFromLocation(location),
      });
      await stopBackgroundTracking(true);
      setTracking(false);
      setPosition({ lat: location.lat, lng: location.lng });
      setData((current) => mergeDriver(current, result.driver, result.trip));
      setStatus(`Trip marked as arrived at your actual GPS location at ${new Date(result.trip.arrivedAt || Date.now()).toLocaleTimeString()}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not mark the trip as arrived.");
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-5 sm:px-6">
      <header className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-emerald-600">DatscoGo Driver</p>
          <h1 className="text-2xl font-black text-slate-950">Automatic Live Location</h1>
        </div>
        <a href="/" className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold">User Dashboard</a>
      </header>

      <section className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <label className="text-xs font-black uppercase tracking-wide text-slate-400">Driver</label>
            <select value={driverId} onChange={(e) => setDriverId(e.target.value)} disabled={Boolean(activeTrip)} className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 disabled:opacity-60">
              <option value="">Select driver account</option>
              {data.drivers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <label className="mt-3 block text-xs font-black uppercase tracking-wide text-slate-400">Access code</label>
            <input type="password" value={accessCode} onChange={(e) => setAccessCode(e.target.value)} disabled={Boolean(activeTrip)} className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 disabled:opacity-60" placeholder="Code from Admin" />

            {!activeTrip ? (
              <button onClick={startDeparture} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white"><Play size={17} /> Start Departure</button>
            ) : (
              <button onClick={markArrived} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white"><CheckCircle2 size={17} /> Mark as Arrived</button>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
            <div className="mb-2 flex items-center gap-2 font-black"><Radio size={18} className={activeTrip ? "text-emerald-600" : "text-slate-400"} /> {activeTrip ? "Departure active" : "No active departure"}</div>
            <p className="leading-6 text-slate-600">{status}</p>
            {assignedRoute ? <p className="mt-3 rounded-2xl bg-emerald-50 p-3 font-bold text-emerald-800">Assigned route: {assignedRoute.name}</p> : null}
            {activeTrip ? <p className="mt-2 text-xs font-bold text-slate-500">Started: {new Date(activeTrip.startedAt).toLocaleString()}</p> : null}
          </div>
        </div>

        <DatscoMap
          terminals={data.terminals}
          routes={data.routes}
          drivers={data.drivers}
          trips={data.currentTrips}
          userPosition={position}
          routePoints={routeRoad?.points || []}
          heightClass="h-[68vh] min-h-[520px]"
        />
      </section>
    </main>
  );
}
