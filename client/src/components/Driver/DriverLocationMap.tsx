import React, { useEffect } from 'react';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { TransitRoute } from '../../contexts/TransitContext';

const driverIcon = L.divIcon({
  className: 'datscogo-driver-phone-marker',
  html: '<div style="display:flex;align-items:center;gap:5px"><div style="display:flex;width:30px;height:30px;align-items:center;justify-content:center;border-radius:50%;border:4px solid white;background:#16a34a;box-shadow:0 4px 12px rgba(15,23,42,.3);font-size:15px">🚌</div><span style="border-radius:999px;background:#16a34a;padding:3px 7px;color:white;font-family:ui-sans-serif,system-ui;font-size:8px;font-weight:800;box-shadow:0 2px 5px rgba(15,23,42,.2)">YOUR GPS</span></div>',
  iconSize: [92, 34],
  iconAnchor: [15, 15],
});

const routePointIcon = L.divIcon({
  className: 'datscogo-driver-route-point',
  html: '<div style="height:12px;width:12px;border-radius:50%;border:2px solid white;background:#1d4ed8;box-shadow:0 2px 6px rgba(15,23,42,.25)"></div>',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

const ResizeAndFollow: React.FC<{ location: { latitude: number; longitude: number } | null }> = ({ location }) => {
  const map = useMap();

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => map.invalidateSize());
    return () => window.cancelAnimationFrame(frame);
  }, [map]);

  useEffect(() => {
    if (location) map.flyTo([location.latitude, location.longitude], Math.max(map.getZoom(), 14), { animate: true, duration: 0.6 });
  }, [location?.latitude, location?.longitude, map]);

  return null;
};

interface DriverLocationMapProps {
  location: { latitude: number; longitude: number } | null;
  route?: TransitRoute;
}

export const DriverLocationMap: React.FC<DriverLocationMapProps> = ({ location, route }) => {
  const center: [number, number] = location ? [location.latitude, location.longitude] : route?.coordinates[0] ?? [9.815, 126.085];

  return (
    <div className="relative h-64 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 sm:h-72 lg:h-80">
      <MapContainer center={center} zoom={location ? 14 : 11} scrollWheelZoom className="h-full w-full" zoomControl={false}>
        <ResizeAndFollow location={location} />
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={18} attribution="&copy; OpenStreetMap contributors" />
        {route && <Polyline positions={route.coordinates} pathOptions={{ color: '#1D4ED8', weight: 5, opacity: 0.8 }} />}
        {route?.waypoints?.map((point) => <Marker key={point.id} position={[point.latitude, point.longitude]} icon={routePointIcon}><Popup><div className="text-xs font-bold">{point.label || 'Route stop'}</div></Popup></Marker>)}
        {location && <Marker position={[location.latitude, location.longitude]} icon={driverIcon}><Popup><div className="text-xs font-black text-emerald-700">Driver phone GPS</div><div className="mt-1 text-[10px] text-slate-500">This position becomes the live DatscoGo vehicle location after departure starts.</div></Popup></Marker>}
      </MapContainer>
      {!location && <div className="pointer-events-none absolute inset-x-3 bottom-3 z-[500] rounded-xl border border-amber-200 bg-amber-50/95 px-3 py-2 text-center text-xs font-bold text-amber-800 shadow-sm">Allow location access to show this phone on the map.</div>}
    </div>
  );
};
