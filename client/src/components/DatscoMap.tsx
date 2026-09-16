import { useEffect } from "react";
import { DivIcon, LatLngBounds } from "leaflet";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { formatDistance } from "../lib/routing";
import type { Driver, DriverTrip, LatLng, SearchPlace, Terminal, TransitRoute } from "../types/datsco";

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
const arrivedDriverIcon = dotIcon("D", "#64748b");
const userIcon = dotIcon("●", "#7c3aed");
const waypointIcon = dotIcon("•", "#f59e0b");
const searchIcon = dotIcon("⌖", "#0f172a");

function FitToData({ routePoints, focusPoint, userPosition, terminals }: {
  routePoints: LatLng[];
  focusPoint?: LatLng | null;
  userPosition?: LatLng | null;
  terminals: Terminal[];
}) {
  const map = useMap();
  useEffect(() => {
    if (focusPoint) {
      map.setView([focusPoint.lat, focusPoint.lng], 16, { animate: true });
      return;
    }
    const points: [number, number][] = [];
    routePoints.forEach((point) => points.push([point.lat, point.lng]));
    if (!routePoints.length && userPosition) points.push([userPosition.lat, userPosition.lng]);
    if (!routePoints.length && !userPosition) terminals.forEach((t) => points.push([t.lat, t.lng]));
    if (points.length === 1) map.setView(points[0], 15, { animate: true });
    if (points.length > 1) map.fitBounds(new LatLngBounds(points), { padding: [45, 45] });
  }, [map, routePoints, terminals, userPosition, focusPoint]);
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
  routes = [],
  drivers = [],
  trips = [],
  userPosition,
  routePoints = [],
  focusPoint,
  searchedPlace,
  searchedPlaceDetails,
  driverDistanceMeters = {},
  editableWaypoints = [],
  onMapClick,
  onWaypointMove,
  onDriverClick,
  heightClass = "h-[440px]",
}: {
  terminals: Terminal[];
  routes?: TransitRoute[];
  drivers?: Driver[];
  trips?: DriverTrip[];
  userPosition?: LatLng | null;
  routePoints?: LatLng[];
  focusPoint?: LatLng | null;
  searchedPlace?: SearchPlace | null;
  searchedPlaceDetails?: string[];
  driverDistanceMeters?: Record<string, number | undefined>;
  editableWaypoints?: LatLng[];
  onMapClick?: (point: LatLng) => void;
  onWaypointMove?: (index: number, point: LatLng) => void;
  onDriverClick?: (driver: Driver, trip?: DriverTrip) => void;
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
        <FitToData routePoints={routePoints} focusPoint={focusPoint} userPosition={userPosition} terminals={terminals} />

        {terminals.map((terminal) => (
          <Marker key={terminal.id} position={[terminal.lat, terminal.lng]} icon={terminalIcon}>
            <Popup>
              <strong>{terminal.name}</strong>
              {terminal.address ? <div>{terminal.address}</div> : null}
            </Popup>
          </Marker>
        ))}

        {drivers
          .filter((driver) => driver.lat != null && driver.lng != null && driver.tripStatus !== "idle")
          .map((driver) => {
            const trip = trips.find((item) =>
              item.driverId === driver.id && (item.id === driver.activeTripId || item.status === driver.tripStatus),
            );
            const route = routes.find((item) => item.id === trip?.routeId || item.id === driver.routeId);
            const from = terminals.find((item) => item.id === route?.fromTerminalId);
            const to = terminals.find((item) => item.id === route?.toTerminalId);
            const distance = driverDistanceMeters[driver.id];
            return (
              <Marker
                key={driver.id}
                position={[driver.lat!, driver.lng!]}
                icon={driver.tripStatus === "arrived" ? arrivedDriverIcon : driverIcon}
                eventHandlers={{ click: () => onDriverClick?.(driver, trip) }}
              >
                <Popup>
                  <strong>{driver.name}</strong>
                  <div>{driver.tripStatus === "active" ? "Trip in progress" : "Arrived"}</div>
                  {route ? <div>Route: {route.name}</div> : null}
                  {from && to ? <div>{from.name} → {to.name}</div> : null}
                  {trip?.startedAt ? <div>Departed: {new Date(trip.startedAt).toLocaleString()}</div> : null}
                  {trip?.arrivedAt ? <div>Arrived: {new Date(trip.arrivedAt).toLocaleString()}</div> : null}
                  {typeof distance === "number" ? <div>Estimated road distance from you: {formatDistance(distance)}</div> : null}
                  <div>{driver.updatedAt ? `Location updated ${new Date(driver.updatedAt).toLocaleTimeString()}` : "Waiting for location"}</div>
                </Popup>
              </Marker>
            );
          })}

        {userPosition ? (
          <Marker position={[userPosition.lat, userPosition.lng]} icon={userIcon}>
            <Popup>Your current location</Popup>
          </Marker>
        ) : null}

        {searchedPlace ? (
          <Marker position={[searchedPlace.lat, searchedPlace.lng]} icon={searchIcon}>
            <Popup>
              <strong>{searchedPlace.name}</strong>
              <div>{searchedPlace.subtitle}</div>
              {(searchedPlaceDetails || []).map((line) => <div key={line}>{line}</div>)}
            </Popup>
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
