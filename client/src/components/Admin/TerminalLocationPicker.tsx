import React, { useEffect } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface TerminalLocationPickerProps {
  value: { latitude: number; longitude: number } | null;
  onChange: (value: { latitude: number; longitude: number }) => void;
}

const selectedLocationIcon = L.divIcon({
  className: 'datscogo-terminal-selection',
  html: '<div style="height:28px;width:28px;border-radius:50% 50% 50% 0;background:#1d4ed8;border:3px solid #fff;box-shadow:0 4px 12px rgba(29,78,216,.45);transform:rotate(-45deg)"><div style="height:8px;width:8px;margin:7px;border-radius:50%;background:#fff"></div></div>',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

const MapClickListener: React.FC<TerminalLocationPickerProps> = ({ value, onChange }) => {
  const map = useMap();
  useMapEvents({ click: (event) => onChange({ latitude: event.latlng.lat, longitude: event.latlng.lng }) });

  useEffect(() => {
    if (value) map.panTo([value.latitude, value.longitude], { animate: true });
  }, [map, value]);

  return value ? <Marker position={[value.latitude, value.longitude]} icon={selectedLocationIcon} /> : null;
};

export const TerminalLocationPicker: React.FC<TerminalLocationPickerProps> = ({ value, onChange }) => (
  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
    <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3 py-2"><p className="text-xs font-bold text-slate-700">Click on Siargao to place the terminal</p><span className="text-[10px] font-semibold text-blue-600">{value ? `${value.latitude.toFixed(5)}, ${value.longitude.toFixed(5)}` : 'No pin selected'}</span></div>
    <MapContainer center={[9.815, 126.085]} zoom={11} scrollWheelZoom className="h-64 w-full sm:h-72" attributionControl>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={18} attribution="&copy; OpenStreetMap contributors" />
      <MapClickListener value={value} onChange={onChange} />
    </MapContainer>
  </div>
);
