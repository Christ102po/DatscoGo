import { useEffect, useMemo, useState } from "react";
import { LocateFixed, MapPin, Navigation, Route as RouteIcon } from "lucide-react";
import { DatscoMap } from "../components/DatscoMap";
import { getSnapshot, openLiveUpdates } from "../lib/api";
import { closestTerminalByRoad, formatDistance, formatDuration, roadRoute, type RoadRoute } from "../lib/routing";
import type { Driver, LatLng, Snapshot, Terminal, TransitRoute } from "../types/datsco";

const empty: Snapshot = { terminals: [], routes: [], schedules: [], drivers: [] };

export function UserDashboard() {
  const [data, setData] = useState<Snapshot>(empty);
  const [position, setPosition] = useState<LatLng | null>(null);
  const [selectedTerminalId, setSelectedTerminalId] = useState("");
  const [selectedRouteId, setSelectedRouteId] = useState("");
  const [road, setRoad] = useState<RoadRoute | null>(null);
  const [message, setMessage] = useState("Allow location access to get the nearest road route.");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getSnapshot().then(setData).catch((error) => setMessage(error.message));
    const source = openLiveUpdates(
      setData,
      (driver: Driver) => setData((current) => ({
        ...current,
        drivers: current.drivers.some((item) => item.id === driver.id)
          ? current.drivers.map((item) => (item.id === driver.id ? driver : item))
          : [...current.drivers, driver],
      })),
    );
    return () => source.close();
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      setMessage("This device does not support GPS location.");
      return;
    }
    const watch = navigator.geolocation.watchPosition(
      (result) => setPosition({ lat: result.coords.latitude, lng: result.coords.longitude }),
      (error) => setMessage(error.message || "Location permission was not granted."),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, []);

  const selectedTerminal = useMemo(
    () => data.terminals.find((terminal) => terminal.id === selectedTerminalId) || null,
    [data.terminals, selectedTerminalId],
  );
  const selectedTransitRoute = useMemo(
    () => data.routes.find((route) => route.id === selectedRouteId) || null,
    [data.routes, selectedRouteId],
  );

  async function navigateToTerminal(terminal: Terminal) {
    if (!position) {
      setMessage("Waiting for your current GPS location. Make sure location permission is allowed.");
      return;
    }
    setLoading(true);
    setMessage(`Calculating the best road route to ${terminal.name}…`);
    try {
      const result = await roadRoute([position, { lat: terminal.lat, lng: terminal.lng }]);
      setSelectedTerminalId(terminal.id);
      setSelectedRouteId("");
      setRoad(result);
      setMessage(`${terminal.name}: ${formatDistance(result.distanceMeters)} • about ${formatDuration(result.durationSeconds)}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not calculate the route.");
    } finally {
      setLoading(false);
    }
  }

  async function findClosest() {
    if (!position) {
      setMessage("Waiting for your GPS location first.");
      return;
    }
    setLoading(true);
    try {
      const terminal = await closestTerminalByRoad(position, data.terminals);
      await navigateToTerminal(terminal);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not find the closest terminal.");
      setLoading(false);
    }
  }

  async function showTransitRoute(route: TransitRoute) {
    const from = data.terminals.find((terminal) => terminal.id === route.fromTerminalId);
    const to = data.terminals.find((terminal) => terminal.id === route.toTerminalId);
    if (!from || !to) return;
    setLoading(true);
    setMessage(`Loading ${route.name} on the road network…`);
    try {
      const result = await roadRoute([
        { lat: from.lat, lng: from.lng },
        ...route.waypoints,
        { lat: to.lat, lng: to.lng },
      ]);
      setSelectedRouteId(route.id);
      setSelectedTerminalId("");
      setRoad(result);
      setMessage(`${route.name}: ${formatDistance(result.distanceMeters)} • about ${formatDuration(result.durationSeconds)}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not calculate the terminal route.");
    } finally {
      setLoading(false);
    }
  }

  const routeSchedules = selectedTransitRoute
    ? data.schedules.filter((schedule) => schedule.routeId === selectedTransitRoute.id)
    : [];

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
      <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-blue-600">DatscoGo</p>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Siargao Transit Guide</h1>
          <p className="mt-1 text-sm text-slate-500">Only routes, terminals and schedules published by the Admin appear here.</p>
        </div>
        <div className="flex gap-2">
          <a href="/driver" className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm">Driver</a>
          <a href="/admin" className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-bold text-white">Admin</a>
        </div>
      </header>

      <section className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2 font-black text-slate-900"><LocateFixed size={19} /> Route from my location</div>
            <button onClick={findClosest} disabled={loading || !data.terminals.length} className="mb-3 w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50">
              Find closest terminal by road
            </button>
            <select value={selectedTerminalId} onChange={(e) => setSelectedTerminalId(e.target.value)} className="w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-blue-500">
              <option value="">Choose a terminal</option>
              {data.terminals.map((terminal) => <option key={terminal.id} value={terminal.id}>{terminal.name}</option>)}
            </select>
            <button onClick={() => selectedTerminal && navigateToTerminal(selectedTerminal)} disabled={!selectedTerminal || loading} className="mt-2 w-full rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-black text-blue-700 disabled:opacity-50">
              Navigate to selected terminal
            </button>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2 font-black text-slate-900"><RouteIcon size={19} /> Terminal-to-terminal routes</div>
            {!data.routes.length ? <p className="text-sm text-slate-500">No routes have been added yet.</p> : null}
            <div className="space-y-2">
              {data.routes.filter((route) => route.active).map((route) => (
                <button key={route.id} onClick={() => showTransitRoute(route)} className="w-full rounded-2xl border border-slate-200 p-3 text-left transition hover:border-blue-300 hover:bg-blue-50">
                  <div className="font-black text-slate-900">{route.name}</div>
                  <div className="mt-1 text-xs text-slate-500">Road-following path • admin editable</div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2 font-black text-slate-900"><Navigation size={19} /> Route status</div>
            <p className="text-sm leading-6 text-slate-600">{message}</p>
            {routeSchedules.length ? (
              <div className="mt-3 border-t border-slate-100 pt-3">
                <div className="text-xs font-black uppercase tracking-wide text-slate-400">Schedules</div>
                {routeSchedules.map((schedule) => (
                  <div key={schedule.id} className="mt-2 rounded-2xl bg-slate-50 p-3 text-sm">
                    <div className="font-bold text-slate-800">{schedule.departureTime}{schedule.arrivalTime ? ` – ${schedule.arrivalTime}` : ""}</div>
                    <div className="text-xs text-slate-500">{schedule.days.join(", ") || "Daily"}{schedule.note ? ` • ${schedule.note}` : ""}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div>
          <DatscoMap terminals={data.terminals} drivers={data.drivers} userPosition={position} routePoints={road?.points || []} heightClass="h-[68vh] min-h-[520px]" />
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-500"><MapPin size={14} /> Blue = terminal • Green = live driver • Purple = your GPS location</div>
        </div>
      </section>
    </main>
  );
}
