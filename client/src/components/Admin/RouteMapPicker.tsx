import React, { useMemo, useState } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { RouteWaypoint, Terminal } from '../../contexts/TransitContext';

type RoutePoint = [number, number];
type SelectionMode = 'origin' | 'destination' | 'waypoint';

interface RouteMapPickerProps {
  terminals: Terminal[];
  originTerminalId: string;
  destinationTerminalId: string;
  points: RouteWaypoint[];
  onOriginChange: (terminal: Terminal) => void;
  onDestinationChange: (terminal: Terminal) => void;
  onPointsChange: (points: RouteWaypoint[]) => void;
}

const makeIcon = (color: string, label: string) => L.divIcon({
  className: 'datscogo-route-terminal-marker',
  html: `<div style="display:flex;align-items:center;justify-content:center;width:27px;height:27px;border-radius:50%;border:3px solid white;background:${color};box-shadow:0 3px 10px rgba(15,23,42,.25);color:white;font-size:11px;font-weight:800">${label}</div>`,
  iconSize: [27, 27], iconAnchor: [13, 13],
});
const waypointIcon = makeIcon('#64748b', '•');

const MapClicker: React.FC<{ mode: SelectionMode; onMapClick: (point: RoutePoint) => void }> = ({ mode, onMapClick }) => {
  useMapEvents({ click: (event) => { if (mode === 'waypoint') onMapClick([event.latlng.lat, event.latlng.lng]); } });
  return null;
};

export const RouteMapPicker: React.FC<RouteMapPickerProps> = ({ terminals, originTerminalId, destinationTerminalId, points, onOriginChange, onDestinationChange, onPointsChange }) => {
  const [mode, setMode] = useState<SelectionMode>('origin');
  const origin = terminals.find((terminal) => terminal.id === originTerminalId);
  const destination = terminals.find((terminal) => terminal.id === destinationTerminalId);
  const routeLine = useMemo<RoutePoint[]>(() => [
    ...(origin ? [[origin.latitude, origin.longitude] as RoutePoint] : []),
    ...points.map((point) => [point.latitude, point.longitude] as RoutePoint),
    ...(destination ? [[destination.latitude, destination.longitude] as RoutePoint] : []),
  ], [destination, origin, points]);

  const selectTerminal = (terminal: Terminal) => {
    if (mode === 'origin') onOriginChange(terminal);
    if (mode === 'destination') onDestinationChange(terminal);
  };

  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
      <div className="border-b border-slate-200 bg-white px-4 py-3">
        <p className="text-xs font-black text-slate-800">Route map planner</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">Choose the terminals, then trace the actual travel path by adding landmarks in travel order. These form the passenger-visible route path.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {([['origin', '1. Select origin'], ['destination', '2. Select destination'], ['waypoint', '3. Trace route path']] as Array<[SelectionMode, string]>).map(([value, label]) => (
            <button key={value} type="button" onClick={() => setMode(value)} className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${mode === value ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{label}</button>
          ))}
          <button type="button" onClick={() => onPointsChange([])} className="ml-auto rounded-full px-3 py-1.5 text-xs font-bold text-slate-500 transition hover:bg-red-50 hover:text-red-600">Clear path</button>
        </div>
      </div>
      <MapContainer center={[9.815, 126.085]} zoom={11} scrollWheelZoom className="h-72 w-full sm:h-80" attributionControl>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={18} attribution="&copy; OpenStreetMap contributors" />
        <MapClicker mode={mode} onMapClick={([latitude, longitude]) => onPointsChange([...points, { id: `waypoint-${Date.now()}-${points.length}`, latitude, longitude, label: '' }])} />
        {routeLine.length >= 2 && <Polyline positions={routeLine} pathOptions={{ color: '#1d4ed8', weight: 5, opacity: 0.85 }} />}
        {terminals.map((terminal) => {
          const isOrigin = terminal.id === originTerminalId; const isDestination = terminal.id === destinationTerminalId;
          return <Marker key={terminal.id} position={[terminal.latitude, terminal.longitude]} icon={makeIcon(isOrigin ? '#16a34a' : isDestination ? '#ea580c' : '#1d4ed8', isOrigin ? 'A' : isDestination ? 'B' : '•')} eventHandlers={{ click: () => selectTerminal(terminal) }} />;
        })}
        {points.map((point, index) => <Marker key={point.id} position={[point.latitude, point.longitude]} icon={waypointIcon} eventHandlers={{ click: () => onPointsChange(points.filter((_, pointIndex) => pointIndex !== index)) }} />)}
      </MapContainer>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-white px-4 py-2 text-[11px] text-slate-500"><span><b className="text-emerald-600">A</b> {origin?.name ?? 'Select origin terminal'}</span><span><b className="text-orange-600">B</b> {destination?.name ?? 'Select destination terminal'}</span><span>{points.length} route landmark{points.length === 1 ? '' : 's'} · click a point to remove it</span></div>
    </section>
  );
};
