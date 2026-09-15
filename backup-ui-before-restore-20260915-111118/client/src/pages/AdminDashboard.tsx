import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Database, MapPinned, Route as RouteIcon, CalendarClock, BusFront, Trash2, Pencil, RotateCcw } from "lucide-react";
import { DatscoMap } from "../components/DatscoMap";
import { adminCreate, adminDelete, adminUpdate, clearAll, getSnapshot, openLiveUpdates, verifyAdmin } from "../lib/api";
import { roadRoute } from "../lib/routing";
import type { LatLng, Snapshot, Terminal, TransitRoute } from "../types/datsco";

const empty: Snapshot = { terminals: [], routes: [], schedules: [], drivers: [] };
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type Tab = "terminals" | "routes" | "schedules" | "drivers";

export function AdminDashboard() {
  const [data, setData] = useState<Snapshot>(empty);
  const [adminKey, setAdminKey] = useState(localStorage.getItem("datsco_admin_key") || "");
  const [authenticated, setAuthenticated] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [tab, setTab] = useState<Tab>("terminals");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    getSnapshot().then(setData).catch(() => undefined);
    const source = openLiveUpdates(setData, () => undefined);
    return () => source.close();
  }, []);

  useEffect(() => {
    if (!adminKey) return;
    verifyAdmin(adminKey).then(() => setAuthenticated(true)).catch(() => undefined);
  }, []);

  async function login(event: FormEvent) {
    event.preventDefault();
    try {
      await verifyAdmin(adminKey);
      localStorage.setItem("datsco_admin_key", adminKey);
      setAuthenticated(true);
      setLoginError("");
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Invalid admin key.");
    }
  }

  if (!authenticated) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 px-4">
        <form onSubmit={login} className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl">
          <div className="text-sm font-bold text-blue-600">DatscoGo Admin</div>
          <h1 className="mt-1 text-2xl font-black text-slate-950">Admin-only data management</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Only Admin can create, edit or delete terminals, routes, schedules and driver accounts.</p>
          <input type="password" value={adminKey} onChange={(e) => setAdminKey(e.target.value)} placeholder="Admin access key" className="mt-5 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500" />
          {loginError ? <p className="mt-2 text-sm font-bold text-red-600">{loginError}</p> : null}
          <button className="mt-3 w-full rounded-2xl bg-slate-950 px-4 py-3 font-black text-white">Open Admin</button>
          <a href="/" className="mt-3 block text-center text-sm font-bold text-blue-600">Back to User Dashboard</a>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
      <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-blue-600">DatscoGo Admin</p>
          <h1 className="text-2xl font-black text-slate-950">Transit Data Manager</h1>
        </div>
        <div className="flex gap-2">
          <a href="/" className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold">User Dashboard</a>
          <button onClick={() => { localStorage.removeItem("datsco_admin_key"); setAuthenticated(false); }} className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-bold text-white">Logout</button>
        </div>
      </header>

      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <TabButton active={tab === "terminals"} onClick={() => setTab("terminals")} icon={<MapPinned size={18} />} label={`Terminals (${data.terminals.length})`} />
        <TabButton active={tab === "routes"} onClick={() => setTab("routes")} icon={<RouteIcon size={18} />} label={`Routes (${data.routes.length})`} />
        <TabButton active={tab === "schedules"} onClick={() => setTab("schedules")} icon={<CalendarClock size={18} />} label={`Schedules (${data.schedules.length})`} />
        <TabButton active={tab === "drivers"} onClick={() => setTab("drivers")} icon={<BusFront size={18} />} label={`Drivers (${data.drivers.length})`} />
      </div>

      {notice ? <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800">{notice}</div> : null}
      {tab === "terminals" ? <TerminalManager data={data} adminKey={adminKey} setNotice={setNotice} /> : null}
      {tab === "routes" ? <RouteManager data={data} adminKey={adminKey} setNotice={setNotice} /> : null}
      {tab === "schedules" ? <ScheduleManager data={data} adminKey={adminKey} setNotice={setNotice} /> : null}
      {tab === "drivers" ? <DriverManager data={data} adminKey={adminKey} setNotice={setNotice} /> : null}

      <section className="mt-7 rounded-3xl border border-red-100 bg-red-50 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><div className="flex items-center gap-2 font-black text-red-900"><Database size={18} /> Fresh operational data</div><p className="mt-1 text-sm text-red-700">This deletes terminals, routes, schedules and drivers so the system is completely empty again.</p></div>
          <button onClick={async () => { if (!confirm("Delete ALL DatscoGo operational data?")) return; await clearAll(adminKey); setNotice("All operational data was cleared."); }} className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white">Clear all data</button>
        </div>
      </section>
    </main>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return <button onClick={onClick} className={`flex items-center justify-center gap-2 rounded-2xl px-3 py-3 text-sm font-black ${active ? "bg-blue-600 text-white" : "border border-slate-200 bg-white text-slate-700"}`}>{icon}{label}</button>;
}

function TerminalManager({ data, adminKey, setNotice }: { data: Snapshot; adminKey: string; setNotice: (value: string) => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", address: "", lat: "", lng: "" });

  function reset() { setEditing(null); setForm({ name: "", address: "", lat: "", lng: "" }); }
  function load(terminal: Terminal) { setEditing(terminal.id); setForm({ name: terminal.name, address: terminal.address, lat: String(terminal.lat), lng: String(terminal.lng) }); }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const body = { ...form, lat: Number(form.lat), lng: Number(form.lng) };
    if (editing) await adminUpdate("terminals", editing, adminKey, body); else await adminCreate("terminals", adminKey, body);
    setNotice(editing ? "Terminal updated." : "Terminal added.");
    reset();
  }

  return <section className="grid gap-5 lg:grid-cols-[380px_1fr]">
    <form onSubmit={submit} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-black">{editing ? "Edit terminal" : "Add terminal"}</h2>
      <p className="mt-1 text-sm text-slate-500">Click the map to capture coordinates, then adjust if needed.</p>
      <Field label="Terminal name"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="field" /></Field>
      <Field label="Address"><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="field" /></Field>
      <div className="grid grid-cols-2 gap-2"><Field label="Latitude"><input required type="number" step="any" value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} className="field" /></Field><Field label="Longitude"><input required type="number" step="any" value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} className="field" /></Field></div>
      <button className="mt-3 w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white">{editing ? "Save terminal" : "Add terminal"}</button>
      {editing ? <button type="button" onClick={reset} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold">Cancel edit</button> : null}
      <div className="mt-4 space-y-2">{data.terminals.map((terminal) => <div key={terminal.id} className="rounded-2xl bg-slate-50 p-3"><div className="font-black">{terminal.name}</div><div className="text-xs text-slate-500">{terminal.address || `${terminal.lat.toFixed(5)}, ${terminal.lng.toFixed(5)}`}</div><div className="mt-2 flex gap-2"><button type="button" onClick={() => load(terminal)} className="mini"><Pencil size={14}/> Edit</button><button type="button" onClick={async () => { if (!confirm(`Delete ${terminal.name}? Routes using it will also be removed.`)) return; await adminDelete("terminals", terminal.id, adminKey); setNotice("Terminal deleted."); }} className="mini danger"><Trash2 size={14}/> Delete</button></div></div>)}</div>
    </form>
    <DatscoMap terminals={data.terminals} onMapClick={(point) => setForm({ ...form, lat: String(point.lat), lng: String(point.lng) })} heightClass="h-[650px]" />
  </section>;
}

function RouteManager({ data, adminKey, setNotice }: { data: Snapshot; adminKey: string; setNotice: (value: string) => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", fromTerminalId: "", toTerminalId: "", active: true, waypoints: [] as LatLng[] });
  const [preview, setPreview] = useState<LatLng[]>([]);
  const selectedEndpoints = useMemo(() => ({ from: data.terminals.find((t) => t.id === form.fromTerminalId), to: data.terminals.find((t) => t.id === form.toTerminalId) }), [data.terminals, form.fromTerminalId, form.toTerminalId]);

  function reset() { setEditing(null); setForm({ name: "", fromTerminalId: "", toTerminalId: "", active: true, waypoints: [] }); setPreview([]); }
  function load(route: TransitRoute) { setEditing(route.id); setForm({ name: route.name, fromTerminalId: route.fromTerminalId, toTerminalId: route.toTerminalId, active: route.active, waypoints: route.waypoints }); setPreview([]); }
  async function refreshPreview() { if (!selectedEndpoints.from || !selectedEndpoints.to) return; try { const route = await roadRoute([{ lat: selectedEndpoints.from.lat, lng: selectedEndpoints.from.lng }, ...form.waypoints, { lat: selectedEndpoints.to.lat, lng: selectedEndpoints.to.lng }]); setPreview(route.points); setNotice("Road preview updated."); } catch (error) { setNotice(error instanceof Error ? error.message : "Could not preview route."); } }
  async function submit(event: FormEvent) { event.preventDefault(); const body = form; if (editing) await adminUpdate("routes", editing, adminKey, body); else await adminCreate("routes", adminKey, body); setNotice(editing ? "Route updated." : "Route added."); reset(); }

  return <section className="grid gap-5 lg:grid-cols-[400px_1fr]">
    <form onSubmit={submit} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-black">{editing ? "Edit route" : "Add route"}</h2>
      <p className="mt-1 text-sm text-slate-500">Select terminals. Click the map to add via-points so you control which roads the route should follow. Drag orange points to fine-tune.</p>
      <Field label="Route name"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="field" /></Field>
      <Field label="From terminal"><select required value={form.fromTerminalId} onChange={(e) => setForm({ ...form, fromTerminalId: e.target.value })} className="field"><option value="">Choose</option>{data.terminals.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
      <Field label="To terminal"><select required value={form.toTerminalId} onChange={(e) => setForm({ ...form, toTerminalId: e.target.value })} className="field"><option value="">Choose</option>{data.terminals.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
      <label className="mt-3 flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })}/> Active route</label>
      <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={refreshPreview} className="rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-black text-blue-700">Preview road path</button><button type="button" onClick={() => { setForm({ ...form, waypoints: [] }); setPreview([]); }} className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-black"><RotateCcw size={14} className="inline"/> Clear points</button></div>
      <div className="mt-2 text-xs text-slate-500">Waypoints: {form.waypoints.length}</div>
      <button className="mt-3 w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white">{editing ? "Save route changes" : "Add route"}</button>
      {editing ? <button type="button" onClick={reset} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold">Cancel edit</button> : null}
      <div className="mt-4 space-y-2">{data.routes.map((route) => <div key={route.id} className="rounded-2xl bg-slate-50 p-3"><div className="font-black">{route.name}</div><div className="text-xs text-slate-500">{route.waypoints.length} custom waypoint(s)</div><div className="mt-2 flex gap-2"><button type="button" onClick={() => load(route)} className="mini"><Pencil size={14}/> Edit path</button><button type="button" onClick={async () => { if (!confirm(`Delete ${route.name}?`)) return; await adminDelete("routes", route.id, adminKey); setNotice("Route deleted."); }} className="mini danger"><Trash2 size={14}/> Delete</button></div></div>)}</div>
    </form>
    <DatscoMap terminals={data.terminals} routePoints={preview} editableWaypoints={form.waypoints} onMapClick={(point) => { setForm({ ...form, waypoints: [...form.waypoints, point] }); setPreview([]); }} onWaypointMove={(index, point) => { const next = [...form.waypoints]; next[index] = point; setForm({ ...form, waypoints: next }); setPreview([]); }} heightClass="h-[700px]" />
  </section>;
}

function ScheduleManager({ data, adminKey, setNotice }: { data: Snapshot; adminKey: string; setNotice: (value: string) => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ routeId: "", days: [] as string[], departureTime: "", arrivalTime: "", note: "" });
  function reset() { setEditing(null); setForm({ routeId: "", days: [], departureTime: "", arrivalTime: "", note: "" }); }
  async function submit(event: FormEvent) { event.preventDefault(); if (editing) await adminUpdate("schedules", editing, adminKey, form); else await adminCreate("schedules", adminKey, form); setNotice(editing ? "Schedule updated." : "Schedule added."); reset(); }
  return <section className="grid gap-5 lg:grid-cols-[420px_1fr]"><form onSubmit={submit} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"><h2 className="text-lg font-black">{editing ? "Edit schedule" : "Add schedule"}</h2><Field label="Route"><select required value={form.routeId} onChange={(e) => setForm({ ...form, routeId: e.target.value })} className="field"><option value="">Choose route</option>{data.routes.map((route) => <option key={route.id} value={route.id}>{route.name}</option>)}</select></Field><Field label="Days"><div className="flex flex-wrap gap-2">{DAYS.map((day) => <button type="button" key={day} onClick={() => setForm({ ...form, days: form.days.includes(day) ? form.days.filter((item) => item !== day) : [...form.days, day] })} className={`rounded-xl px-3 py-2 text-xs font-black ${form.days.includes(day) ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}>{day}</button>)}</div></Field><div className="grid grid-cols-2 gap-2"><Field label="Departure"><input required type="time" value={form.departureTime} onChange={(e) => setForm({ ...form, departureTime: e.target.value })} className="field" /></Field><Field label="Arrival"><input type="time" value={form.arrivalTime} onChange={(e) => setForm({ ...form, arrivalTime: e.target.value })} className="field" /></Field></div><Field label="Note"><input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="field" placeholder="Optional" /></Field><button className="mt-3 w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white">{editing ? "Save schedule" : "Add schedule"}</button>{editing ? <button type="button" onClick={reset} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold">Cancel edit</button> : null}</form><div className="grid content-start gap-3 sm:grid-cols-2">{data.schedules.map((schedule) => { const route = data.routes.find((item) => item.id === schedule.routeId); return <div key={schedule.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"><div className="font-black">{route?.name || "Unknown route"}</div><div className="mt-1 text-lg font-black text-blue-600">{schedule.departureTime}{schedule.arrivalTime ? ` – ${schedule.arrivalTime}` : ""}</div><div className="mt-1 text-xs text-slate-500">{schedule.days.join(", ") || "Daily"}{schedule.note ? ` • ${schedule.note}` : ""}</div><div className="mt-3 flex gap-2"><button onClick={() => { setEditing(schedule.id); setForm({ routeId: schedule.routeId, days: schedule.days, departureTime: schedule.departureTime, arrivalTime: schedule.arrivalTime, note: schedule.note }); }} className="mini"><Pencil size={14}/> Edit</button><button onClick={async () => { await adminDelete("schedules", schedule.id, adminKey); setNotice("Schedule deleted."); }} className="mini danger"><Trash2 size={14}/> Delete</button></div></div>; })}</div></section>;
}

function DriverManager({ data, adminKey, setNotice }: { data: Snapshot; adminKey: string; setNotice: (value: string) => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", accessCode: "", routeId: "" });
  function reset() { setEditing(null); setForm({ name: "", accessCode: "", routeId: "" }); }
  async function submit(event: FormEvent) { event.preventDefault(); if (editing) await adminUpdate("drivers", editing, adminKey, form); else await adminCreate("drivers", adminKey, form); setNotice(editing ? "Driver updated." : "Driver account added."); reset(); }
  return <section className="grid gap-5 lg:grid-cols-[420px_1fr]"><form onSubmit={submit} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"><h2 className="text-lg font-black">{editing ? "Edit driver" : "Add driver"}</h2><Field label="Driver name"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="field" /></Field><Field label={editing ? "New access code (leave blank to keep current)" : "Access code"}><input required={!editing} value={form.accessCode} onChange={(e) => setForm({ ...form, accessCode: e.target.value })} className="field" /></Field><Field label="Assigned route"><select value={form.routeId} onChange={(e) => setForm({ ...form, routeId: e.target.value })} className="field"><option value="">No route assigned</option>{data.routes.map((route) => <option key={route.id} value={route.id}>{route.name}</option>)}</select></Field><button className="mt-3 w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white">{editing ? "Save driver" : "Add driver"}</button>{editing ? <button type="button" onClick={reset} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold">Cancel edit</button> : null}</form><div className="grid content-start gap-3 sm:grid-cols-2">{data.drivers.map((driver) => <div key={driver.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><div className="font-black">{driver.name}</div><span className={`rounded-full px-2 py-1 text-[10px] font-black ${driver.updatedAt && Date.now() - new Date(driver.updatedAt).getTime() < 30000 ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{driver.updatedAt ? "GPS" : "Offline"}</span></div><div className="mt-1 text-xs text-slate-500">{data.routes.find((route) => route.id === driver.routeId)?.name || "No route assigned"}</div><div className="mt-3 flex gap-2"><button onClick={() => { setEditing(driver.id); setForm({ name: driver.name, accessCode: "", routeId: driver.routeId || "" }); }} className="mini"><Pencil size={14}/> Edit</button><button onClick={async () => { await adminDelete("drivers", driver.id, adminKey); setNotice("Driver deleted."); }} className="mini danger"><Trash2 size={14}/> Delete</button></div></div>)}</div></section>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="mt-3 block"><span className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-400">{label}</span>{children}</label>; }
