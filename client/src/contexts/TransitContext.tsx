import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

export type UserRole = 'passenger' | 'driver' | 'admin';
export type TripStatus = 'idle' | 'departed' | 'arrived';

export interface Account {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  passwordHash: string;
  active: boolean;
}

export interface RouteWaypoint {
  id: string;
  latitude: number;
  longitude: number;
  /** Barangay, junction, landmark, or passenger-visible stop name. */
  label: string;
  /** Fare from the route origin to this stop. */
  regularFare?: number | null;
  studentFare?: number | null;
  seniorCitizenFare?: number | null;
}

export interface TransitRoute {
  id: string;
  title: string;
  origin: string;
  destination: string;
  originTerminalId: string;
  destinationTerminalId: string;
  type: 'bus' | 'ferry';
  /** Full-route regular fare. */
  fare: number;
  /** Legacy field retained only so old saved data can be migrated. */
  discountedFare?: number | null;
  /** Full-route student fare. */
  studentFare?: number | null;
  /** Full-route senior citizen fare. */
  seniorCitizenFare?: number | null;
  eta: string;
  duration: string;
  available: boolean;
  coordinates: [number, number][];
  waypoints?: RouteWaypoint[];
}

export interface ScheduleEntry {
  id: string;
  routeId: string;
  time: string;
  period: 'Morning' | 'Afternoon';
  days: string;
}

export interface Terminal {
  id: string;
  name: string;
  details: string;
  latitude: number;
  longitude: number;
}

export interface ActiveTrip {
  id: string;
  driverId: string;
  routeId: string;
  status: TripStatus;
  latitude: number;
  longitude: number;
  lastUpdated: number;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  createdAt: number;
  active: boolean;
}

export interface ContactDetails {
  facebook: string;
  phone: string;
  email: string;
}

interface TransitStore {
  accounts: Account[];
  routes: TransitRoute[];
  schedules: ScheduleEntry[];
  terminals: Terminal[];
  activeTrips: ActiveTrip[];
  announcements: Announcement[];
  contact: ContactDetails;
}

type StoredTransitStore = Omit<TransitStore, 'activeTrips' | 'announcements'> & {
  activeTrips?: ActiveTrip[];
  activeTrip?: ActiveTrip | null;
  announcements?: Announcement[];
};

type PublicTransitState = Pick<TransitStore, 'routes' | 'schedules' | 'terminals' | 'announcements' | 'contact'>;

interface TransitContextValue extends TransitStore {
  currentUser: Omit<Account, 'passwordHash'> | null;
  isReady: boolean;
  login: (username: string, password: string) => Promise<UserRole | null>;
  logout: () => void;
  createDriver: (input: { displayName: string; username: string; password: string }) => Promise<{ ok: boolean; error?: string }>;
  deleteDriver: (driverId: string) => void;
  setAdminPassword: (currentPassword: string, newPassword: string) => Promise<{ ok: boolean; error?: string }>;
  addRoute: (input: Omit<TransitRoute, 'id'>) => void;
  updateRoute: (routeId: string, changes: Partial<Omit<TransitRoute, 'id'>>) => void;
  addSchedule: (input: Omit<ScheduleEntry, 'id'>) => void;
  deleteSchedule: (scheduleId: string) => void;
  addTerminal: (input: Omit<Terminal, 'id'>) => void;
  updateTerminal: (terminalId: string, changes: Partial<Omit<Terminal, 'id'>>) => void;
  deleteTerminal: (terminalId: string) => { ok: boolean; affectedRoutes: string[] };
  updateContact: (changes: ContactDetails) => void;
  addAnnouncement: (input: { title: string; message: string }) => void;
  deleteAnnouncement: (announcementId: string) => void;
  toggleAnnouncement: (announcementId: string) => void;
  startTrip: (driverId: string, routeId: string, location?: { latitude: number; longitude: number }) => void;
  updateTripLocation: (driverId: string, location: { latitude: number; longitude: number }) => void;
  arriveTrip: (driverId: string) => void;
}

const STORAGE_KEY = 'datscogo-transit-store-v2';
const SESSION_KEY = 'datscogo-session-v2';
const PASSWORD_SALT = 'datscogo-v1:';

const initialStore: TransitStore = {
  // Keep only the administrator account. All operational transit data starts
  // empty and is created from the admin dashboard.
  accounts: [
    {
      id: 'admin-1',
      username: 'admin123',
      displayName: 'DatscoGo Administrator',
      role: 'admin',
      passwordHash: 'f23f36eba2232bf1ca13855cb58386c1fbe29e884bc2ce0a646db4d60656c204',
      active: true,
    },
  ],
  routes: [],
  schedules: [],
  terminals: [],
  activeTrips: [],
  announcements: [],
  contact: { facebook: '', phone: '', email: '' },
};

const TransitContext = createContext<TransitContextValue | null>(null);

async function digestPassword(password: string) {
  const data = new TextEncoder().encode(`${PASSWORD_SALT}${password}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function storedValue<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function normalizeWaypoint(routeId: string, point: RouteWaypoint, index: number): RouteWaypoint {
  return {
    id: point.id || `waypoint-${routeId}-${index}`,
    latitude: Number(point.latitude),
    longitude: Number(point.longitude),
    label: point.label ?? `Passing point ${index + 1}`,
    regularFare: typeof point.regularFare === 'number' ? point.regularFare : null,
    studentFare: typeof point.studentFare === 'number' ? point.studentFare : null,
    seniorCitizenFare: typeof point.seniorCitizenFare === 'number' ? point.seniorCitizenFare : null,
  };
}

function normalizeRoute(route: TransitRoute, terminals: Terminal[]): TransitRoute {
  const legacyDiscount = typeof route.discountedFare === 'number' ? route.discountedFare : null;
  const points = route.waypoints ?? route.coordinates.slice(1, -1).map(([latitude, longitude], index) => ({
    id: `legacy-waypoint-${route.id}-${index}`,
    latitude,
    longitude,
    label: `Passing point ${index + 1}`,
  }));

  return {
    ...route,
    originTerminalId: route.originTerminalId || terminals.find((terminal) => terminal.name === route.origin)?.id || '',
    destinationTerminalId: route.destinationTerminalId || terminals.find((terminal) => terminal.name === route.destination)?.id || '',
    studentFare: typeof route.studentFare === 'number' ? route.studentFare : legacyDiscount,
    seniorCitizenFare: typeof route.seniorCitizenFare === 'number' ? route.seniorCitizenFare : legacyDiscount,
    waypoints: points.map((point, index) => normalizeWaypoint(route.id, point, index)),
  };
}

function normalizeStoredStore(store: StoredTransitStore): TransitStore {
  const terminals = Array.isArray(store.terminals) ? store.terminals : initialStore.terminals;
  const routes = (Array.isArray(store.routes) ? store.routes : initialStore.routes).map((route) => normalizeRoute(route, terminals));
  const activeTrips = Array.isArray(store.activeTrips) ? store.activeTrips : store.activeTrip ? [store.activeTrip] : [];
  return {
    ...initialStore,
    ...store,
    terminals,
    routes,
    activeTrips,
    announcements: Array.isArray(store.announcements) ? store.announcements : [],
    contact: store.contact ?? initialStore.contact,
  };
}

function publicStateFrom(store: TransitStore): PublicTransitState {
  return {
    routes: store.routes,
    schedules: store.schedules,
    terminals: store.terminals,
    announcements: store.announcements,
    contact: store.contact,
  };
}

async function publishPublicState(store: TransitStore) {
  try {
    await fetch('/api/public-state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(publicStateFrom(store)),
    });
  } catch {
    // Local development can run without the Express API; localStorage remains functional.
  }
}

async function publishTrip(trip: ActiveTrip) {
  try {
    await fetch(`/api/trips/${encodeURIComponent(trip.driverId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(trip),
    });
  } catch {
    // Keep the local trip functional if the shared API is unavailable.
  }
}

export function getRoutesUsingTerminal(routes: TransitRoute[], terminalId: string) {
  return routes.filter((route) => route.originTerminalId === terminalId || route.destinationTerminalId === terminalId);
}

export function getRoutePassingPoints(route: TransitRoute) {
  return route.waypoints?.map((waypoint) => waypoint.label.trim()).filter(Boolean) ?? [];
}

export function getArrivalLocation(activeTrip: ActiveTrip, routes: TransitRoute[], terminals: Terminal[]) {
  const route = routes.find((item) => item.id === activeTrip.routeId);
  const destination = terminals.find((terminal) => terminal.id === route?.destinationTerminalId);
  return destination ? { latitude: destination.latitude, longitude: destination.longitude } : { latitude: activeTrip.latitude, longitude: activeTrip.longitude };
}

export const STALE_LOCATION_THRESHOLD_MS = 60_000;

export function isTripLocationStale(activeTrip: ActiveTrip, now = Date.now(), threshold = STALE_LOCATION_THRESHOLD_MS) {
  return activeTrip.status === 'departed' && now - activeTrip.lastUpdated > threshold;
}

export function replaceDriverActiveTrip(activeTrips: ActiveTrip[], nextTrip: ActiveTrip) {
  return [...activeTrips.filter((trip) => trip.driverId !== nextTrip.driverId), nextTrip];
}

export const TransitProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [store, setStore] = useState<TransitStore>(initialStore);
  const storeRef = useRef<TransitStore>(initialStore);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // This release intentionally starts without the previous demo transit data.
    localStorage.removeItem('datscogo-transit-store-v1');
    localStorage.removeItem('datscogo-session-v1');
    const restored = storedValue<StoredTransitStore>(STORAGE_KEY);
    const restoredSession = storedValue<{ userId: string }>(SESSION_KEY);
    if (restored?.accounts && restored?.routes && restored?.schedules && restored?.terminals) {
      setStore(normalizeStoredStore(restored));
    }
    if (restoredSession?.userId) setCurrentUserId(restoredSession.userId);
    setIsReady(true);
  }, []);

  useEffect(() => {
    storeRef.current = store;
  }, [store]);

  useEffect(() => {
    const syncStore = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      try {
        const updated = JSON.parse(event.newValue) as StoredTransitStore;
        if (updated.accounts && updated.routes && updated.schedules && updated.terminals) {
          setStore(normalizeStoredStore(updated));
        }
      } catch {
        // Ignore malformed storage events and retain the last valid state.
      }
    };
    window.addEventListener('storage', syncStore);
    return () => window.removeEventListener('storage', syncStore);
  }, []);

  // Poll the shared app server so passengers on another phone can receive admin
  // announcements/config changes and live GPS positions from drivers.
  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      try {
        const [publicResponse, tripsResponse] = await Promise.all([
          fetch('/api/public-state', { cache: 'no-store' }),
          fetch('/api/trips', { cache: 'no-store' }),
        ]);
        const publicState = publicResponse.ok ? await publicResponse.json() as Partial<PublicTransitState> : null;
        const remoteTrips = tripsResponse.ok ? await tripsResponse.json() as ActiveTrip[] : null;
        if (cancelled) return;

        setStore((current) => {
          const next: TransitStore = {
            ...current,
            routes: Array.isArray(publicState?.routes) ? publicState!.routes.map((route) => normalizeRoute(route, Array.isArray(publicState?.terminals) ? publicState!.terminals : current.terminals)) : current.routes,
            schedules: Array.isArray(publicState?.schedules) ? publicState!.schedules : current.schedules,
            terminals: Array.isArray(publicState?.terminals) ? publicState!.terminals : current.terminals,
            announcements: Array.isArray(publicState?.announcements) ? publicState!.announcements : current.announcements,
            contact: publicState?.contact ?? current.contact,
            activeTrips: Array.isArray(remoteTrips) ? remoteTrips : current.activeTrips,
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          return next;
        });
      } catch {
        // The frontend still works with localStorage when the shared API is not running.
      }
    };

    void refresh();
    const timer = window.setInterval(refresh, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const replaceStore = useCallback((updater: (current: TransitStore) => TransitStore, syncPublic = false) => {
    setStore((current) => {
      const next = updater(current);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      if (syncPublic) void publishPublicState(next);
      return next;
    });
  }, []);

  const currentUser = useMemo(() => {
    const account = store.accounts.find((item) => item.id === currentUserId);
    if (!account) return null;
    const { passwordHash: _passwordHash, ...user } = account;
    return user;
  }, [currentUserId, store.accounts]);

  const login = useCallback(async (username: string, password: string) => {
    const passwordHash = await digestPassword(password);
    const account = store.accounts.find((item) => item.username.toLowerCase() === username.toLowerCase() && item.passwordHash === passwordHash && item.active);
    if (!account) return null;
    setCurrentUserId(account.id);
    localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: account.id }));
    return account.role;
  }, [store.accounts]);

  const logout = useCallback(() => {
    setCurrentUserId(null);
    localStorage.removeItem(SESSION_KEY);
  }, []);

  const createDriver = useCallback(async ({ displayName, username, password }: { displayName: string; username: string; password: string }) => {
    const normalizedUsername = username.trim().toLowerCase();
    if (normalizedUsername.length < 4) return { ok: false, error: 'Username must contain at least 4 characters.' };
    if (password.length < 8) return { ok: false, error: 'Password must contain at least 8 characters.' };
    if (store.accounts.some((account) => account.username.toLowerCase() === normalizedUsername)) return { ok: false, error: 'This username is already in use.' };
    const passwordHash = await digestPassword(password);
    replaceStore((current) => ({
      ...current,
      accounts: [...current.accounts, { id: createId('driver'), username: normalizedUsername, displayName: displayName.trim() || normalizedUsername, role: 'driver', passwordHash, active: true }],
    }));
    return { ok: true };
  }, [replaceStore, store.accounts]);

  const deleteDriver = useCallback((driverId: string) => {
    replaceStore((current) => ({
      ...current,
      accounts: current.accounts.filter((account) => account.id !== driverId || account.role !== 'driver'),
      activeTrips: current.activeTrips.filter((trip) => trip.driverId !== driverId),
    }));
  }, [replaceStore]);

  const setAdminPassword = useCallback(async (currentPassword: string, newPassword: string) => {
    if (newPassword.length < 10) return { ok: false, error: 'Use at least 10 characters for the new password.' };
    const admin = store.accounts.find((account) => account.role === 'admin');
    if (!admin || admin.passwordHash !== await digestPassword(currentPassword)) return { ok: false, error: 'Your current password is incorrect.' };
    const passwordHash = await digestPassword(newPassword);
    replaceStore((current) => ({ ...current, accounts: current.accounts.map((account) => account.id === admin.id ? { ...account, passwordHash } : account) }));
    return { ok: true };
  }, [replaceStore, store.accounts]);

  const addRoute = useCallback((input: Omit<TransitRoute, 'id'>) => {
    replaceStore((current) => ({ ...current, routes: [...current.routes, { ...input, id: createId('route') }] }), true);
  }, [replaceStore]);

  const updateRoute = useCallback((routeId: string, changes: Partial<Omit<TransitRoute, 'id'>>) => {
    replaceStore((current) => ({ ...current, routes: current.routes.map((route) => route.id === routeId ? { ...route, ...changes } : route) }), true);
  }, [replaceStore]);

  const addSchedule = useCallback((input: Omit<ScheduleEntry, 'id'>) => {
    replaceStore((current) => ({ ...current, schedules: [...current.schedules, { ...input, id: createId('schedule') }] }), true);
  }, [replaceStore]);

  const deleteSchedule = useCallback((scheduleId: string) => {
    replaceStore((current) => ({ ...current, schedules: current.schedules.filter((schedule) => schedule.id !== scheduleId) }), true);
  }, [replaceStore]);

  const addTerminal = useCallback((input: Omit<Terminal, 'id'>) => {
    replaceStore((current) => ({ ...current, terminals: [...current.terminals, { ...input, id: createId('terminal') }] }), true);
  }, [replaceStore]);

  const updateTerminal = useCallback((terminalId: string, changes: Partial<Omit<Terminal, 'id'>>) => {
    replaceStore((current) => {
      const existing = current.terminals.find((terminal) => terminal.id === terminalId);
      const nextName = changes.name ?? existing?.name;
      const nextLatitude = changes.latitude ?? existing?.latitude;
      const nextLongitude = changes.longitude ?? existing?.longitude;
      return {
        ...current,
        terminals: current.terminals.map((terminal) => terminal.id === terminalId ? { ...terminal, ...changes } : terminal),
        routes: current.routes.map((route) => {
          const coordinates = [...route.coordinates];
          if (route.originTerminalId === terminalId && nextLatitude !== undefined && nextLongitude !== undefined) coordinates[0] = [nextLatitude, nextLongitude];
          if (route.destinationTerminalId === terminalId && nextLatitude !== undefined && nextLongitude !== undefined) coordinates[coordinates.length - 1] = [nextLatitude, nextLongitude];
          return {
            ...route,
            coordinates,
            origin: route.originTerminalId === terminalId && nextName ? nextName : route.origin,
            destination: route.destinationTerminalId === terminalId && nextName ? nextName : route.destination,
          };
        }),
      };
    }, true);
  }, [replaceStore]);

  const deleteTerminal = useCallback((terminalId: string) => {
    const terminal = store.terminals.find((item) => item.id === terminalId);
    if (!terminal) return { ok: false, affectedRoutes: [] };
    const affectedRoutes = getRoutesUsingTerminal(store.routes, terminalId).map((route) => route.title);
    if (affectedRoutes.length > 0) return { ok: false, affectedRoutes };
    replaceStore((current) => ({ ...current, terminals: current.terminals.filter((item) => item.id !== terminalId) }), true);
    return { ok: true, affectedRoutes: [] };
  }, [replaceStore, store.routes, store.terminals]);

  const updateContact = useCallback((changes: ContactDetails) => {
    replaceStore((current) => ({ ...current, contact: changes }), true);
  }, [replaceStore]);

  const addAnnouncement = useCallback(({ title, message }: { title: string; message: string }) => {
    const announcement: Announcement = { id: createId('announcement'), title: title.trim(), message: message.trim(), createdAt: Date.now(), active: true };
    replaceStore((current) => ({ ...current, announcements: [announcement, ...current.announcements] }), true);
  }, [replaceStore]);

  const deleteAnnouncement = useCallback((announcementId: string) => {
    replaceStore((current) => ({ ...current, announcements: current.announcements.filter((announcement) => announcement.id !== announcementId) }), true);
  }, [replaceStore]);

  const toggleAnnouncement = useCallback((announcementId: string) => {
    replaceStore((current) => ({ ...current, announcements: current.announcements.map((announcement) => announcement.id === announcementId ? { ...announcement, active: !announcement.active } : announcement) }), true);
  }, [replaceStore]);

  const startTrip = useCallback((driverId: string, routeId: string, location?: { latitude: number; longitude: number }) => {
    const route = storeRef.current.routes.find((item) => item.id === routeId);
    const [latitude, longitude] = location ? [location.latitude, location.longitude] : (route?.coordinates[0] ?? [9.7895, 126.1554]);
    const nextTrip: ActiveTrip = { id: createId('trip'), driverId, routeId, status: 'departed', latitude, longitude, lastUpdated: Date.now() };
    replaceStore((current) => ({ ...current, activeTrips: replaceDriverActiveTrip(current.activeTrips, nextTrip) }));
    void publishTrip(nextTrip);
  }, [replaceStore]);

  const updateTripLocation = useCallback((driverId: string, location: { latitude: number; longitude: number }) => {
    const existing = storeRef.current.activeTrips.find((trip) => trip.driverId === driverId && trip.status === 'departed');
    if (!existing) return;
    const nextTrip = { ...existing, ...location, lastUpdated: Date.now() };
    replaceStore((current) => ({ ...current, activeTrips: current.activeTrips.map((trip) => trip.driverId === driverId && trip.status === 'departed' ? nextTrip : trip) }));
    void publishTrip(nextTrip);
  }, [replaceStore]);

  const arriveTrip = useCallback((driverId: string) => {
    const current = storeRef.current;
    const existing = current.activeTrips.find((trip) => trip.driverId === driverId);
    if (!existing) return;
    const arrivalLocation = getArrivalLocation(existing, current.routes, current.terminals);
    const nextTrip: ActiveTrip = { ...existing, status: 'arrived', ...arrivalLocation, lastUpdated: Date.now() };
    replaceStore((current) => ({ ...current, activeTrips: current.activeTrips.map((trip) => trip.driverId === driverId ? nextTrip : trip) }));
    void publishTrip(nextTrip);
  }, [replaceStore]);

  const value = useMemo<TransitContextValue>(() => ({
    ...store,
    currentUser,
    isReady,
    login,
    logout,
    createDriver,
    deleteDriver,
    setAdminPassword,
    addRoute,
    updateRoute,
    addSchedule,
    deleteSchedule,
    addTerminal,
    updateTerminal,
    deleteTerminal,
    updateContact,
    addAnnouncement,
    deleteAnnouncement,
    toggleAnnouncement,
    startTrip,
    updateTripLocation,
    arriveTrip,
  }), [store, currentUser, isReady, login, logout, createDriver, deleteDriver, setAdminPassword, addRoute, updateRoute, addSchedule, deleteSchedule, addTerminal, updateTerminal, deleteTerminal, updateContact, addAnnouncement, deleteAnnouncement, toggleAnnouncement, startTrip, updateTripLocation, arriveTrip]);

  return <TransitContext.Provider value={value}>{children}</TransitContext.Provider>;
};

export function useTransit() {
  const context = useContext(TransitContext);
  if (!context) throw new Error('useTransit must be used within a TransitProvider');
  return context;
}
