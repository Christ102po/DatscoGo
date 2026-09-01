import React, { useState } from 'react';
import { MenuIcon } from './icons/MenuIcon';
import { HelpIcon } from './icons/HelpIcon';
import { NotificationIcon } from './icons/NotificationIcon';
import { LocationPinIcon } from './icons/LocationPinIcon';
import { BusTransitIcon } from './icons/BusTransitIcon';
import { FerryIcon } from './icons/FerryIcon';
import { ScheduleCalendarIcon } from './icons/ScheduleCalendarIcon';

export interface DatscoMobileAppProps {
  onSelectCodeTab?: (tab: string) => void;
}

export const DatscoMobileApp: React.FC<DatscoMobileAppProps> = () => {
  const [activeTab, setActiveTab] = useState<'datsco' | 'schedule' | 'terminal'>('datsco');
  const [selectedRoute, setSelectedRoute] = useState<string | null>('General Luna — Dapa');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showMenuDrawer, setShowMenuDrawer] = useState(false);

  return (
    <div className="flex flex-col items-center justify-center p-4">
      {/* Smartphone Device Shell */}
      <div className="relative w-[320px] h-[640px] bg-white rounded-[40px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] border-[8px] border-slate-900 overflow-hidden flex flex-col font-sans select-none">
        
        {/* Device Notch / Status Bar */}
        <div className="w-full bg-[#1D4ED8] pt-3 pb-2 px-5 flex items-center justify-between text-white relative z-20">
          {/* Top Header Row */}
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => setShowMenuDrawer(true)}
              className="p-1.5 hover:bg-blue-600 rounded-lg transition-colors cursor-pointer"
              aria-label="Menu"
            >
              <MenuIcon size={20} color="#ffffff" />
            </button>
          </div>
          
          <div className="font-black tracking-widest text-lg text-white">
            DATSCO
          </div>

          <div className="flex items-center space-x-2">
            <button 
              onClick={() => setShowHelpModal(true)}
              className="p-1.5 hover:bg-blue-600 rounded-lg transition-colors cursor-pointer"
              aria-label="Help"
            >
              <HelpIcon size={18} color="#ffffff" />
            </button>
            <button 
              onClick={() => setShowNotificationModal(true)}
              className="p-1.5 hover:bg-blue-600 rounded-lg transition-colors relative cursor-pointer"
              aria-label="Notifications"
            >
              <NotificationIcon size={18} color="#ffffff" />
            </button>
          </div>
        </div>

        {/* Curved blue header bottom transition */}
        <div className="bg-[#1D4ED8] h-6 w-full rounded-b-[24px] absolute top-[48px] left-0 z-10 shadow-md"></div>

        {/* App Content Area */}
        <div className="flex-1 bg-slate-50 flex flex-col pt-4 px-3 pb-3 relative z-10 overflow-y-auto">
          
          {/* Search Destination Card */}
          <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100 mb-3 relative z-20 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold tracking-wider text-[#1D4ED8] mb-0.5">
                ENTER YOUR DESTINATION
              </div>
              <div className="text-lg font-bold text-slate-900">
                {searchQuery || "Where to?"}
              </div>
            </div>
            <button 
              onClick={() => setSearchQuery(searchQuery ? '' : 'General Luna Terminal')}
              className="w-10 h-10 rounded-full bg-[#1D4ED8] flex items-center justify-center text-white shadow-md hover:bg-blue-700 transition-all cursor-pointer"
              title="Search Location"
            >
              <LocationPinIcon size={20} color="#ffffff" />
            </button>
          </div>

          {/* Interactive Map Area */}
          <div className="flex-1 bg-[#E8EEF5] rounded-2xl relative overflow-hidden border border-slate-200 shadow-inner mb-3 min-h-[220px] flex items-center justify-center">
            {/* Map Grid / Stylized background elements */}
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#1D4ED8_1px,transparent_1px)] [background-size:16px_16px]"></div>
            
            {/* Map Route SVG lines */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
              <path d="M 90 120 Q 140 80, 210 110 T 170 170" fill="none" stroke="#1D4ED8" strokeWidth="2.5" strokeDasharray="4 4" opacity="0.6" />
            </svg>

            {/* Map Pins matching the screenshot */}
            {/* Pin 1 (Top Left Blue) */}
            <div className="absolute top-[90px] left-[95px] flex flex-col items-center animate-bounce duration-1000">
              <div className="w-5 h-5 rounded-full bg-white shadow-md flex items-center justify-center border-2 border-[#1D4ED8]">
                <div className="w-2 h-2 rounded-full bg-[#1D4ED8]"></div>
              </div>
            </div>

            {/* Pin 2 (Top Right Blue) */}
            <div className="absolute top-[65px] right-[75px] flex flex-col items-center">
              <div className="w-5 h-5 rounded-full bg-white shadow-md flex items-center justify-center border-2 border-[#1D4ED8]">
                <div className="w-2 h-2 rounded-full bg-[#1D4ED8]"></div>
              </div>
            </div>

            {/* Pin 3 (Center Yellow Active) */}
            <div className="absolute top-[135px] left-[155px] flex flex-col items-center">
              <div className="w-6 h-6 rounded-full bg-white shadow-lg flex items-center justify-center border-2 border-amber-500">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></div>
              </div>
            </div>

            {/* Map floating control badge */}
            <div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded-md text-[9px] font-medium text-slate-600 shadow-sm">
              Siargao Transit Live
            </div>
          </div>

          {/* Route Selector Chips */}
          <div className="mb-2">
            <div className="flex items-center space-x-2 overflow-x-auto pb-1 no-scrollbar">
              {/* Chip 1 */}
              <button
                onClick={() => setSelectedRoute('General Luna — Dapa')}
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border ${
                  selectedRoute === 'General Luna — Dapa'
                    ? 'bg-white border-[#1D4ED8] text-slate-900 shadow-sm ring-1 ring-[#1D4ED8]/20'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                <LocationPinIcon size={14} color="#1D4ED8" />
                <span>General Luna — Dapa</span>
              </button>

              {/* Chip 2 */}
              <button
                onClick={() => setSelectedRoute('Del Carmen — Dapa')}
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border ${
                  selectedRoute === 'Del Carmen — Dapa'
                    ? 'bg-white border-[#1D4ED8] text-slate-900 shadow-sm ring-1 ring-[#1D4ED8]/20'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                <FerryIcon size={14} color="#0284C7" />
                <span>Del Carmen — Dapa</span>
              </button>
            </div>

            {/* Carousel Scroll Indicator Bar */}
            <div className="flex items-center justify-between px-1 mt-1.5">
              <span className="text-[10px] text-slate-400 font-bold">&#9664;</span>
              <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div className="w-12 h-full bg-slate-400 rounded-full"></div>
              </div>
              <span className="text-[10px] text-slate-400 font-bold">&#9654;</span>
            </div>
          </div>

        </div>

        {/* Bottom Navigation Bar */}
        <div className="bg-white border-t border-slate-100 py-2 px-4 flex items-center justify-around relative z-20">
          
          {/* DATSCO Tab */}
          <button
            onClick={() => setActiveTab('datsco')}
            className={`flex flex-col items-center py-1 px-4 rounded-xl transition-all cursor-pointer ${
              activeTab === 'datsco' ? 'bg-[#1D4ED8] text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <BusTransitIcon size={20} color={activeTab === 'datsco' ? '#ffffff' : 'currentColor'} />
            <span className="text-[9px] font-bold tracking-widest mt-1">DATSCO</span>
          </button>

          {/* SCHEDULE Tab */}
          <button
            onClick={() => setActiveTab('schedule')}
            className={`flex flex-col items-center py-1 px-4 rounded-xl transition-all cursor-pointer ${
              activeTab === 'schedule' ? 'bg-[#1D4ED8] text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <ScheduleCalendarIcon size={20} color={activeTab === 'schedule' ? '#ffffff' : 'currentColor'} />
            <span className="text-[9px] font-bold tracking-widest mt-1">SCHEDULE</span>
          </button>

          {/* TERMINAL Tab */}
          <button
            onClick={() => setActiveTab('terminal')}
            className={`flex flex-col items-center py-1 px-4 rounded-xl transition-all cursor-pointer ${
              activeTab === 'terminal' ? 'bg-[#1D4ED8] text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <LocationPinIcon size={20} color={activeTab === 'terminal' ? '#ffffff' : 'currentColor'} />
            <span className="text-[9px] font-bold tracking-widest mt-1">TERMINAL</span>
          </button>

        </div>

        {/* Home Indicator Bar */}
        <div className="w-full bg-white pb-1 pt-0.5 flex justify-center">
          <div className="w-28 h-1 bg-slate-300 rounded-full"></div>
        </div>

        {/* Notification Modal Popup */}
        {showNotificationModal && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-end animate-in fade-in duration-200">
            <div className="w-full bg-white rounded-t-3xl p-5 shadow-2xl max-h-[70%] overflow-y-auto">
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
                  <div className="text-xs font-bold text-[#1D4ED8]">Route Update</div>
                  <div className="text-xs text-slate-600 mt-1">General Luna — Dapa bus arriving in 5 mins.</div>
                  <div className="text-[10px] text-slate-400 mt-1">10 mins ago</div>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-xs font-bold text-slate-800">New Schedule Added</div>
                  <div className="text-xs text-slate-600 mt-1">Extra evening trips scheduled for weekend.</div>
                  <div className="text-[10px] text-slate-400 mt-1">2 hours ago</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Help Modal Popup */}
        {showHelpModal && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-[280px] bg-white rounded-2xl p-5 shadow-2xl">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-slate-900 text-base">Datsco Help</h3>
                <button 
                  onClick={() => setShowHelpModal(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                Need assistance with booking, schedules, or terminal locations? Contact our support hotline or check active transit updates.
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

        {/* Menu Drawer */}
        {showMenuDrawer && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-xs z-50 flex animate-in slide-in-from-left duration-200">
            <div className="w-3/4 h-full bg-white p-5 shadow-2xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-100">
                  <div className="font-black text-[#1D4ED8] tracking-widest text-lg">DATSCO</div>
                  <button 
                    onClick={() => setShowMenuDrawer(false)}
                    className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="text-sm font-semibold text-slate-800 cursor-pointer hover:text-[#1D4ED8]">My Bookings</div>
                  <div className="text-sm font-semibold text-slate-800 cursor-pointer hover:text-[#1D4ED8]">Terminal Locations</div>
                  <div className="text-sm font-semibold text-slate-800 cursor-pointer hover:text-[#1D4ED8]">Fare Rates</div>
                  <div className="text-sm font-semibold text-slate-800 cursor-pointer hover:text-[#1D4ED8]">Settings & Preferences</div>
                </div>
              </div>
              <div className="text-[11px] text-slate-400 pt-4 border-t border-slate-100">
                Datsco Transit App v1.0.0
              </div>
            </div>
            <div className="flex-1" onClick={() => setShowMenuDrawer(false)}></div>
          </div>
        )}

      </div>
    </div>
  );
};
