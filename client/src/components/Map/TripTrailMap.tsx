import React, { useEffect } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const startPin = L.divIcon({ className: 'trip-start-marker', html: '<div style="width:18px;height:18px;border:3px solid white;border-radius:50%;background:#16a34a;box-shadow:0 2px 5px #0005"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });
const endPin = L.divIcon({ className: 'trip-end-marker', html: '<div style="width:18px;height:18px;border:3px solid white;border-radius:50%;background:#dc2626;box-shadow:0 2px 5px #0005"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });

function FitTrail({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    const bounds = L.latLngBounds(points.map(([lat, lng]) => L.latLng(lat, lng)));
    const frame = window.requestAnimationFrame(() => {
      map.invalidateSize();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [28, 28], maxZoom: 16 });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [map, points]);
  return null;
}

export function TripTrailMap({ points }: { points: [number, number, number][] }) {
  const valid = points.filter(([lat, lng, time]) => Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(time) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180);
  const path: [number, number][] = valid.map(([lat, lng]) => [lat, lng]);
  if (!path.length) return <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">No GPS samples were recorded for this trip. The time record is still available.</div>;
  const start = valid[0];
  const finish = valid[valid.length - 1];
  return <div className="h-[340px] w-full overflow-hidden rounded-xl border border-slate-200 sm:h-[430px]">
    <MapContainer center={path[0]} zoom={13} scrollWheelZoom={true} style={{ width: '100%', height: '100%' }}>
      <TileLayer attribution='&copy; OpenStreetMap contributors &copy; Esri' url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxZoom={19} />
      <FitTrail points={path} />
      {path.length >= 2 && <Polyline positions={path} pathOptions={{ color: '#f97316', weight: 5, opacity: .95 }} />}
      <Marker position={path[0]} icon={startPin}><Tooltip direction="top">Departure GPS: {new Date(start[2]).toLocaleString()}</Tooltip></Marker>
      <Marker position={path[path.length - 1]} icon={endPin}><Tooltip direction="top">Last GPS: {new Date(finish[2]).toLocaleString()}</Tooltip></Marker>
    </MapContainer>
  </div>;
}
