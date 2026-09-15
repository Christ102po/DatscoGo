import { useEffect, useMemo, useRef, useState } from "react";
import { Radio, Square, Play } from "lucide-react";
import { DatscoMap } from "../components/DatscoMap";
import { getSnapshot, openLiveUpdates, sendDriverLocation } from "../lib/api";
import type { Driver, LatLng, Snapshot } from "../types/datsco";

const empty: Snapshot = { terminals: [], routes: [], schedules: [], drivers: [] };

export function DriverDashboard() {
  const [data, setData] = useState<Snapshot>(empty);
  const [driverId, setDriverId] = useState(localStorage.getItem("datsco_driver_id") || "");
  const [accessCode, setAccessCode] = useState(localStorage.getItem("datsco_driver_code") || "");
  const [tracking, setTracking] = useState(false);
  const [position, setPosition] = useState<LatLng | null>(null);
  const [status, setStatus] = useState("Choose your driver account, enter the access code, then start live GPS once.");
  const watchRef = useRef<number | null>(null);
  const lastSentRef = useRef<{ lat: number; lng: number; at: number } | null>(null);

  useEffect(() => {
    getSnapshot().then(setData).catch((error) => setStatus(error.message));
    const source = openLiveUpdates(setData, (driver: Driver) => {
      setData((current) => ({
        ...current,
        drivers: current.drivers.map((item) => item.id === driver.id ? driver : item),
      }));
    });
    return () => source.close();
  }, []);

  useEffect(() => () => {
    if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
  }, []);

  const driver = data.drivers.find((item) => item.id === driverId) || null;
  const assignedRoute = useMemo(() => data.routes.find((route) => route.id === driver?.routeId) || null, [data.routes, driver]);

  function metersBetween(a: LatLng, b: LatLng) {
    const r = 6371000;
    const p1 = a.lat * Math.PI / 180;
    const p2 = b.lat * Math.PI / 180;
    const dp = (b.lat - a.lat) * Math.PI / 180;
    const dl = (b.lng - a.lng) * Math.PI / 180;
    const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    return 2 * r * Math.asin(Math.sqrt(h));
  }

  function startTracking() {
    if (!driverId || !accessCode) {
      setStatus("Select your driver name and enter the access code given by Admin.");
      return;
    }
    if (!navigator.geolocation) {
      setStatus("GPS is not supported on this device.");
      return;
    }
    localStorage.setItem("datsco_driver_id", driverId);
    localStorage.setItem("datsco_driver_code", accessCode);
    if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);

    watchRef.current = navigator.geolocation.watchPosition(
      async (result) => {
        const next = { lat: result.coords.latitude, lng: result.coords.longitude };
        setPosition(next);
        const previous = lastSentRef.current;
        const moved = previous ? metersBetween({ lat: previous.lat, lng: previous.lng }, next) : Infinity;
        const elapsed = previous ? Date.now() - previous.at : Infinity;
        if (moved < 5 && elapsed < 10_000) return;
        try {
          await sendDriverLocation({
            driverId,
            accessCode,
            lat: next.lat,
            lng: next.lng,
            accuracy: result.coords.accuracy ?? null,
            heading: result.coords.heading ?? null,
            speed: result.coords.speed ?? null,
          });
          lastSentRef.current = { ...next, at: Date.now() };
          setTracking(true);
          setStatus(`Live GPS is updating automatically. Last sent ${new Date().toLocaleTimeString()}.`);
        } catch (error) {
          setTracking(false);
          setStatus(error instanceof Error ? error.message : "Could not send live GPS.");
        }
      },
      (error) => {
        setTracking(false);
        setStatus(error.message || "GPS permission is required.");
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 15_000 },
    );
    setTracking(true);
    setStatus("GPS tracking started. DatscoGo will send new positions automatically while this page is active.");
  }

  function stopTracking() {
    if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = null;
    setTracking(false);
    setStatus("Live GPS stopped.");
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
            <select value={driverId} onChange={(e) => setDriverId(e.target.value)} className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3">
              <option value="">Select driver account</option>
              {data.drivers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <label className="mt-3 block text-xs font-black uppercase tracking-wide text-slate-400">Access code</label>
            <input type="password" value={accessCode} onChange={(e) => setAccessCode(e.target.value)} className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3" placeholder="Code from Admin" />
            {!tracking ? (
              <button onClick={startTracking} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white"><Play size={17} /> Start automatic GPS</button>
            ) : (
              <button onClick={stopTracking} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white"><Square size={17} /> Stop live GPS</button>
            )}
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
            <div className="mb-2 flex items-center gap-2 font-black"><Radio size={18} className={tracking ? "text-emerald-600" : "text-slate-400"} /> {tracking ? "Live" : "Not live"}</div>
            <p className="leading-6 text-slate-600">{status}</p>
            {assignedRoute ? <p className="mt-3 rounded-2xl bg-emerald-50 p-3 font-bold text-emerald-800">Assigned route: {assignedRoute.name}</p> : null}
          </div>
        </div>
        <DatscoMap terminals={data.terminals} drivers={data.drivers} userPosition={position} heightClass="h-[68vh] min-h-[520px]" />
      </section>
    </main>
  );
}
