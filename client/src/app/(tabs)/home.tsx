import React, { useEffect, useState } from 'react';
import { Header } from '../../components/Header/Header';
import { SearchCard } from '../../components/Header/SearchCard';
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

export default function HomeTabScreen() {
  const { currentUser, login, logout } = useTransit();
  const [activeTab, setActiveTab] = useState<'datsco' | 'schedule' | 'terminal' | null>(null);
  const [currentScreen, setCurrentScreen] = useState<'home' | 'datsco-routes' | 'schedule' | 'terminal'>('home');
  const [focusedTerminalId, setFocusedTerminalId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showMenuDrawer, setShowMenuDrawer] = useState(false);
  const [scheduleModalRoute, setScheduleModalRoute] = useState<string | null>(null);
  const [splashState, setSplashState] = useState<'visible' | 'exiting' | 'hidden'>('visible');
  const [informationView, setInformationView] = useState<InformationPanelView>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [workspace, setWorkspace] = useState<'passenger' | 'driver' | 'admin'>('passenger');

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

  const handleTabChange = (tab: 'datsco' | 'schedule' | 'terminal') => {
    setActiveTab(tab);
    if (tab === 'datsco') {
      setCurrentScreen('datsco-routes');
    } else if (tab === 'schedule') {
      setCurrentScreen('schedule');
    } else if (tab === 'terminal') {
      setCurrentScreen('terminal');
    } else {
      setCurrentScreen('home');
    }
  };

  const handleBackToHome = () => {
    setCurrentScreen('home');
    setActiveTab(null);
  };

  const handleTerminalViewMap = (terminalId: string) => {
    setFocusedTerminalId(terminalId);
    setCurrentScreen('home');
    setActiveTab(null);
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
    <div className="min-h-[100dvh] w-full bg-slate-100">
      {/* Full-screen application canvas: no desktop device frame or width constraint. */}
      <div className="relative flex min-h-[100dvh] w-full flex-col overflow-hidden bg-white font-sans select-none">
        {splashState !== 'hidden' && <SplashScreen isExiting={splashState === 'exiting'} />}
        
        {currentScreen === 'datsco-routes' && (
          <DatscoRoutesScreen 
            onBack={handleBackToHome}
            onViewSchedule={(routeName) => {
              setScheduleModalRoute(routeName);
            }}
          />
        )}

        {currentScreen === 'schedule' && (
          <ScheduleScreen 
            onBack={handleBackToHome}
          />
        )}

        {currentScreen === 'terminal' && (
          <TerminalScreen 
            onBack={handleBackToHome}
            onViewMap={handleTerminalViewMap}
          />
        )}

        {currentScreen === 'home' && (
          <>
            {/* Status / Header Bar */}
            <Header 
              onMenuClick={() => setShowMenuDrawer(true)}
              onHelpClick={() => setShowHelpModal(true)}
              onNotificationClick={() => setShowNotificationModal(true)}
            />

            {/* App Content Area */}
            <div className="relative z-10 flex flex-1 flex-col overflow-y-auto bg-slate-50 px-3 pb-3 pt-4 sm:px-6 md:px-10 md:pb-6 md:pt-7">
              
              {/* Search Destination Card */}
              <SearchCard 
                searchQuery={searchQuery}
                onSearchClick={() => setSearchQuery(searchQuery ? '' : 'General Luna Terminal')}
              />

              {/* Interactive Siargao Island Map */}
              <MapCard focusedTerminalId={focusedTerminalId} />

            </div>
          </>
        )}

        {/* Bottom Navigation */}
        <BottomNavigation 
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />

        {/* Home Indicator Bar */}
        <div className="flex w-full justify-center bg-white pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-0.5 md:hidden">
          <div className="w-28 h-1 bg-slate-300 rounded-full"></div>
        </div>

        {/* Schedule Modal from Routes view */}
        {scheduleModalRoute && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-[280px] bg-white rounded-2xl p-5 shadow-2xl md:max-w-md">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-slate-900 text-base">Schedule: {scheduleModalRoute}</h3>
                <button 
                  onClick={() => setScheduleModalRoute(null)}
                  className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-2 mb-4">
                <div className="p-2 bg-slate-50 rounded-lg text-xs text-slate-700 flex justify-between">
                  <span>Morning Trip</span>
                  <span className="font-bold">06:30 AM</span>
                </div>
                <div className="p-2 bg-slate-50 rounded-lg text-xs text-slate-700 flex justify-between">
                  <span>Midday Trip</span>
                  <span className="font-bold">11:00 AM</span>
                </div>
                <div className="p-2 bg-slate-50 rounded-lg text-xs text-slate-700 flex justify-between">
                  <span>Afternoon Trip</span>
                  <span className="font-bold">03:30 PM</span>
                </div>
              </div>
              <button 
                onClick={() => setScheduleModalRoute(null)}
                className="w-full py-2 bg-[#1D4ED8] text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Notification Modal Popup */}
        {showNotificationModal && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-end animate-in fade-in duration-200">
            <div className="max-h-[70%] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl md:max-w-2xl md:rounded-3xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-900 text-base">Notifications</h3>
                <button 
                  onClick={() => setShowNotificationModal(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-3">
                <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                  <div className="text-xs font-bold text-[#1D4ED8]">Siargao Transit Update</div>
                  <div className="text-xs text-slate-600 mt-1">General Luna — Dapa bus arriving at terminal in 5 mins.</div>
                  <div className="text-[10px] text-slate-400 mt-1">10 mins ago</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Help Modal Popup */}
        {showHelpModal && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-[280px] bg-white rounded-2xl p-5 shadow-2xl md:max-w-md">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-slate-900 text-base">DatscoGo Help</h3>
                <button 
                  onClick={() => setShowHelpModal(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                Need assistance with Siargao bus schedules or terminal locations? Contact our support hotline at +63 912 345 6789.
              </p>
              <button 
                onClick={() => setShowHelpModal(false)}
                className="w-full py-2 bg-[#1D4ED8] text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-colors cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        )}

        <DatscoGoSidebar isOpen={showMenuDrawer} onClose={() => setShowMenuDrawer(false)} onSelect={handleSidebarAction} />
        <InformationPanel view={informationView} onClose={() => setInformationView(null)} />
        {showLogin && <LoginPanel onClose={() => setShowLogin(false)} onLogin={handleLogin} />}

      </div>
    </div>
  );
};
