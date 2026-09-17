import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Filter, LocateFixed, Navigation, X } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { isTripLocationStale, useTransit } from '../../contexts/TransitContext';
import { fetchRoadRoute } from '../../lib/routing';

// Fix default leaflet marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom Blue Pin icon
const blueIcon = L.divIcon({
  className: 'custom-pin-blue',
  html: `<div style="width: 20px; height: 20px; background: white; border: 2px solid #1D4ED8; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"><div style="width: 8px; height: 8px; background: #1D4ED8; border-radius: 50%;"></div></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10]
});

// Custom Amber Active Pin icon
const amberIcon = L.divIcon({
  className: 'custom-pin-amber',
  html: `<div style="width: 24px; height: 24px; background: white; border: 2px solid #F59E0B; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 8px rgba(0,0,0,0.3);"><div style="width: 10px; height: 10px; background: #F59E0B; border-radius: 50%;"></div></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});


const userIcon = L.divIcon({
  className: 'datscogo-user-marker',
  html: `<div style="display:flex;align-items:center;gap:4px"><div style="width:22px;height:22px;border-radius:50%;background:#2563eb;border:4px solid white;box-shadow:0 0 0 3px rgba(37,99,235,.22),0 4px 10px rgba(15,23,42,.25)"></div><span style="border-radius:999px;background:#1d4ed8;padding:3px 6px;color:white;font-family:ui-sans-serif,system-ui;font-size:8px;font-weight:800;box-shadow:0 2px 5px rgba(15,23,42,.2)">YOU</span></div>`,
  iconSize: [58, 26],
  iconAnchor: [11, 11],
});

const makeVehicleIcon = (status: 'departed' | 'arrived' | 'idle') => {
  const isLive = status === 'departed';
  const color = isLive ? '#16a34a' : '#64748b';
  const label = isLive ? 'LIVE' : 'ARRIVED';
  return L.divIcon({
    className: 'datscogo-vehicle-marker',
    html: `<div style="display:flex;align-items:center;gap:4px"><div style="display:flex;height:30px;width:30px;align-items:center;justify-content:center;border:3px solid #fff;border-radius:50%;background:${color};box-shadow:0 4px 12px rgba(22,163,74,.45);color:#fff;font-size:15px">🚌</div><span style="border-radius:999px;background:${color};padding:3px 6px;color:#fff;font-family:ui-sans-serif,system-ui;font-size:8px;font-weight:800;letter-spacing:.04em;box-shadow:0 2px 5px rgba(15,23,42,.2)">${label}</span></div>`,
    iconSize: [82, 34],
    iconAnchor: [15, 15],
  });
};

function formatLocationAge(lastUpdated: number, now: number) {
  const ageSeconds = Math.max(0, Math.floor((now - lastUpdated) / 1000));
  if (ageSeconds < 60) return `${ageSeconds}s ago`;
  const ageMinutes = Math.floor(ageSeconds / 60);
  return `${ageMinutes}m ago`;
}

const MapSizeInvalidator: React.FC = () => {
  const map = useMap();

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => map.invalidateSize());
    return () => window.cancelAnimationFrame(frame);
  }, [map]);

  return null;
};

interface MapSearchDestination {
  id: string;
  label: string;
  subtitle?: string;
  latitude: number;
  longitude: number;
}

const searchDestinationIcon = L.divIcon({
  className: 'datscogo-search-destination-marker',
  html: `<div style="display:flex;align-items:center;gap:4px"><div style="display:flex;height:28px;width:28px;align-items:center;justify-content:center;border:3px solid #fff;border-radius:50% 50% 50% 0;background:#1d4ed8;transform:rotate(-45deg);box-shadow:0 4px 10px rgba(29,78,216,.35)"><div style="height:8px;width:8px;border-radius:50%;background:#fff"></div></div><span style="border-radius:999px;background:#1d4ed8;padding:3px 7px;color:white;font-family:ui-sans-serif,system-ui;font-size:8px;font-weight:800;box-shadow:0 2px 5px rgba(15,23,42,.2)">DESTINATION</span></div>`,
  iconSize: [104, 34],
  iconAnchor: [14, 26],
});

const SearchDestinationMarker: React.FC<{ destination: MapSearchDestination }> = ({ destination }) => {
  const map = useMap();
  const markerRef = useRef<L.Marker>(null);

  useEffect(() => {
    map.flyTo([destination.latitude, destination.longitude], 15, { animate: true, duration: 0.7 });
    const popupTimer = window.setTimeout(() => markerRef.current?.openPopup(), 750);
    return () => window.clearTimeout(popupTimer);
  }, [destination.id, destination.latitude, destination.longitude, map]);

  return (
    <Marker ref={markerRef} position={[destination.latitude, destination.longitude]} icon={searchDestinationIcon}>
      <Popup>
        <div className="min-w-40">
          <div className="text-[9px] font-black uppercase tracking-wide text-blue-600">Selected destination</div>
          <div className="mt-1 text-xs font-black text-slate-900">{destination.label}</div>
          {destination.subtitle && <div className="mt-1 text-[10px] leading-4 text-slate-500">{destination.subtitle}</div>}
          <div className="mt-2 text-[10px] font-semibold text-blue-600">This stop is included in an administrator-published DatscoGo route.</div>
        </div>
      </Popup>
    </Marker>
  );
};

const TerminalMarker: React.FC<{ terminal: { id: string; name: string; details: string; latitude: number; longitude: number }; focused: boolean }> = ({ terminal, focused }) => {
  const map = useMap();
  const markerRef = useRef<L.Marker>(null);

  useEffect(() => {
    if (!focused) return;
    map.flyTo([terminal.latitude, terminal.longitude], 15, { animate: true, duration: 0.7 });
    const popupTimer = window.setTimeout(() => markerRef.current?.openPopup(), 750);
    return () => window.clearTimeout(popupTimer);
  }, [focused, map, terminal.latitude, terminal.longitude]);

  return <Marker ref={markerRef} position={[terminal.latitude, terminal.longitude]} icon={terminal.name === 'Dapa Terminal' ? amberIcon : blueIcon}>
    <Popup><div className="min-w-36"><div className="text-xs font-bold text-slate-900">{terminal.name}</div><div className="mt-1 text-[10px] leading-4 text-slate-500">{terminal.details}</div><div className="mt-2 text-[10px] font-semibold text-blue-600">{terminal.latitude.toFixed(5)}, {terminal.longitude.toFixed(5)}</div></div></Popup>
  </Marker>;
};

interface GuidanceRouteState {
  points: [number, number][];
  distanceMeters: number | null;
  durationSeconds: number | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
}

const UserLocationViewport: React.FC<{
  userLocation: { latitude: number; longitude: number };
}> = ({ userLocation }) => {
  const map = useMap();

  useEffect(() => {
    map.flyTo([userLocation.latitude, userLocation.longitude], Math.max(map.getZoom(), 15), {
      animate: true,
      duration: 0.7,
    });
  }, [map, userLocation.latitude, userLocation.longitude]);

  return null;
};

const GuidanceViewport: React.FC<{
  userLocation: { latitude: number; longitude: number };
  terminal: { latitude: number; longitude: number };
  routePoints: [number, number][];
}> = ({ userLocation, terminal, routePoints }) => {
  const map = useMap();

  useEffect(() => {
    const points = routePoints.length >= 2
      ? routePoints
      : [
          [userLocation.latitude, userLocation.longitude] as [number, number],
          [terminal.latitude, terminal.longitude] as [number, number],
        ];
    map.fitBounds(L.latLngBounds(points), { padding: [46, 46], maxZoom: 16, animate: true });
  }, [map, routePoints, terminal.latitude, terminal.longitude, userLocation.latitude, userLocation.longitude]);

  return null;
};

function formatGuidanceDistance(distanceMeters: number | null) {
  if (distanceMeters == null) return 'Distance unavailable';
  if (distanceMeters < 1000) return `${Math.round(distanceMeters)} m`;
  return `${(distanceMeters / 1000).toFixed(distanceMeters < 10000 ? 1 : 0)} km`;
}

function formatGuidanceDuration(durationSeconds: number | null) {
  if (durationSeconds == null) return 'ETA unavailable';
  const minutes = Math.max(1, Math.round(durationSeconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining ? `${hours} hr ${remaining} min` : `${hours} hr`;
}

export const MapCard: React.FC<{
  focusedTerminalId?: string | null;
  focusedSearchDestination?: MapSearchDestination | null;
  guidedTerminalId?: string | null;
  userLocation?: { latitude: number; longitude: number } | null;
  locationStatus?: string;
  onRequestLocation?: () => void;
  onStopGuidance?: () => void;
}> = ({
  focusedTerminalId = null,
  focusedSearchDestination = null,
  guidedTerminalId = null,
  userLocation = null,
  locationStatus = '',
  onRequestLocation,
  onStopGuidance,
}) => {
  const [isMounted, setIsMounted] = useState(false);
  const [tilesLoaded, setTilesLoaded] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [showLiveOnly, setShowLiveOnly] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const { terminals, routes, accounts, activeTrips } = useTransit();
  const guidedTerminal = terminals.find((terminal) => terminal.id === guidedTerminalId) ?? null;
  const [guidanceRoute, setGuidanceRoute] = useState<GuidanceRouteState>({ points: [], distanceMeters: null, durationSeconds: null, status: 'idle' });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Siargao Island coordinates: Center around General Luna / Dapa
  const siargaoCenter: [number, number] = [9.8150, 126.0850];
  const liveTripCount = activeTrips.filter((trip) => trip.status === 'departed').length;
  const visibleTrips = showLiveOnly ? activeTrips.filter((trip) => trip.status === 'departed') : activeTrips;
  const selectedTrip = activeTrips.find((trip) => trip.id === selectedTripId) ?? null;
  const displayedRoute = selectedTrip?.status === 'departed' ? routes.find((route) => route.id === selectedTrip.routeId) : undefined;
  const selectedDriver = selectedTrip ? accounts.find((account) => account.id === selectedTrip.driverId) : null;
  const selectedDestination = displayedRoute?.destination ?? 'destination terminal';
  const staleLiveTrips = activeTrips.filter((trip) => isTripLocationStale(trip, now));

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!guidedTerminal || !userLocation) {
      setGuidanceRoute({ points: [], distanceMeters: null, durationSeconds: null, status: 'idle' });
      return;
    }

    const controller = new AbortController();
    setGuidanceRoute((current) => ({ ...current, points: [], distanceMeters: null, durationSeconds: null, status: 'loading' }));

    const loadRoadRoute = async () => {
      try {
        const route = await fetchRoadRoute(
          [
            [userLocation.latitude, userLocation.longitude],
            [guidedTerminal.latitude, guidedTerminal.longitude],
          ],
          { signal: controller.signal, alternatives: true, prefer: 'shortest' },
        );

        setGuidanceRoute({
          points: route.points,
          distanceMeters: route.distanceMeters,
          durationSeconds: route.durationSeconds,
          status: 'ready',
        });
      } catch {
        if (controller.signal.aborted) return;
        // Never replace a failed road route with a misleading straight line.
        setGuidanceRoute({
          points: [],
          distanceMeters: null,
          durationSeconds: null,
          status: 'error',
        });
      }
    };

    loadRoadRoute();
    return () => controller.abort();
  }, [guidedTerminal?.id, guidedTerminal?.latitude, guidedTerminal?.longitude, userLocation?.latitude, userLocation?.longitude]);

  useEffect(() => {
    if (selectedTrip && selectedTrip.status !== 'departed') setSelectedTripId(null);
  }, [selectedTrip]);

  return (
    <div className="relative mb-3 min-h-[180px] flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-[#E8EEF5] shadow-inner sm:min-h-[220px] md:min-h-[260px] lg:min-h-[300px]">
      {isMounted ? (
        <MapContainer
          className="absolute inset-0 h-full w-full"
          center={siargaoCenter} 
          zoom={11} 
          scrollWheelZoom={false} 
          zoomControl={false}
          style={{ zIndex: 10 }}
        >
          <MapSizeInvalidator />
          {userLocation && !focusedTerminalId && !focusedSearchDestination && !guidedTerminal && (
            <UserLocationViewport userLocation={userLocation} />
          )}
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={18}
            attribution="&copy; OpenStreetMap contributors"
            eventHandlers={{ load: () => setTilesLoaded(true) }}
          />
          {guidedTerminal && userLocation && (
            <>
              <GuidanceViewport userLocation={userLocation} terminal={guidedTerminal} routePoints={guidanceRoute.points} />
              {guidanceRoute.points.length >= 2 && (
                <Polyline positions={guidanceRoute.points} pathOptions={{ color: '#2563EB', weight: 6, opacity: 0.92 }} />
              )}
            </>
          )}
          {displayedRoute && !guidedTerminal && <Polyline positions={displayedRoute.coordinates} pathOptions={{ color: '#1D4ED8', weight: 5, opacity: 0.85 }} />}
          {userLocation && <Marker position={[userLocation.latitude, userLocation.longitude]} icon={userIcon}><Popup><div className="min-w-32"><div className="text-xs font-bold text-blue-700">Your location</div><div className="mt-1 text-[10px] text-slate-500">Based on this device's GPS.</div><div className="mt-2 text-[10px] font-semibold text-blue-600">{userLocation.latitude.toFixed(5)}, {userLocation.longitude.toFixed(5)}</div></div></Popup></Marker>}
          {terminals.map((terminal) => <TerminalMarker key={terminal.id} terminal={terminal} focused={terminal.id === focusedTerminalId} />)}
          {focusedSearchDestination && <SearchDestinationMarker destination={focusedSearchDestination} />}
          {displayedRoute?.waypoints?.map((waypoint) => (
            <Marker
              key={waypoint.id}
              position={[waypoint.latitude, waypoint.longitude]}
              icon={L.divIcon({ className: 'datscogo-route-passing-point', html: '<div style="height:14px;width:14px;border:2px solid white;border-radius:999px;background:#1d4ed8;box-shadow:0 2px 5px rgba(15,23,42,.3)"></div>', iconSize: [14, 14], iconAnchor: [7, 7] })}
            >
              <Popup>
                <div className="text-xs font-bold text-slate-900">Route stop</div>
                <div className="mt-1 text-[10px] text-slate-500">{waypoint.label || 'Route path point'}</div>
                {(waypoint.regularFare != null || waypoint.studentFare != null || waypoint.seniorCitizenFare != null) && (
                  <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[9px]">
                    <div><p className="font-bold text-slate-700">Regular</p><p>₱{waypoint.regularFare ?? '—'}</p></div>
                    <div><p className="font-bold text-slate-700">Student</p><p>₱{waypoint.studentFare ?? '—'}</p></div>
                    <div><p className="font-bold text-slate-700">Senior</p><p>₱{waypoint.seniorCitizenFare ?? '—'}</p></div>
                  </div>
                )}
              </Popup>
            </Marker>
          ))}
          {visibleTrips.map((trip) => {
            const driver = accounts.find((account) => account.id === trip.driverId);
            const route = routes.find((item) => item.id === trip.routeId);
            const isLive = trip.status === 'departed';
            return <Marker key={trip.id} position={[trip.latitude, trip.longitude]} icon={makeVehicleIcon(trip.status)} eventHandlers={{ click: () => setSelectedTripId(isLive ? trip.id : null) }}>
              <Popup><div className={`text-xs font-bold ${isLive ? 'text-emerald-700' : 'text-slate-700'}`}>{driver?.displayName ?? 'DatscoGo vehicle'} · {isLive ? 'Live' : 'Arrived'}</div><div className="mt-1 text-[10px] text-slate-500">{route?.title ?? 'Route unavailable'} · Updated {new Date(trip.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>{isLive && <div className="mt-2 text-[10px] font-semibold text-blue-600">Select this vehicle to show its active route.</div>}{!isLive && <div className="mt-2 text-[10px] font-semibold text-slate-600">Vehicle is waiting at the destination terminal.</div>}</Popup>
            </Marker>;
          })}
        </MapContainer>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500 font-medium">
          Loading Siargao Island Map...
        </div>
      )}

      {isMounted && !tilesLoaded && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-slate-100/75 text-center backdrop-blur-[1px] pointer-events-none">
          <div className="rounded-2xl bg-white/95 px-4 py-3 shadow-sm ring-1 ring-slate-200">
            <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-blue-100 border-t-blue-600" />
            <p className="mt-2 text-xs font-bold text-slate-700">Loading Siargao Island map</p>
          </div>
        </div>
      )}

      <div className="absolute left-3 top-3 z-30 flex flex-wrap gap-2">
        <button type="button" aria-pressed={showLiveOnly} onClick={() => setShowLiveOnly((current) => !current)} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] font-bold shadow-sm backdrop-blur transition ${showLiveOnly ? 'border-emerald-300 bg-emerald-600 text-white' : 'border-slate-200 bg-white/95 text-slate-700 hover:bg-slate-50'}`}>
          <Filter size={12} /> Live only <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${showLiveOnly ? 'bg-white/20' : 'bg-emerald-100 text-emerald-700'}`}>{liveTripCount}</span>
        </button>
        {onRequestLocation && <button type="button" onClick={onRequestLocation} className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-white/95 px-2.5 py-1.5 text-[10px] font-bold text-blue-700 shadow-sm backdrop-blur transition hover:bg-blue-50"><LocateFixed size={12} /> {userLocation ? 'Refresh my GPS' : 'Show my GPS'}</button>}
      </div>

      {guidedTerminal && (
        <div className="absolute left-3 right-3 top-14 z-40 rounded-2xl border border-blue-200 bg-white/95 p-3 shadow-lg backdrop-blur sm:left-auto sm:right-3 sm:w-[330px]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-blue-600"><Navigation size={12} /> In-app guidance</div>
              <div className="mt-1 truncate text-sm font-black text-slate-900">To {guidedTerminal.name}</div>
              {userLocation ? (
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-semibold text-slate-600">
                  <span>{guidanceRoute.status === 'loading' ? 'Finding road route…' : formatGuidanceDistance(guidanceRoute.distanceMeters)}</span>
                  <span>{guidanceRoute.status === 'loading' ? 'Calculating ETA…' : formatGuidanceDuration(guidanceRoute.durationSeconds)}</span>
                </div>
              ) : (
                <div className="mt-1 text-[10px] font-semibold leading-4 text-amber-700">Allow GPS so DatscoGo can guide you from your current location.</div>
              )}
              {guidanceRoute.status === 'error' && userLocation && <div className="mt-1 text-[9px] leading-4 text-amber-700">Road routing is temporarily unavailable. DatscoGo will not draw an inaccurate straight-line route.</div>}
            </div>
            {onStopGuidance && (
              <button type="button" onClick={onStopGuidance} className="shrink-0 rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800" aria-label="Stop guidance" title="Stop guidance"><X size={14} /></button>
            )}
          </div>
          {!userLocation && onRequestLocation && <button type="button" onClick={onRequestLocation} className="mt-2 w-full rounded-xl bg-blue-600 px-3 py-2 text-[10px] font-black text-white transition hover:bg-blue-700"><LocateFixed size={12} className="mr-1 inline" />Enable GPS and start guidance</button>}
        </div>
      )}

      {staleLiveTrips.length > 0 && (
        <div className="absolute left-3 top-20 z-30 sm:top-12 inline-flex max-w-[calc(100%-1.5rem)] items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50/95 px-2.5 py-2 text-[10px] font-bold text-amber-800 shadow-sm backdrop-blur" role="status">
          <AlertTriangle size={13} className="shrink-0" />
          <span>{staleLiveTrips.length === 1 ? 'Live location delayed' : `${staleLiveTrips.length} live locations delayed`} · last update {formatLocationAge(staleLiveTrips[0].lastUpdated, now)}</span>
        </div>
      )}

      {locationStatus && <div className="absolute bottom-2 left-2 z-20 max-w-[55%] rounded-md border border-slate-200 bg-white/90 px-2 py-1 text-[9px] font-medium text-slate-600 shadow-sm backdrop-blur pointer-events-none">{locationStatus}</div>}

      <div className="absolute bottom-2 right-2 z-20 bg-white/90 backdrop-blur px-2 py-1 rounded-md text-[9px] font-medium text-slate-700 shadow-sm border border-slate-200 pointer-events-none">
        {guidedTerminal ? `Guidance · ${guidedTerminal.name}` : displayedRoute ? `${selectedDriver?.displayName ?? 'Selected vehicle'} · To ${selectedDestination}` : liveTripCount > 0 ? `${liveTripCount} live vehicle${liveTripCount === 1 ? '' : 's'} · select one to show its route` : activeTrips.length > 0 ? 'Vehicles are waiting at destination terminals' : 'Live vehicle updates appear here'}
      </div>
    </div>
  );
};
