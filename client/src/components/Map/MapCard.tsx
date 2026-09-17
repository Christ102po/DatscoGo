import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTransit } from '../../contexts/TransitContext';

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

const MapSizeInvalidator: React.FC = () => {
  const map = useMap();

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => map.invalidateSize());
    return () => window.cancelAnimationFrame(frame);
  }, [map]);

  return null;
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

export const MapCard: React.FC<{ focusedTerminalId?: string | null }> = ({ focusedTerminalId = null }) => {
  const [isMounted, setIsMounted] = useState(false);
  const [tilesLoaded, setTilesLoaded] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const { terminals, routes, accounts, activeTrips } = useTransit();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Siargao Island coordinates: Center around General Luna / Dapa
  const siargaoCenter: [number, number] = [9.8150, 126.0850];
  const selectedTrip = activeTrips.find((trip) => trip.id === selectedTripId) ?? null;
  const displayedRoute = selectedTrip?.status === 'departed' ? routes.find((route) => route.id === selectedTrip.routeId) : undefined;
  const liveTripCount = activeTrips.filter((trip) => trip.status === 'departed').length;

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
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={18}
            attribution="&copy; OpenStreetMap contributors"
            eventHandlers={{ load: () => setTilesLoaded(true) }}
          />
          {displayedRoute && <Polyline positions={displayedRoute.coordinates} pathOptions={{ color: '#1D4ED8', weight: 5, opacity: 0.85 }} />}
          {terminals.map((terminal) => <TerminalMarker key={terminal.id} terminal={terminal} focused={terminal.id === focusedTerminalId} />)}
          {displayedRoute?.waypoints?.map((waypoint) => <Marker key={waypoint.id} position={[waypoint.latitude, waypoint.longitude]} icon={L.divIcon({ className: 'datscogo-route-passing-point', html: '<div style="height:14px;width:14px;border:2px solid white;border-radius:999px;background:#1d4ed8;box-shadow:0 2px 5px rgba(15,23,42,.3)"></div>', iconSize: [14, 14], iconAnchor: [7, 7] })}><Popup><div className="text-xs font-bold text-slate-900">Route landmark</div><div className="mt-1 text-[10px] text-slate-500">{waypoint.label || 'Route path point'}</div></Popup></Marker>)}
          {activeTrips.map((trip) => {
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

      {/* Map floating control badge */}
      <div className="absolute bottom-2 right-2 z-20 bg-white/90 backdrop-blur px-2 py-1 rounded-md text-[9px] font-medium text-slate-700 shadow-sm border border-slate-200 pointer-events-none">
        {displayedRoute ? `Active route · ${displayedRoute.title}` : liveTripCount > 0 ? `${liveTripCount} live vehicle${liveTripCount === 1 ? '' : 's'} · select one to show its route` : activeTrips.length > 0 ? 'Vehicles are waiting at destination terminals' : 'Live vehicle updates appear here'}
      </div>
    </div>
  );
};
