import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

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

export interface TransitRoute {
  id: string;
  title: string;
  origin: string;
  destination: string;
  originTerminalId: string;
  destinationTerminalId: string;
  type: 'bus' | 'ferry';
  fare: number;
  discountedFare: number | null;
  eta: string;
  duration: string;
  available: boolean;
  coordinates: [number, number][];
  waypoints?: RouteWaypoint[];
}

export interface RouteWaypoint {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
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
  contact: ContactDetails;
}

type StoredTransitStore = Omit<TransitStore, 'activeTrips'> & {
  activeTrips?: ActiveTrip[];
  activeTrip?: ActiveTrip | null;
};

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
  startTrip: (driverId: string, routeId: string, location?: { latitude: number; longitude: number }) => void;
  updateTripLocation: (driverId: string, location: { latitude: number; longitude: number }) => void;
  arriveTrip: (driverId: string) => void;
}

const STORAGE_KEY = 'datscogo-transit-store-v1';
const SESSION_KEY = 'datscogo-session-v1';
const PASSWORD_SALT = 'datscogo-v1:';

const initialStore: TransitStore = {
  accounts: [
    {
      id: 'admin-1',
      username: 'admin123',
      displayName: 'DatscoGo Administrator',
      role: 'admin',
      passwordHash: 'f23f36eba2232bf1ca13855cb58386c1fbe29e884bc2ce0a646db4d60656c204',
      active: true,
    },
    {
      id: 'driver-1',
      username: 'driver01',
      displayName: 'Sample Driver',
      role: 'driver',
      passwordHash: 'f4ea23715862ffbeeeba9dc872d25d07806331dc2f59b41ad0ca77af2faa70c0',
      active: true,
    },
  ],
  routes: [
    {
      id: 'route-general-luna-dapa',
      title: 'General Luna → Dapa',
      origin: 'General Luna Terminal',
      destination: 'Dapa Terminal',
      originTerminalId: 'terminal-general-luna',
      destinationTerminalId: 'terminal-dapa',
      type: 'ferry',
      fare: 30,
      discountedFare: 24,
      eta: '30 mins',
      duration: '30 min',
      available: true,
      coordinates: [[9.7895, 126.1554], [9.7865, 126.1305], [9.7702, 126.1002], [9.7578, 126.0689]],
      waypoints: [
        { id: 'gl-dapa-1', latitude: 9.7865, longitude: 126.1305, label: 'Catangnan junction' },
        { id: 'gl-dapa-2', latitude: 9.7702, longitude: 126.1002, label: 'Dapa–General Luna road' },
      ],
    },
    {
      id: 'route-dapa-general-luna',
      title: 'Dapa → General Luna',
      origin: 'Dapa Terminal',
      destination: 'General Luna Terminal',
      originTerminalId: 'terminal-dapa',
      destinationTerminalId: 'terminal-general-luna',
      type: 'bus',
      fare: 30,
      discountedFare: 24,
      eta: '30 mins',
      duration: '30 min',
      available: true,
      coordinates: [[9.7578, 126.0689], [9.7702, 126.1002], [9.7865, 126.1305], [9.7895, 126.1554]],
      waypoints: [
        { id: 'dapa-gl-1', latitude: 9.7702, longitude: 126.1002, label: 'Dapa–General Luna road' },
        { id: 'dapa-gl-2', latitude: 9.7865, longitude: 126.1305, label: 'Catangnan junction' },
      ],
    },
    {
      id: 'route-dapa-del-carmen',
      title: 'Dapa → Del Carmen',
      origin: 'Dapa Terminal',
      destination: 'Del Carmen Terminal',
      originTerminalId: 'terminal-dapa',
      destinationTerminalId: 'terminal-del-carmen',
      type: 'bus',
      fare: 50,
      discountedFare: 40,
      eta: '1 hr',
      duration: '1 hr',
      available: true,
      coordinates: [[9.7578, 126.0689], [9.7912, 126.0366], [9.8354, 126.0048], [9.8789, 125.9750]],
      waypoints: [
        { id: 'dapa-dc-1', latitude: 9.7912, longitude: 126.0366, label: 'San Isidro road' },
        { id: 'dapa-dc-2', latitude: 9.8354, longitude: 126.0048, label: 'Del Carmen access road' },
      ],
    },
  ],
  schedules: [
    { id: 'schedule-1', routeId: 'route-general-luna-dapa', time: '4:15 – 4:50am', period: 'Morning', days: 'Monday – Saturday' },
    { id: 'schedule-2', routeId: 'route-general-luna-dapa', time: '6:00 – 6:25am', period: 'Morning', days: 'Monday – Saturday' },
    { id: 'schedule-3', routeId: 'route-general-luna-dapa', time: '12:45 – 1:15pm', period: 'Afternoon', days: 'Monday – Saturday' },
    { id: 'schedule-4', routeId: 'route-dapa-general-luna', time: '7:00 – 7:25am', period: 'Morning', days: 'Monday – Saturday' },
  ],
  terminals: [
    { id: 'terminal-dapa', name: 'Dapa Terminal', details: 'Main port · open 4:00am–6:00pm', latitude: 9.7578, longitude: 126.0689 },
    { id: 'terminal-general-luna', name: 'General Luna Terminal', details: 'Town center · open 4:00am–6:00pm', latitude: 9.7895, longitude: 126.1554 },
    { id: 'terminal-del-carmen', name: 'Del Carmen Terminal', details: 'Pier road · open 5:00am–5:00pm', latitude: 9.8789, longitude: 125.9750 },
  ],
  activeTrips: [],
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

function normalizeStoredStore(store: StoredTransitStore): TransitStore {
  const routes = store.routes.map((route) => ({
    ...route,
    originTerminalId: route.originTerminalId || store.terminals.find((terminal) => terminal.name === route.origin)?.id || '',
    destinationTerminalId: route.destinationTerminalId || store.terminals.find((terminal) => terminal.name === route.destination)?.id || '',
    discountedFare: typeof route.discountedFare === 'number' ? route.discountedFare : null,
    waypoints: route.waypoints ?? route.coordinates.slice(1, -1).map(([latitude, longitude], index) => ({
      id: `legacy-waypoint-${route.id}-${index}`,
      latitude,
      longitude,
      label: `Passing point ${index + 1}`,
    })),
  }));
  const activeTrips = Array.isArray(store.activeTrips) ? store.activeTrips : store.activeTrip ? [store.activeTrip] : [];
  return { ...initialStore, ...store, routes, activeTrips, contact: store.contact ?? initialStore.contact };
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

export function replaceDriverActiveTrip(activeTrips: ActiveTrip[], nextTrip: ActiveTrip) {
  return [...activeTrips.filter((trip) => trip.driverId !== nextTrip.driverId), nextTrip];
}

export const TransitProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [store, setStore] = useState<TransitStore>(initialStore);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const restored = storedValue<StoredTransitStore>(STORAGE_KEY);
    const restoredSession = storedValue<{ userId: string }>(SESSION_KEY);
    if (restored?.accounts && restored?.routes && restored?.schedules && restored?.terminals) {
      setStore(normalizeStoredStore(restored));
    }
    if (restoredSession?.userId) setCurrentUserId(restoredSession.userId);
    setIsReady(true);
  }, []);

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

  const replaceStore = useCallback((updater: (current: TransitStore) => TransitStore) => {
    setStore((current) => {
      const next = updater(current);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
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
    replaceStore((current) => {
      const driver = current.accounts.find((account) => account.id === driverId && account.role === 'driver');
      if (!driver) return current;
      return {
        ...current,
        accounts: current.accounts.filter((account) => account.id !== driverId),
        activeTrips: current.activeTrips.filter((trip) => trip.driverId !== driverId),
      };
    });
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
    replaceStore((current) => ({ ...current, routes: [...current.routes, { ...input, id: createId('route') }] }));
  }, [replaceStore]);

  const updateRoute = useCallback((routeId: string, changes: Partial<Omit<TransitRoute, 'id'>>) => {
    replaceStore((current) => ({ ...current, routes: current.routes.map((route) => route.id === routeId ? { ...route, ...changes } : route) }));
  }, [replaceStore]);

  const addSchedule = useCallback((input: Omit<ScheduleEntry, 'id'>) => {
    replaceStore((current) => ({ ...current, schedules: [...current.schedules, { ...input, id: createId('schedule') }] }));
  }, [replaceStore]);

  const deleteSchedule = useCallback((scheduleId: string) => {
    replaceStore((current) => ({ ...current, schedules: current.schedules.filter((schedule) => schedule.id !== scheduleId) }));
  }, [replaceStore]);

  const addTerminal = useCallback((input: Omit<Terminal, 'id'>) => {
    replaceStore((current) => ({ ...current, terminals: [...current.terminals, { ...input, id: createId('terminal') }] }));
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
    });
  }, [replaceStore]);

  const deleteTerminal = useCallback((terminalId: string) => {
    const terminal = store.terminals.find((item) => item.id === terminalId);
    if (!terminal) return { ok: false, affectedRoutes: [] };
    const affectedRoutes = getRoutesUsingTerminal(store.routes, terminalId).map((route) => route.title);
    if (affectedRoutes.length > 0) return { ok: false, affectedRoutes };
    replaceStore((current) => ({ ...current, terminals: current.terminals.filter((item) => item.id !== terminalId) }));
    return { ok: true, affectedRoutes: [] };
  }, [replaceStore, store.routes, store.terminals]);

  const updateContact = useCallback((changes: ContactDetails) => {
    replaceStore((current) => ({ ...current, contact: changes }));
  }, [replaceStore]);

  const startTrip = useCallback((driverId: string, routeId: string, location?: { latitude: number; longitude: number }) => {
    const route = store.routes.find((item) => item.id === routeId);
    const [latitude, longitude] = location ? [location.latitude, location.longitude] : (route?.coordinates[0] ?? [9.7895, 126.1554]);
    replaceStore((current) => ({ ...current, activeTrips: replaceDriverActiveTrip(current.activeTrips, { id: createId('trip'), driverId, routeId, status: 'departed', latitude, longitude, lastUpdated: Date.now() }) }));
  }, [replaceStore, store.routes]);

  const updateTripLocation = useCallback((driverId: string, location: { latitude: number; longitude: number }) => {
    replaceStore((current) => ({ ...current, activeTrips: current.activeTrips.map((trip) => trip.driverId === driverId && trip.status === 'departed' ? { ...trip, ...location, lastUpdated: Date.now() } : trip) }));
  }, [replaceStore]);

  const arriveTrip = useCallback((driverId: string) => {
    replaceStore((current) => {
      return {
        ...current,
        activeTrips: current.activeTrips.map((trip) => {
          if (trip.driverId !== driverId) return trip;
          const arrivalLocation = getArrivalLocation(trip, current.routes, current.terminals);
          return { ...trip, status: 'arrived', ...arrivalLocation, lastUpdated: Date.now() };
        }),
      };
    });
  }, [replaceStore]);

  const value = useMemo<TransitContextValue>(() => ({
    ...store, currentUser, isReady, login, logout, createDriver, deleteDriver, setAdminPassword, addRoute, updateRoute, addSchedule, deleteSchedule, addTerminal, updateTerminal, deleteTerminal, updateContact, startTrip, updateTripLocation, arriveTrip,
  }), [store, currentUser, isReady, login, logout, createDriver, deleteDriver, setAdminPassword, addRoute, updateRoute, addSchedule, deleteSchedule, addTerminal, updateTerminal, deleteTerminal, updateContact, startTrip, updateTripLocation, arriveTrip]);

  return <TransitContext.Provider value={value}>{children}</TransitContext.Provider>;
};

export function useTransit() {
  const context = useContext(TransitContext);
  if (!context) throw new Error('useTransit must be used within a TransitProvider');
  return context;
}
