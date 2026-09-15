import { useEffect } from "react";
import { DivIcon, LatLngBounds } from "leaflet";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { Driver, LatLng, Terminal } from "../types/datsco";

const siargaoCenter: [number, number] = [9.8482, 126.0458];

function dotIcon(label: string, background: string) {
  return new DivIcon({
    className: "datsco-div-icon",
    html: `<div style="width:34px;height:34px;border-radius:999px;background:${background};color:white;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 4px 14px rgba(15,23,42,.28);font-size:15px;font-weight:900">${label}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

const terminalIcon = dotIcon("T", "#2563eb");
const driverIcon = dotIcon("D", "#059669");
const userIcon = dotIcon("●", "#7c3aed");
const waypointIcon = dotIcon("•", "#f59e0b");

function FitToData({ routePoints, userPosition, terminals }: {
  routePoints: LatLng[];
  userPosition?: LatLng | null;
  terminals: Terminal[];
}) {
  const map = useMap();
  useEffect(() => {
    const points: [number, number][] = [];
    routePoints.forEach((point) => points.push([point.lat, point.lng]));
    if (!routePoints.length && userPosition) points.push([userPosition.lat, userPosition.lng]);
    if (!routePoints.length && !userPosition) terminals.forEach((t) => points.push([t.lat, t.lng]));
    if (points.length === 1) map.setView(points[0], 15, { animate: true });
    if (points.length > 1) map.fitBounds(new LatLngBounds(points), { padding: [45, 45] });
  }, [map, routePoints, terminals, userPosition]);
  return null;
}

function ClickCapture({ onMapClick }: { onMapClick?: (point: LatLng) => void }) {
  useMapEvents({
    click(event) {
      onMapClick?.({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
  });
  return null;
}

export function DatscoMap({
  terminals,
  drivers = [],
  userPosition,
  routePoints = [],
  editableWaypoints = [],
  onMapClick,
  onWaypointMove,
  heightClass = "h-[440px]",
}: {
  terminals: Terminal[];
  drivers?: Driver[];
  userPosition?: LatLng | null;
  routePoints?: LatLng[];
  editableWaypoints?: LatLng[];
  onMapClick?: (point: LatLng) => void;
  onWaypointMove?: (index: number, point: LatLng) => void;
  heightClass?: string;
}) {
  return (
    <div className={`overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm ${heightClass}`}>
      <MapContainer center={siargaoCenter} zoom={11} className="h-full w-full" scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickCapture onMapClick={onMapClick} />
        <FitToData routePoints={routePoints} userPosition={userPosition} terminals={terminals} />
        {terminals.map((terminal) => (
          <Marker key={terminal.id} position={[terminal.lat, terminal.lng]} icon={terminalIcon}>
            <Popup>
              <strong>{terminal.name}</strong>
              {terminal.address ? <div>{terminal.address}</div> : null}
            </Popup>
          </Marker>
        ))}
        {drivers.filter((driver) => driver.lat != null && driver.lng != null).map((driver) => (
          <Marker key={driver.id} position={[driver.lat!, driver.lng!]} icon={driverIcon}>
            <Popup>
              <strong>{driver.name}</strong>
              <div>{driver.updatedAt ? `Updated ${new Date(driver.updatedAt).toLocaleTimeString()}` : "Waiting for location"}</div>
            </Popup>
          </Marker>
        ))}
        {userPosition ? (
          <Marker position={[userPosition.lat, userPosition.lng]} icon={userIcon}>
            <Popup>Your current location</Popup>
          </Marker>
        ) : null}
        {routePoints.length > 1 ? (
          <Polyline positions={routePoints.map((point) => [point.lat, point.lng])} pathOptions={{ weight: 6, opacity: 0.9 }} />
        ) : null}
        {editableWaypoints.map((point, index) => (
          <Marker
            key={`${index}-${point.lat}-${point.lng}`}
            position={[point.lat, point.lng]}
            icon={waypointIcon}
            draggable
            eventHandlers={{
              dragend(event) {
                const next = event.target.getLatLng();
                onWaypointMove?.(index, { lat: next.lat, lng: next.lng });
              },
            }}
          >
            <Popup>Waypoint {index + 1} — drag to adjust</Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
