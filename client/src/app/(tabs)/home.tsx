import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MapPinned } from 'lucide-react';
import { Header } from '../../components/Header/Header';
import { SearchCard, SearchDestination } from '../../components/Header/SearchCard';
import { MapCard } from '../../components/Map/MapCard';
import { BottomNavigation } from '../../components/BottomNavigation/BottomNavigation';
import { DatscoRoutesScreen } from '../../components/Map/DatscoRoutesScreen';
import { ScheduleScreen } from '../../components/Map/ScheduleScreen';
import { TerminalScreen } from '../../components/Map/TerminalScreen';
import { SplashScreen } from '../../components/Common/SplashScreen';
import { DatscoGoSidebar, SidebarAction } from '../../components/Header/DatscoGoSidebar';
import { InformationPanel, InformationPanelView } from '../../components/Common/InformationPanel';
import { LoginPanel, LoginRole } from '../../components/Common/LoginPanel';
import { useTransit } from '../../contexts/TransitContext';
import { DriverDashboard } from '../../components/Driver/DriverDashboard';
import { AdminDashboard } from '../../components/Admin/AdminDashboard';
import { LocationPermissionPrompt } from '../../components/Common/LocationPermissionPrompt';

type PassengerTab = 'datsco' | 'schedule' | 'terminal';
type PassengerScreen = 'home' | 'datsco-routes' | 'schedule' | 'terminal';
type DeviceLocation = { latitude: number; longitude: number };

export default function HomeTabScreen() {
  const { currentUser, login, logout, announcements, schedules, routes, terminals, contact } = useTransit();
  const [activeTab, setActiveTab] = useState<PassengerTab | null>(null);
  const [currentScreen, setCurrentScreen] = useState<PassengerScreen>('home');
  const [focusedTerminalId, setFocusedTerminalId] = useState<string | null>(null);
  const [focusedSearchDestination, setFocusedSearchDestination] = useState<SearchDestination | null>(null);
  const [guidedTerminalId, setGuidedTerminalId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showMenuDrawer, setShowMenuDrawer] = useState(false);
  const [scheduleModalRoute, setScheduleModalRoute] = useState<string | null>(null);
  const [splashState, setSplashState] = useState<'visible' | 'exiting' | 'hidden'>('visible');
  const [informationView, setInformationView] = useState<InformationPanelView>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [workspace, setWorkspace] = useState<'passenger' | 'driver' | 'admin'>('passenger');
  const [userLocation, setUserLocation] = useState<DeviceLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState('Location access has not been requested yet.');
  const [showLocationPermission, setShowLocationPermission] = useState(false);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);

  const activeAnnouncements = useMemo(
    () => announcements.filter((announcement) => announcement.active).sort((a, b) => b.createdAt - a.createdAt),
    [announcements],
  );

  const destinationOptions = useMemo<SearchDestination[]>(() => {
    type DestinationDraft = Omit<SearchDestination, 'subtitle'> & { routeTitles: string[] };
    const places = new Map<string, DestinationDraft>();

    const addPlace = (place: Omit<DestinationDraft, 'routeTitles'>, routeTitle: string) => {
      if (!place.label.trim() || !Number.isFinite(place.latitude) || !Number.isFinite(place.longitude)) return;
      const key = `${place.label.trim().toLowerCase()}-${place.latitude.toFixed(4)}-${place.longitude.toFixed(4)}`;
      const existing = places.get(key);
      if (existing) {
        if (!existing.routeTitles.includes(routeTitle)) existing.routeTitles.push(routeTitle);
        return;
      }
      places.set(key, { ...place, label: place.label.trim(), routeTitles: [routeTitle] });
    };

    routes.forEach((route) => {
      const originTerminal = terminals.find((terminal) => terminal.id === route.originTerminalId);
      const destinationTerminal = terminals.find((terminal) => terminal.id === route.destinationTerminalId);
      const originCoordinate = route.coordinates[0];
      const destinationCoordinate = route.coordinates[route.coordinates.length - 1];

      addPlace({
        id: `search-${route.id}-origin`,
        label: originTerminal?.name ?? route.origin,
        routeId: route.id,
        latitude: originTerminal?.latitude ?? originCoordinate?.[0] ?? NaN,
        longitude: originTerminal?.longitude ?? originCoordinate?.[1] ?? NaN,
        terminalId: originTerminal?.id,
        kind: 'terminal',
      }, route.title);

      (route.waypoints ?? []).forEach((waypoint) => {
        addPlace({
          id: `search-${route.id}-${waypoint.id}`,
          label: waypoint.label,
          routeId: route.id,
          latitude: waypoint.latitude,
          longitude: waypoint.longitude,
          kind: 'stop',
        }, route.title);
      });

      addPlace({
        id: `search-${route.id}-destination`,
        label: destinationTerminal?.name ?? route.destination,
        routeId: route.id,
        latitude: destinationTerminal?.latitude ?? destinationCoordinate?.[0] ?? NaN,
        longitude: destinationTerminal?.longitude ?? destinationCoordinate?.[1] ?? NaN,
        terminalId: destinationTerminal?.id,
        kind: 'terminal',
      }, route.title);
    });

    return Array.from(places.values())
      .map(({ routeTitles, ...place }) => ({
        ...place,
        subtitle: `${place.kind === 'terminal' ? 'Terminal' : 'Passing stop'} · ${routeTitles.join(' • ')}`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [routes, terminals]);

  const selectedScheduleRoute = routes.find((route) => route.title === scheduleModalRoute);
  const selectedScheduleEntries = selectedScheduleRoute ? schedules.filter((entry) => entry.routeId === selectedScheduleRoute.id) : [];

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const exitDelay = reducedMotion ? 0 : 1150;
    const hideDelay = reducedMotion ? 50 : 1550;
    const exitTimer = window.setTimeout(() => setSplashState('exiting'), exitDelay);
    const hideTimer = window.setTimeout(() => setSplashState('hidden'), hideDelay);
    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  const requestPassengerLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationStatus('GPS is not supported on this device or browser.');
      setShowLocationPermission(false);
      return;
    }

    setIsRequestingLocation(true);
    setLocationStatus('Waiting for location permission…');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setLocationStatus(`Your GPS updated at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`);
        setShowLocationPermission(false);
        setIsRequestingLocation(false);
      },
      (error) => {
        const detail = error.code === error.PERMISSION_DENIED
          ? 'Location permission was denied. You can enable it from your browser/site settings and try again.'
          : error.code === error.POSITION_UNAVAILABLE
            ? 'Your current location is unavailable. Make sure GPS/location services are turned on.'
            : 'The GPS request timed out. Move to an area with a clearer GPS signal and try again.';
        setLocationStatus(detail);
        setShowLocationPermission(false);
        setIsRequestingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 },
    );
  }, []);

  useEffect(() => {
    let cancelled = false;

    const prepareLocationPermission = async () => {
      if (!navigator.geolocation) {
        setLocationStatus('GPS is not supported on this device or browser.');
        return;
      }

      try {
        if (navigator.permissions?.query) {
          const permission = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
          if (cancelled) return;
          if (permission.state === 'granted') {
            requestPassengerLocation();
            return;
          }
          if (permission.state === 'denied') {
            setLocationStatus('Location is blocked in your browser/site settings. Enable it to show your position on the map.');
          }
        }
      } catch {
        // Some mobile browsers do not expose geolocation through Permissions API.
      }

      if (!cancelled) setShowLocationPermission(true);
    };

    prepareLocationPermission();
    return () => { cancelled = true; };
  }, [requestPassengerLocation]);

  const handlePassengerLocationAction = useCallback(() => {
    if (userLocation) {
      requestPassengerLocation();
      return;
    }
    setShowLocationPermission(true);
  }, [requestPassengerLocation, userLocation]);

  useEffect(() => {
    if (!guidedTerminalId || !userLocation || !navigator.geolocation) return;

    // While in guidance mode, keep the passenger marker moving with the phone's GPS.
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setUserLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setLocationStatus('Location permission was blocked, so live in-app guidance has paused.');
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [guidedTerminalId, Boolean(userLocation)]);

  const handleTabChange = (tab: PassengerTab) => {
    setActiveTab(tab);
    setCurrentScreen(tab === 'datsco' ? 'datsco-routes' : tab);
  };

  const handleBackToHome = () => {
    setCurrentScreen('home');
    setActiveTab(null);
  };

  const handleTerminalViewMap = (terminalId: string) => {
    setGuidedTerminalId(null);
    setFocusedTerminalId(terminalId);
    setFocusedSearchDestination(null);
    setCurrentScreen('home');
    setActiveTab(null);
  };

  const handleDestinationSelect = (destination: SearchDestination) => {
    setGuidedTerminalId(null);
    setSearchQuery(destination.label);
    setFocusedTerminalId(destination.terminalId ?? null);
    setFocusedSearchDestination(destination.terminalId ? null : destination);
    setCurrentScreen('home');
    setActiveTab(null);
  };

  const clearDestinationSearch = () => {
    setSearchQuery('');
    setFocusedTerminalId(null);
    setFocusedSearchDestination(null);
    setGuidedTerminalId(null);
  };

  const handleGuideToTerminal = (terminalId: string) => {
    const terminal = terminals.find((item) => item.id === terminalId);
    if (!terminal) return;

    // Keep guidance inside DatscoGo instead of opening Google Maps or another app.
    setGuidedTerminalId(terminalId);
    setFocusedTerminalId(terminalId);
    setFocusedSearchDestination(null);
    setSearchQuery(terminal.name);
    setCurrentScreen('home');
    setActiveTab(null);

    if (!userLocation) {
      setLocationStatus('Allow location access to start in-app guidance to this terminal.');
      setShowLocationPermission(true);
    } else {
      setLocationStatus(`Guiding you to ${terminal.name} using DatscoGo's map.`);
    }
  };

  const stopTerminalGuidance = () => {
    setGuidedTerminalId(null);
    setLocationStatus(userLocation ? 'Your GPS is active on the DatscoGo map.' : 'Location access has not been requested yet.');
  };

  const handleSidebarAction = (action: SidebarAction) => {
    if (action === 'login') {
      setShowLogin(true);
      return;
    }
    setInformationView(action);
  };

  const handleLogin = async (username: string, password: string): Promise<LoginRole | null> => {
    const role = await login(username, password);
    if (role) {
      setShowLogin(false);
      if (role === 'driver' || role === 'admin') setWorkspace(role);
    }
    return role;
  };

  const handleLogout = () => {
    logout();
    setWorkspace('passenger');
    setCurrentScreen('home');
    setActiveTab(null);
  };

  if (workspace === 'driver' && currentUser?.role === 'driver') {
    return <DriverDashboard onLogout={handleLogout} />;
  }

  if (workspace === 'admin' && currentUser?.role === 'admin') {
    return <AdminDashboard onLogout={handleLogout} />;
  }

  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-slate-100">
      <div className="relative flex h-full w-full flex-col overflow-hidden bg-white font-sans select-none">
        {splashState !== 'hidden' && <SplashScreen isExiting={splashState === 'exiting'} />}

        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          {currentScreen === 'datsco-routes' && (
            <DatscoRoutesScreen onBack={handleBackToHome} onViewSchedule={setScheduleModalRoute} />
          )}

          {currentScreen === 'schedule' && <ScheduleScreen onBack={handleBackToHome} />}

          {currentScreen === 'terminal' && (
            <TerminalScreen onBack={handleBackToHome} onViewMap={handleTerminalViewMap} onGuideToTerminal={handleGuideToTerminal} />
          )}

          {currentScreen === 'home' && (
            <>
              <Header
                onMenuClick={() => setShowMenuDrawer(true)}
                onHelpClick={() => setShowHelpModal(true)}
                onNotificationClick={() => setShowNotificationModal(true)}
                notificationCount={activeAnnouncements.length}
              />

              <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto bg-slate-50 px-3 pb-3 pt-4 sm:px-6 md:px-10 md:pb-6 md:pt-7 xl:px-14">
                <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col">
                  <SearchCard
                    searchQuery={searchQuery}
                    destinations={destinationOptions}
                    onSearchQueryChange={setSearchQuery}
                    onSelectDestination={handleDestinationSelect}
                    onClear={clearDestinationSearch}
                  />
                  <MapCard
                    focusedTerminalId={focusedTerminalId}
                    focusedSearchDestination={focusedSearchDestination}
                    guidedTerminalId={guidedTerminalId}
                    userLocation={userLocation}
                    locationStatus={locationStatus}
                    onRequestLocation={handlePassengerLocationAction}
                    onStopGuidance={stopTerminalGuidance}
                  />
                </div>
              </div>
            </>
          )}

          {currentScreen !== 'home' && (
            <button
              type="button"
              onClick={handleBackToHome}
              className="absolute bottom-3 left-1/2 z-50 flex h-[3.25rem] w-[3.25rem] -translate-x-1/2 items-center justify-center rounded-full border-4 border-white bg-blue-600 text-white shadow-xl shadow-blue-900/25 transition hover:bg-blue-700 active:scale-95 sm:h-14 sm:w-14"
              aria-label="Back to live map"
              title="Back to live map"
            >
              <MapPinned size={22} />
            </button>
          )}
        </div>

        <BottomNavigation activeTab={activeTab} onTabChange={handleTabChange} />

        {scheduleModalRoute && (
          <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div><p className="text-[10px] font-black uppercase tracking-wider text-blue-600">Published departures</p><h3 className="mt-1 text-base font-bold text-slate-900">{scheduleModalRoute}</h3></div>
                <button onClick={() => setScheduleModalRoute(null)} className="font-bold text-slate-400 hover:text-slate-600">✕</button>
              </div>
              <div className="mb-4 max-h-72 space-y-2 overflow-y-auto">
                {selectedScheduleEntries.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-700"><div><p className="font-bold text-slate-900">{entry.period}</p><p className="mt-0.5 text-[10px] text-slate-500">{entry.days}</p></div><span className="font-black text-blue-700">{entry.time}</span></div>
                ))}
                {selectedScheduleEntries.length === 0 && <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">No schedule has been published for this route.</div>}
              </div>
              <button onClick={() => setScheduleModalRoute(null)} className="w-full rounded-xl bg-[#1D4ED8] py-2.5 text-xs font-bold text-white hover:bg-blue-700">Close</button>
            </div>
          </div>
        )}

        {showNotificationModal && (
          <div className="absolute inset-0 z-[70] flex items-end justify-center bg-black/50 p-0 backdrop-blur-xs animate-in fade-in duration-200 md:items-center md:p-5">
            <div className="max-h-[78dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl md:max-w-2xl md:rounded-3xl">
              <div className="mb-4 flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-wider text-blue-600">From DatscoGo admin</p><h3 className="mt-1 text-base font-bold text-slate-900">Notifications</h3></div><button onClick={() => setShowNotificationModal(false)} className="font-bold text-slate-400 hover:text-slate-600">✕</button></div>
              <div className="space-y-3">
                {activeAnnouncements.map((announcement) => (
                  <article key={announcement.id} className="rounded-2xl border border-blue-100 bg-blue-50 p-4"><div className="text-xs font-black text-[#1D4ED8]">{announcement.title}</div><div className="mt-1 text-xs leading-5 text-slate-600">{announcement.message}</div><div className="mt-2 text-[10px] font-medium text-slate-400">{new Date(announcement.createdAt).toLocaleString()}</div></article>
                ))}
                {activeAnnouncements.length === 0 && <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">No active announcements from the administrator.</div>}
              </div>
            </div>
          </div>
        )}

        {showHelpModal && (
          <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
              <div className="mb-3 flex items-center justify-between"><h3 className="text-base font-bold text-slate-900">DatscoGo Help</h3><button onClick={() => setShowHelpModal(false)} className="font-bold text-slate-400 hover:text-slate-600">✕</button></div>
              <p className="mb-4 text-xs leading-relaxed text-slate-600">Need assistance with routes, schedules, or terminal locations? {contact.phone ? `Call ${contact.phone}.` : 'Open Contact Us from the menu for available support details.'}</p>
              <button onClick={() => setShowHelpModal(false)} className="w-full rounded-xl bg-[#1D4ED8] py-2.5 text-xs font-bold text-white hover:bg-blue-700">Got it</button>
            </div>
          </div>
        )}

        <DatscoGoSidebar isOpen={showMenuDrawer} onClose={() => setShowMenuDrawer(false)} onSelect={handleSidebarAction} />
        <InformationPanel view={informationView} onClose={() => setInformationView(null)} />
        {showLogin && <LoginPanel onClose={() => setShowLogin(false)} onLogin={handleLogin} />}

        <LocationPermissionPrompt
          open={showLocationPermission}
          mode="passenger"
          isRequesting={isRequestingLocation}
          onAllow={requestPassengerLocation}
          onNotNow={() => {
            setShowLocationPermission(false);
            setLocationStatus('Location access was skipped. Tap Show my GPS whenever you want to enable it.');
          }}
        />
      </div>
    </div>
  );
}
