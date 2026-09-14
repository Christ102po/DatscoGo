import React, { useState } from 'react';
import {
  BellRing,
  BusFront,
  CalendarClock,
  Check,
  CircleAlert,
  KeyRound,
  LogOut,
  MapPinned,
  Megaphone,
  Pencil,
  Plus,
  Route,
  ShieldCheck,
  Trash2,
  UsersRound,
  X,
} from 'lucide-react';
import { DatscoLogo } from '../../assets/svg/DatscoLogo';
import { RouteMapPicker } from './RouteMapPicker';
import { TerminalLocationPicker } from './TerminalLocationPicker';
import { RouteWaypoint, Terminal, TransitRoute, useTransit } from '../../contexts/TransitContext';

type Section = 'overview' | 'routes' | 'schedules' | 'terminals' | 'announcements' | 'drivers' | 'security';
type Notice = { error?: boolean; text: string } | null;
type RouteDraft = Omit<TransitRoute, 'id' | 'coordinates' | 'waypoints' | 'discountedFare'>;

const inputClass = 'mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100';
const miniInputClass = 'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const labelClass = 'block text-xs font-bold text-slate-600';

const blankRoute: RouteDraft = {
  title: '',
  origin: '',
  destination: '',
  originTerminalId: '',
  destinationTerminalId: '',
  type: 'bus',
  fare: 0,
  studentFare: null,
  seniorCitizenFare: null,
  eta: '',
  duration: '',
  available: true,
};

const asDraft = (route: TransitRoute): RouteDraft => ({
  title: route.title,
  origin: route.origin,
  destination: route.destination,
  originTerminalId: route.originTerminalId,
  destinationTerminalId: route.destinationTerminalId,
  type: route.type,
  fare: route.fare,
  studentFare: route.studentFare ?? route.discountedFare ?? null,
  seniorCitizenFare: route.seniorCitizenFare ?? route.discountedFare ?? null,
  eta: route.eta,
  duration: route.duration,
  available: route.available,
});

function optionalMoney(value: string) {
  return value === '' ? null : Number(value);
}

function RouteManager({ onNotice }: { onNotice: (message: string, error?: boolean) => void }) {
  const { routes, terminals, addRoute, updateRoute } = useTransit();
  const [draft, setDraft] = useState<RouteDraft>(blankRoute);
  const [waypoints, setWaypoints] = useState<RouteWaypoint[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const origin = terminals.find((terminal) => terminal.id === draft.originTerminalId);
  const destination = terminals.find((terminal) => terminal.id === draft.destinationTerminalId);

  const reset = () => {
    setDraft(blankRoute);
    setWaypoints([]);
    setEditingId(null);
  };

  const edit = (route: TransitRoute) => {
    setDraft(asDraft(route));
    setWaypoints(route.waypoints ?? route.coordinates.slice(1, -1).map(([latitude, longitude], index) => ({
      id: `legacy-${route.id}-${index}`,
      latitude,
      longitude,
      label: `Passing point ${index + 1}`,
      regularFare: null,
      studentFare: null,
      seniorCitizenFare: null,
    })));
    setEditingId(route.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const selectOrigin = (terminal: Terminal) => setDraft((current) => ({ ...current, origin: terminal.name, originTerminalId: terminal.id }));
  const selectDestination = (terminal: Terminal) => setDraft((current) => ({ ...current, destination: terminal.name, destinationTerminalId: terminal.id }));

  const updateWaypoint = (index: number, changes: Partial<RouteWaypoint>) => {
    setWaypoints((current) => current.map((point, pointIndex) => pointIndex === index ? { ...point, ...changes } : point));
  };

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.title.trim() || !origin || !destination || !draft.eta.trim() || !draft.duration.trim() || draft.fare < 0) {
      return onNotice('Add a route name, select both terminals on the map, and complete the route details.', true);
    }
    if (draft.studentFare !== null && draft.studentFare !== undefined && (draft.studentFare < 0 || draft.studentFare > draft.fare)) {
      return onNotice('Student discount fare must be between ₱0 and the regular full-route fare.', true);
    }
    if (draft.seniorCitizenFare !== null && draft.seniorCitizenFare !== undefined && (draft.seniorCitizenFare < 0 || draft.seniorCitizenFare > draft.fare)) {
      return onNotice('Senior Citizen discount fare must be between ₱0 and the regular full-route fare.', true);
    }

    for (const [index, stop] of waypoints.entries()) {
      if (!stop.label.trim()) return onNotice(`Enter the barangay or stop name for passing point ${index + 1}.`, true);
      const regular = stop.regularFare;
      const student = stop.studentFare;
      const senior = stop.seniorCitizenFare;
      if (regular !== null && regular !== undefined && regular < 0) return onNotice(`Regular fare for ${stop.label} cannot be negative.`, true);
      if (student !== null && student !== undefined && student < 0) return onNotice(`Student fare for ${stop.label} cannot be negative.`, true);
      if (senior !== null && senior !== undefined && senior < 0) return onNotice(`Senior Citizen fare for ${stop.label} cannot be negative.`, true);
      if (regular !== null && regular !== undefined && student !== null && student !== undefined && student > regular) return onNotice(`Student fare for ${stop.label} cannot be higher than its regular fare.`, true);
      if (regular !== null && regular !== undefined && senior !== null && senior !== undefined && senior > regular) return onNotice(`Senior Citizen fare for ${stop.label} cannot be higher than its regular fare.`, true);
    }

    const payload: Omit<TransitRoute, 'id'> = {
      ...draft,
      discountedFare: undefined,
      title: draft.title.trim(),
      waypoints: waypoints.map((point) => ({ ...point, label: point.label.trim() })),
      coordinates: [
        [origin.latitude, origin.longitude],
        ...waypoints.map((point) => [point.latitude, point.longitude] as [number, number]),
        [destination.latitude, destination.longitude],
      ],
    };

    if (editingId) {
      updateRoute(editingId, payload);
      onNotice('Route, barangays, and stop fares saved.');
    } else {
      addRoute(payload);
      onNotice('New route, barangays, and stop fares created.');
    }
    reset();
  };

  return (
    <div className="space-y-6">
      <form onSubmit={save} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-black">{editingId ? 'Edit route' : 'Add a new route'}</h2>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
              The administrator controls the route path. Select both terminals, click the map to add each barangay/stop in travel order, then assign the fare passengers pay up to each stop.
            </p>
          </div>
          {editingId && <button type="button" onClick={reset} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Cancel route edit"><X size={18} /></button>}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className={labelClass}>Route name<input required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Dapa → General Luna" className={inputClass} /></label>
          <label className={labelClass}>Service type<select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as 'bus' | 'ferry' })} className={inputClass}><option value="bus">Datsco / Bus</option><option value="ferry">Ferry</option></select></label>
          <label className={labelClass}>Full-route regular fare (₱)<input required type="number" min="0" step="0.01" value={draft.fare} onChange={(event) => setDraft({ ...draft, fare: Number(event.target.value) || 0 })} className={inputClass} /></label>
          <label className={labelClass}>Student discount (₱)<input type="number" min="0" step="0.01" max={draft.fare} value={draft.studentFare ?? ''} onChange={(event) => setDraft({ ...draft, studentFare: optionalMoney(event.target.value) })} placeholder="Optional" className={inputClass} /></label>
          <label className={labelClass}>Senior Citizen Discount (₱)<input type="number" min="0" step="0.01" max={draft.fare} value={draft.seniorCitizenFare ?? ''} onChange={(event) => setDraft({ ...draft, seniorCitizenFare: optionalMoney(event.target.value) })} placeholder="Optional" className={inputClass} /></label>
          <label className={labelClass}>Estimated time<input required value={draft.eta} onChange={(event) => setDraft({ ...draft, eta: event.target.value })} placeholder="30 mins" className={inputClass} /></label>
          <label className={labelClass}>Duration badge<input required value={draft.duration} onChange={(event) => setDraft({ ...draft, duration: event.target.value })} placeholder="30 min" className={inputClass} /></label>
          <label className="mt-5 flex items-center gap-2 text-sm font-bold text-slate-700"><input type="checkbox" checked={draft.available} onChange={(event) => setDraft({ ...draft, available: event.target.checked })} className="h-4 w-4 rounded border-slate-300 text-blue-600" />Route available</label>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
          <b>Origin:</b> {draft.origin || 'Select terminal A on the map'}<br />
          <b>Destination:</b> {draft.destination || 'Select terminal B on the map'}
        </div>

        <RouteMapPicker terminals={terminals} originTerminalId={draft.originTerminalId} destinationTerminalId={draft.destinationTerminalId} points={waypoints} onOriginChange={selectOrigin} onDestinationChange={selectDestination} onPointsChange={setWaypoints} />

        {waypoints.length > 0 && (
          <section className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/50 p-3 sm:p-4">
            <div>
              <p className="text-sm font-black text-slate-800">Barangays / route stops and fare per stop</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Each row is one place the Datsco passes through. Fares are from the route origin to that stop.</p>
            </div>
            <div className="mt-3 space-y-3">
              {waypoints.map((waypoint, index) => (
                <div key={waypoint.id} className="rounded-2xl bg-white p-3 ring-1 ring-slate-100">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-blue-600 text-[10px] font-black text-white">{index + 1}</span>
                      <span className="truncate text-[10px] font-semibold text-slate-400">{waypoint.latitude.toFixed(5)}, {waypoint.longitude.toFixed(5)}</span>
                    </div>
                    <div className="flex gap-1">
                      <button type="button" disabled={index === 0} onClick={() => setWaypoints((current) => { const next = [...current]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next; })} className="rounded-lg px-2 py-1 text-xs font-bold text-slate-500 hover:bg-slate-100 disabled:opacity-30">↑</button>
                      <button type="button" disabled={index === waypoints.length - 1} onClick={() => setWaypoints((current) => { const next = [...current]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; return next; })} className="rounded-lg px-2 py-1 text-xs font-bold text-slate-500 hover:bg-slate-100 disabled:opacity-30">↓</button>
                      <button type="button" onClick={() => setWaypoints((current) => current.filter((_, pointIndex) => pointIndex !== index))} className="rounded-lg px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50">Remove</button>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="text-[10px] font-bold text-slate-500">Barangay / stop name<input required value={waypoint.label} onChange={(event) => updateWaypoint(index, { label: event.target.value })} placeholder="e.g. Catangnan" className={miniInputClass} /></label>
                    <label className="text-[10px] font-bold text-slate-500">Regular fare (₱)<input type="number" min="0" step="0.01" value={waypoint.regularFare ?? ''} onChange={(event) => updateWaypoint(index, { regularFare: optionalMoney(event.target.value) })} placeholder="Optional" className={miniInputClass} /></label>
                    <label className="text-[10px] font-bold text-slate-500">Student discount (₱)<input type="number" min="0" step="0.01" value={waypoint.studentFare ?? ''} onChange={(event) => updateWaypoint(index, { studentFare: optionalMoney(event.target.value) })} placeholder="Optional" className={miniInputClass} /></label>
                    <label className="text-[10px] font-bold text-slate-500">Senior Citizen (₱)<input type="number" min="0" step="0.01" value={waypoint.seniorCitizenFare ?? ''} onChange={(event) => updateWaypoint(index, { seniorCitizenFare: optionalMoney(event.target.value) })} placeholder="Optional" className={miniInputClass} /></label>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <button className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700 active:scale-[.98] sm:w-auto"><Plus size={17} />{editingId ? 'Save route changes' : 'Create and save route'}</button>
      </form>

      <div className="grid gap-4 xl:grid-cols-2">
        {routes.map((route) => (
          <article key={route.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-black">{route.title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {route.origin} to {route.destination} · Regular ₱{route.fare}
                  {route.studentFare !== null && route.studentFare !== undefined ? ` · Student ₱${route.studentFare}` : ''}
                  {route.seniorCitizenFare !== null && route.seniorCitizenFare !== undefined ? ` · Senior ₱${route.seniorCitizenFare}` : ''}
                  {' · '}{route.eta}
                </p>
                <p className="mt-2 text-xs font-semibold text-blue-700">{route.waypoints?.length ?? 0} administrator-defined barangay/stop{(route.waypoints?.length ?? 0) === 1 ? '' : 's'}</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => updateRoute(route.id, { available: !route.available })} className={`rounded-full px-3 py-1.5 text-xs font-bold ${route.available ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{route.available ? 'Available' : 'Unavailable'}</button>
                <button type="button" onClick={() => edit(route)} className="rounded-xl border border-blue-200 p-2 text-blue-600 hover:bg-blue-50" aria-label={`Edit ${route.title}`}><Pencil size={17} /></button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function TerminalManager({ onNotice }: { onNotice: (message: string, error?: boolean) => void }) {
  const { terminals, routes, addTerminal, updateTerminal, deleteTerminal } = useTransit();
  const [draft, setDraft] = useState({ name: '', details: '', point: null as { latitude: number; longitude: number } | null });
  const [editingId, setEditingId] = useState<string | null>(null);

  const reset = () => {
    setDraft({ name: '', details: '', point: null });
    setEditingId(null);
  };

  const edit = (terminal: Terminal) => {
    setEditingId(terminal.id);
    setDraft({ name: terminal.name, details: terminal.details, point: { latitude: terminal.latitude, longitude: terminal.longitude } });
  };

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim() || !draft.point) return onNotice('Enter a terminal name, then click the Siargao map to select its location.', true);
    const payload = { name: draft.name.trim(), details: draft.details.trim() || 'Operating details not provided', ...draft.point };
    if (editingId) {
      updateTerminal(editingId, payload);
      onNotice('Terminal changes saved.');
    } else {
      addTerminal(payload);
      onNotice('Terminal added to the passenger map.');
    }
    reset();
  };

  const remove = (terminal: Terminal) => {
    const affectedRoutes = routes.filter((route) => route.originTerminalId === terminal.id || route.destinationTerminalId === terminal.id).map((route) => route.title);
    if (affectedRoutes.length > 0) {
      onNotice(`This terminal cannot be deleted. It is used by: ${affectedRoutes.join(', ')}. Edit or remove those routes first.`, true);
      return;
    }
    if (!window.confirm(`Delete ${terminal.name} from the passenger map? This cannot be undone.`)) return;
    const result = deleteTerminal(terminal.id);
    if (!result.ok) return onNotice('This terminal can no longer be deleted because a route now uses it.', true);
    if (editingId === terminal.id) reset();
    onNotice('Terminal deleted from map data.');
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_.9fr]">
      <form onSubmit={save} className="h-fit rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between">
          <div><h2 className="font-black">{editingId ? 'Edit terminal' : 'Add terminal'}</h2><p className="mt-1 text-xs text-slate-500">Click the map, review the pin coordinates, then confirm to save.</p></div>
          {editingId && <button type="button" onClick={reset} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button>}
        </div>
        <div className="mt-4 space-y-3">
          <input required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Terminal name" className={inputClass} />
          <input value={draft.details} onChange={(event) => setDraft({ ...draft, details: event.target.value })} placeholder="Operating details" className={inputClass} />
          <TerminalLocationPicker value={draft.point} onChange={(point) => setDraft({ ...draft, point })} />
          <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white hover:bg-blue-700"><MapPinned size={17} />{editingId ? 'Confirm location update' : 'Confirm and add terminal'}</button>
        </div>
      </form>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-black">Passenger map terminals</h2>
        <div className="mt-4 space-y-3">
          {terminals.map((terminal) => (
            <article key={terminal.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4">
              <div><p className="font-black">{terminal.name}</p><p className="mt-1 text-xs text-slate-500">{terminal.latitude.toFixed(5)}, {terminal.longitude.toFixed(5)}</p><p className="mt-1 text-xs text-slate-500">{terminal.details}</p></div>
              <div className="flex gap-2"><button type="button" onClick={() => edit(terminal)} className="rounded-xl border border-blue-200 p-2 text-blue-600 hover:bg-blue-50" aria-label={`Edit ${terminal.name} location`}><Pencil size={17} /></button><button type="button" onClick={() => remove(terminal)} className="rounded-xl border border-red-200 p-2 text-red-600 hover:bg-red-50" aria-label={`Delete ${terminal.name}`}><Trash2 size={17} /></button></div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function AnnouncementManager({ onNotice }: { onNotice: (message: string, error?: boolean) => void }) {
  const { announcements, addAnnouncement, deleteAnnouncement, toggleAnnouncement } = useTransit();
  const [draft, setDraft] = useState({ title: '', message: '' });

  const publish = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.title.trim() || !draft.message.trim()) return onNotice('Enter both an announcement title and message.', true);
    addAnnouncement(draft);
    setDraft({ title: '', message: '' });
    onNotice('Announcement published to passenger notifications.');
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]">
      <form onSubmit={publish} className="h-fit rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2"><span className="rounded-xl bg-blue-50 p-2 text-blue-600"><Megaphone size={19} /></span><div><h2 className="font-black">Publish announcement</h2><p className="text-xs text-slate-500">Passengers will see active announcements from the notification bell.</p></div></div>
        <div className="mt-4 space-y-3">
          <input required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Announcement title" className={inputClass} />
          <textarea required value={draft.message} onChange={(event) => setDraft({ ...draft, message: event.target.value })} placeholder="Write the service announcement..." rows={5} className={`${inputClass} resize-y`} />
          <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white hover:bg-blue-700"><BellRing size={17} />Publish announcement</button>
        </div>
      </form>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3"><div><h2 className="font-black">Published announcements</h2><p className="mt-1 text-xs text-slate-500">Turn an announcement off without deleting it, or remove it permanently.</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{announcements.filter((item) => item.active).length} active</span></div>
        <div className="mt-4 space-y-3">
          {announcements.map((announcement) => (
            <article key={announcement.id} className={`rounded-2xl border p-4 ${announcement.active ? 'border-blue-100 bg-blue-50/40' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1"><p className="text-sm font-black text-slate-900">{announcement.title}</p><p className="mt-1 text-xs leading-5 text-slate-600">{announcement.message}</p><p className="mt-2 text-[10px] font-semibold text-slate-400">{new Date(announcement.createdAt).toLocaleString()}</p></div>
                <div className="flex gap-2"><button type="button" onClick={() => toggleAnnouncement(announcement.id)} className={`rounded-xl px-3 py-2 text-xs font-bold ${announcement.active ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>{announcement.active ? 'Active' : 'Hidden'}</button><button type="button" onClick={() => deleteAnnouncement(announcement.id)} className="rounded-xl border border-red-200 p-2 text-red-600 hover:bg-red-50" aria-label={`Delete ${announcement.title}`}><Trash2 size={17} /></button></div>
              </div>
            </article>
          ))}
          {announcements.length === 0 && <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">No announcements have been published yet.</div>}
        </div>
      </section>
    </div>
  );
}

export const AdminDashboard: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const {
    currentUser,
    accounts,
    routes,
    schedules,
    terminals,
    activeTrips,
    announcements,
    contact,
    createDriver,
    deleteDriver,
    setAdminPassword,
    addSchedule,
    deleteSchedule,
    updateContact,
  } = useTransit();

  const [section, setSection] = useState<Section>('overview');
  const [notice, setNotice] = useState<Notice>(null);
  const [driver, setDriver] = useState({ displayName: '', username: '', password: '' });
  const [schedule, setSchedule] = useState({ routeId: routes[0]?.id ?? '', time: '', period: 'Morning' as 'Morning' | 'Afternoon', days: 'Monday – Saturday' });
  const [password, setPassword] = useState({ current: '', next: '' });

  const drivers = accounts.filter((account) => account.role === 'driver');
  const liveTripCount = activeTrips.filter((trip) => trip.status === 'departed').length;
  const arrivedTripCount = activeTrips.filter((trip) => trip.status === 'arrived').length;
  const inform = (text: string, error = false) => {
    setNotice({ text, error });
    window.setTimeout(() => setNotice(null), 3500);
  };

  const nav: Array<[Section, string, typeof Route]> = [
    ['overview', 'Overview', ShieldCheck],
    ['routes', 'Routes & fares', Route],
    ['schedules', 'Schedules', CalendarClock],
    ['terminals', 'Terminals', MapPinned],
    ['announcements', 'Announcements', Megaphone],
    ['drivers', 'Drivers', UsersRound],
    ['security', 'Security', KeyRound],
  ];

  const routeLabel = (routeId: string) => routes.find((route) => route.id === routeId)?.title ?? 'Unknown route';

  const createNewDriver = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = await createDriver(driver);
    if (!result.ok) return inform(result.error ?? 'Unable to register driver.', true);
    setDriver({ displayName: '', username: '', password: '' });
    inform('Driver account registered.');
  };

  const createSchedule = (event: React.FormEvent) => {
    event.preventDefault();
    if (!schedule.routeId || !schedule.time.trim()) return inform('Select a route and enter a time slot.', true);
    addSchedule({ ...schedule, time: schedule.time.trim(), days: schedule.days.trim() || 'Monday – Saturday' });
    setSchedule((current) => ({ ...current, time: '' }));
    inform('Schedule added.');
  };

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = await setAdminPassword(password.current, password.next);
    if (!result.ok) return inform(result.error ?? 'Unable to update password.', true);
    setPassword({ current: '', next: '' });
    inform('Administrator password updated.');
  };

  if (currentUser?.role !== 'admin') {
    return <main className="grid min-h-screen place-items-center bg-slate-50 p-6"><section className="max-w-sm rounded-3xl bg-white p-6 text-center shadow-xl"><ShieldCheck className="mx-auto text-blue-600" size={34} /><h1 className="mt-3 text-xl font-black">Administrator access required</h1><button onClick={onLogout} className="mt-5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white">Return to DatscoGo</button></section></main>;
  }

  return (
    <main className="min-h-[100dvh] bg-slate-100 text-slate-900 lg:flex">
      <aside className="flex shrink-0 flex-col bg-[#102a56] p-4 text-white lg:sticky lg:top-0 lg:h-[100dvh] lg:w-72 lg:p-5">
        <div className="flex items-center gap-3 px-2 py-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-500"><DatscoLogo size={25} color="#fff" /></span><div><p className="text-lg font-black">Datsco<span className="text-blue-300">Go</span></p><p className="text-[10px] font-bold uppercase tracking-[.15em] text-slate-400">Admin workspace</p></div></div>
        <nav className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:mt-5 lg:flex-col lg:overflow-y-auto">
          {nav.map(([id, label, Icon]) => <button key={id} onClick={() => setSection(id)} className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold transition active:scale-[.98] ${section === id ? 'bg-blue-600 shadow-lg shadow-blue-950/30' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}><Icon size={18} />{label}</button>)}
        </nav>
        <div className="mt-auto hidden border-t border-white/10 pt-4 lg:block"><p className="px-3 text-xs font-bold">{currentUser.displayName}</p><button onClick={onLogout} className="mt-3 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-300 hover:bg-white/10 hover:text-white"><LogOut size={17} />Logout</button></div>
      </aside>

      <section className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
        <header className="mb-6 flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-blue-600">DatscoGo management</p><h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">{nav.find(([id]) => id === section)?.[1]}</h1></div><button onClick={onLogout} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 lg:hidden"><LogOut className="mr-1 inline" size={15} />Logout</button></header>

        {notice && <div role="status" className={`mb-5 flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold ${notice.error ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{notice.error ? <CircleAlert size={17} /> : <Check size={17} />}{notice.text}</div>}

        {section === 'overview' && (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              {[
                [Route, 'Available routes', `${routes.filter((item) => item.available).length} / ${routes.length}`],
                [CalendarClock, 'Schedule entries', schedules.length],
                [MapPinned, 'Map terminals', terminals.length],
                [UsersRound, 'Driver accounts', drivers.length],
                [Megaphone, 'Active notices', announcements.filter((item) => item.active).length],
              ].map(([Icon, label, value]) => {
                const MetricIcon = Icon as typeof Route;
                return <article key={label as string} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><span className="inline-flex rounded-xl bg-blue-50 p-2.5 text-blue-600"><MetricIcon size={20} /></span><p className="mt-4 text-2xl font-black">{value as string | number}</p><p className="mt-1 text-xs font-bold uppercase tracking-[.1em] text-slate-500">{label as string}</p></article>;
              })}
            </div>
            <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-base font-black">Vehicle trips</h2><p className="mt-2 text-sm text-slate-600">{activeTrips.length ? `${liveTripCount} live vehicle${liveTripCount === 1 ? '' : 's'} and ${arrivedTripCount} vehicle${arrivedTripCount === 1 ? '' : 's'} at destination.` : 'No driver is currently reporting an active trip.'}</p></article>
            <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-base font-black">Public contact details</h2><div className="mt-4 grid gap-3 sm:grid-cols-3"><input value={contact.facebook} onChange={(event) => updateContact({ ...contact, facebook: event.target.value })} placeholder="Facebook page" className={inputClass} /><input value={contact.phone} onChange={(event) => updateContact({ ...contact, phone: event.target.value })} placeholder="Contact number" className={inputClass} /><input type="email" value={contact.email} onChange={(event) => updateContact({ ...contact, email: event.target.value })} placeholder="Email address" className={inputClass} /></div></article>
          </div>
        )}

        {section === 'routes' && <RouteManager onNotice={inform} />}
        {section === 'terminals' && <TerminalManager onNotice={inform} />}
        {section === 'announcements' && <AnnouncementManager onNotice={inform} />}

        {section === 'schedules' && (
          <div className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]">
            <form onSubmit={createSchedule} className="h-fit rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-black">Add schedule entry</h2><div className="mt-4 space-y-3"><select value={schedule.routeId} onChange={(event) => setSchedule({ ...schedule, routeId: event.target.value })} className={inputClass}>{routes.map((route) => <option key={route.id} value={route.id}>{route.title}</option>)}</select><input required value={schedule.time} onChange={(event) => setSchedule({ ...schedule, time: event.target.value })} placeholder="6:30 – 7:00am" className={inputClass} /><select value={schedule.period} onChange={(event) => setSchedule({ ...schedule, period: event.target.value as 'Morning' | 'Afternoon' })} className={inputClass}><option>Morning</option><option>Afternoon</option></select><input value={schedule.days} onChange={(event) => setSchedule({ ...schedule, days: event.target.value })} placeholder="Monday – Saturday" className={inputClass} /><button className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white hover:bg-blue-700"><Plus size={17} />Add schedule</button></div></form>
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-black">Current schedule entries</h2><div className="mt-4 divide-y divide-slate-100">{schedules.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 py-3"><div><p className="text-sm font-bold">{routeLabel(item.routeId)}</p><p className="text-xs text-slate-500">{item.period} · {item.time} · {item.days}</p></div><button type="button" onClick={() => deleteSchedule(item.id)} className="rounded-xl p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Delete schedule"><Trash2 size={17} /></button></div>)}</div></section>
          </div>
        )}

        {section === 'drivers' && (
          <div className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]">
            <form onSubmit={createNewDriver} className="h-fit rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-black">Register driver</h2><div className="mt-4 space-y-3"><input required value={driver.displayName} onChange={(event) => setDriver({ ...driver, displayName: event.target.value })} placeholder="Driver name" className={inputClass} /><input required value={driver.username} onChange={(event) => setDriver({ ...driver, username: event.target.value })} placeholder="Username" className={inputClass} /><input required type="password" value={driver.password} onChange={(event) => setDriver({ ...driver, password: event.target.value })} placeholder="Temporary password (8+ characters)" className={inputClass} /><button className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white hover:bg-blue-700"><Plus size={17} />Create driver account</button></div></form>
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-black">Registered drivers</h2><div className="mt-4 divide-y divide-slate-100">{drivers.map((driverItem) => <div key={driverItem.id} className="flex items-center justify-between gap-3 py-3"><div className="flex items-center gap-3"><span className="rounded-xl bg-blue-50 p-2.5 text-blue-600"><BusFront size={18} /></span><div><p className="text-sm font-bold">{driverItem.displayName}</p><p className="text-xs text-slate-500">@{driverItem.username}</p></div></div><button type="button" onClick={() => { if (window.confirm(`Delete ${driverItem.displayName}'s driver account? This cannot be undone.`)) { deleteDriver(driverItem.id); inform('Driver account deleted.'); } }} className="rounded-xl border border-red-200 p-2 text-red-600 transition hover:bg-red-50" aria-label={`Delete ${driverItem.displayName}`}><Trash2 size={17} /></button></div>)}</div></section>
          </div>
        )}

        {section === 'security' && (
          <form onSubmit={changePassword} className="max-w-xl rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="flex items-center gap-2 text-sm font-black text-amber-900"><KeyRound size={17} />Replace starter credential</p><p className="mt-1 text-xs leading-5 text-amber-800">Change the simple setup password before using the app beyond demonstration.</p></div><div className="mt-5 space-y-3"><input required type="password" value={password.current} onChange={(event) => setPassword({ ...password, current: event.target.value })} placeholder="Current password" className={inputClass} /><input required type="password" minLength={10} value={password.next} onChange={(event) => setPassword({ ...password, next: event.target.value })} placeholder="New password (10+ characters)" className={inputClass} /><button className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white hover:bg-blue-700"><KeyRound size={17} />Update administrator password</button></div></form>
        )}
      </section>
    </main>
  );
};
