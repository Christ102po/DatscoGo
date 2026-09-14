import React, { useEffect, useMemo, useState } from 'react';
import { BellRing, CheckCircle2, CircleDotDashed, Clock3, LogOut, MapPin, Navigation, RadioTower, RefreshCw, Route, ShieldCheck } from 'lucide-react';
import { DatscoLogo } from '../../assets/svg/DatscoLogo';
import { useTransit } from '../../contexts/TransitContext';
import { DriverLocationMap } from './DriverLocationMap';
import { LocationPermissionPrompt } from '../Common/LocationPermissionPrompt';

interface DriverDashboardProps {
  onLogout: () => void;
}

export const DriverDashboard: React.FC<DriverDashboardProps> = ({ onLogout }) => {
  const { currentUser, routes, activeTrips, startTrip, updateTripLocation, arriveTrip } = useTransit();
  const [selectedRouteId, setSelectedRouteId] = useState(routes[0]?.id ?? '');
  const [locationMessage, setLocationMessage] = useState('Location sharing is off.');
  const [isLocating, setIsLocating] = useState(false);
  const [deviceLocation, setDeviceLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showLocationPermission, setShowLocationPermission] = useState(false);
  const [locationConsent, setLocationConsent] = useState(false);
  const [pendingLocationAction, setPendingLocationAction] = useState<'initial' | 'departure' | 'update'>('initial');

  const availableRoutes = routes.filter((route) => route.available);
  const selectedRoute = routes.find((route) => route.id === selectedRouteId) ?? availableRoutes[0];
  const ownTrip = activeTrips.find((trip) => trip.driverId === currentUser?.id) ?? null;
  const tripRoute = useMemo(() => routes.find((route) => route.id === ownTrip?.routeId), [ownTrip?.routeId, routes]);

  const useDeviceLocation = (callback: (location: { latitude: number; longitude: number }) => void) => {
    if (!navigator.geolocation) {
      setLocationMessage('This device does not support location services, so live GPS sharing cannot start.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        setDeviceLocation(location);
        setLocationConsent(true);
        setShowLocationPermission(false);
        callback(location);
        setLocationMessage(`Location shared at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`);
        setIsLocating(false);
      },
      (error) => {
        setShowLocationPermission(false);
        setLocationConsent(false);
        setLocationMessage(error.code === error.PERMISSION_DENIED
          ? 'Location permission was denied. Enable it in your browser/site settings before starting live GPS sharing.'
          : 'Your GPS location is unavailable right now. Check phone location services and try again.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    );
  };

  const requestDriverPermission = () => {
    setShowLocationPermission(false);
    useDeviceLocation((location) => {
      if (!currentUser) return;
      if (pendingLocationAction === 'departure' && selectedRoute) {
        startTrip(currentUser.id, selectedRoute.id, location);
      } else if (pendingLocationAction === 'update' && ownTrip) {
        updateTripLocation(currentUser.id, location);
      }
      setPendingLocationAction('initial');
    });
  };

  const handleDeparture = () => {
    if (!currentUser || !selectedRoute) return;
    if (!locationConsent) {
      setPendingLocationAction('departure');
      setShowLocationPermission(true);
      setLocationMessage('Allow location access before starting a departure so passengers can receive the Datsco GPS position.');
      return;
    }
    useDeviceLocation((location) => startTrip(currentUser.id, selectedRoute.id, location));
  };

  const handleLocationUpdate = () => {
    if (!ownTrip || !currentUser) return;
    if (!locationConsent) {
      setPendingLocationAction('update');
      setShowLocationPermission(true);
      return;
    }
    useDeviceLocation((location) => updateTripLocation(currentUser.id, location));
  };

  useEffect(() => {
    let cancelled = false;

    const prepareDriverPermission = async () => {
      if (!navigator.geolocation) {
        setLocationMessage('This device does not support location services.');
        return;
      }

      try {
        if (navigator.permissions?.query) {
          const permission = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
          if (cancelled) return;
          if (permission.state === 'granted') {
            setLocationConsent(true);
            useDeviceLocation(() => undefined);
            return;
          }
          if (permission.state === 'denied') {
            setLocationMessage('Location is blocked in your browser/site settings. Enable it before starting a departure.');
          }
        }
      } catch {
        // Permission API is not available on every mobile browser.
      }

      if (!cancelled) {
        setPendingLocationAction('initial');
        setShowLocationPermission(true);
      }
    };

    prepareDriverPermission();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!currentUser || ownTrip?.status !== 'departed' || !navigator.geolocation || !locationConsent) return;

    setLocationMessage('Live location refresh is active while this driver dashboard is open.');
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const location = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        setDeviceLocation(location);
        updateTripLocation(currentUser.id, location);
        setLocationMessage(`Live location refreshed at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`);
      },
      () => setLocationMessage('Live refresh needs location permission. Use Update location to retry.'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [currentUser?.id, ownTrip?.status, updateTripLocation, locationConsent]);

  return (
    <main className="min-h-[100dvh] bg-slate-50 text-slate-900">
      <header className="flex items-center justify-between bg-[#1D4ED8] px-5 py-4 text-white shadow-lg shadow-blue-900/10 sm:px-8">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20"><DatscoLogo size={24} color="#ffffff" /></span>
          <div>
            <p className="text-lg font-black tracking-tight">Datsco<span className="text-blue-100">Go</span></p>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-100">Driver operations</p>
          </div>
        </div>
        <button type="button" onClick={onLogout} className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-95"><LogOut size={16} /> <span className="hidden sm:inline">Logout</span></button>
      </header>

      <div className="mx-auto grid w-full max-w-6xl gap-6 p-4 sm:p-6 lg:grid-cols-[1.3fr_0.7fr] lg:p-8">
        <section className="space-y-5">
          <div className="rounded-3xl bg-gradient-to-br from-blue-700 to-blue-500 p-6 text-white shadow-xl shadow-blue-600/20">
            <p className="text-sm font-medium text-blue-100">Welcome back</p>
            <h1 className="mt-1 text-2xl font-black">{currentUser?.displayName ?? 'Driver'}</h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-blue-50">Use this dashboard to announce a departure, keep passenger trip status current, and confirm your arrival at the destination.</p>
          </div>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-600">Trip control</p>
                <h2 className="mt-1 text-xl font-black text-slate-900">{ownTrip ? 'Active service' : 'Start a service'}</h2>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${ownTrip?.status === 'departed' ? 'bg-emerald-100 text-emerald-700' : ownTrip?.status === 'arrived' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>{ownTrip?.status === 'departed' ? 'In transit' : ownTrip?.status === 'arrived' ? 'At destination' : 'Not on duty'}</span>
            </div>

            {(!ownTrip || ownTrip.status === 'arrived') && (
              <label className="block">
                <span className="mb-2 block text-xs font-bold text-slate-700">Departure route</span>
                <select value={selectedRouteId} onChange={(event) => setSelectedRouteId(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100">
                  {availableRoutes.map((route) => <option key={route.id} value={route.id}>{route.title} · ₱{route.fare}</option>)}
                </select>
              </label>
            )}

            {ownTrip && tripRoute && (
              <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
                <div className="flex items-center gap-3">
                  <span className="rounded-xl bg-blue-600 p-2 text-white"><Route size={19} /></span>
                  <div><p className="text-sm font-bold text-slate-900">{tripRoute.title}</p><p className="mt-0.5 text-xs text-slate-500">Last update {new Date(ownTrip.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p></div>
                </div>
              </div>
            )}

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {!ownTrip || ownTrip.status === 'arrived' ? (
                <button type="button" disabled={!selectedRoute || isLocating} onClick={handleDeparture} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98]"><Navigation size={18} /> {isLocating ? 'Getting location…' : 'Start departure'}</button>
              ) : (
                <button type="button" disabled={isLocating} onClick={handleLocationUpdate} className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98]"><RefreshCw className={isLocating ? 'animate-spin' : ''} size={18} /> {isLocating ? 'Getting location…' : 'Update location'}</button>
              )}
              {ownTrip?.status === 'departed' && <button type="button" onClick={() => currentUser && arriveTrip(currentUser.id)} className="flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-bold text-blue-700 transition hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 active:scale-[0.98]"><CheckCircle2 size={18} /> Mark as arrived</button>}
            </div>
            <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-500"><MapPin size={15} className="mt-0.5 shrink-0 text-blue-600" /> {locationMessage} Passengers see the latest saved vehicle position in their DatscoGo view.</p>
            <div className="mt-4"><DriverLocationMap location={deviceLocation ?? (ownTrip ? { latitude: ownTrip.latitude, longitude: ownTrip.longitude } : null)} route={tripRoute ?? selectedRoute} /></div>
          </section>
        </section>

        <aside className="space-y-5">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-black text-slate-900"><RadioTower size={18} className="text-blue-600" /> Service status</h2>
            <div className="mt-4 space-y-3">
              {[
                [CircleDotDashed, 'Departure', ownTrip?.status === 'departed' ? 'Broadcast to passengers' : 'Waiting for driver action'],
                [Clock3, 'Latest report', ownTrip ? new Date(ownTrip.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'No trip location reported'],
                [BellRing, 'Arrival', ownTrip?.status === 'arrived' ? 'Arrival confirmed' : 'Confirm when destination is reached'],
              ].map(([Icon, label, detail]) => {
                const StatusIcon = Icon as typeof CircleDotDashed;
                return <div key={label as string} className="flex gap-3"><span className="mt-0.5 rounded-lg bg-slate-100 p-2 text-slate-500"><StatusIcon size={15} /></span><div><p className="text-xs font-bold text-slate-800">{label as string}</p><p className="mt-0.5 text-xs leading-5 text-slate-500">{detail as string}</p></div></div>;
              })}
            </div>
          </section>
          <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
            <h2 className="flex items-center gap-2 text-sm font-black text-amber-900"><ShieldCheck size={18} /> Driver reminder</h2>
            <p className="mt-2 text-xs leading-5 text-amber-800">Only start a departure when passengers can board. Mark the route as arrived when the vehicle reaches its destination; the passenger map will retain that terminal position until the next trip begins.</p>
          </section>
        </aside>
      </div>

      <LocationPermissionPrompt
        open={showLocationPermission}
        mode="driver"
        isRequesting={isLocating}
        onAllow={requestDriverPermission}
        onNotNow={() => {
          setShowLocationPermission(false);
          setPendingLocationAction('initial');
          setLocationMessage('Location access was skipped. Allow GPS before starting a departure to share the live Datsco position.');
        }}
      />
    </main>
  );
};
