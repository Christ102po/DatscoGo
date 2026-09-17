import React, { useState } from 'react';
import { useTransit } from '../../contexts/TransitContext';

export interface ScheduleScreenProps {
  onBack: () => void;
}

export const ScheduleScreen: React.FC<ScheduleScreenProps> = ({ onBack }) => {
  const { routes, schedules } = useTransit();
  const [activeRouteId, setActiveRouteId] = useState(routes[0]?.id ?? '');
  const activeRoute = routes.find((route) => route.id === activeRouteId) ?? routes[0];
  const visibleSchedules = schedules.filter((slot) => slot.routeId === activeRoute?.id);
  const morningSlots = visibleSchedules.filter((slot) => slot.period === 'Morning');
  const afternoonSlots = visibleSchedules.filter((slot) => slot.period === 'Afternoon');

  return (
    <div className="flex-1 bg-slate-50 flex flex-col h-full relative overflow-y-auto">
      {/* Top Header bar */}
      <div className="w-full bg-[#1D4ED8] pt-3 pb-3 px-4 flex items-center justify-between text-white relative z-20 shadow-sm">
        <button
          onClick={onBack}
          className="p-1.5 hover:bg-blue-600 rounded-lg transition-colors cursor-pointer text-white"
          aria-label="Back"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
        </button>

        <div className="font-bold text-base text-white tracking-wide">
          DatscoGo Schedule
        </div>

        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold text-white overflow-hidden border border-white/30">
          <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=60" alt="Profile" className="w-full h-full object-cover" />
        </div>
      </div>

      {/* Schedule Content */}
      <div className="flex-1 p-3.5 overflow-y-auto pb-6">
        {/* Route Tabs Selector */}
        <div className="bg-slate-200/80 p-1 rounded-2xl flex items-center gap-1 mb-3 overflow-x-auto">
          {routes.map((route) => (
            <button key={route.id} onClick={() => setActiveRouteId(route.id)} className={`flex-1 whitespace-nowrap py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeRouteId === route.id ? 'bg-[#1D4ED8] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
              {route.title}
            </button>
          ))}
        </div>

        {/* Schedule Card */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
          <div className="font-bold text-slate-900 text-sm mb-0.5">
            {activeRoute?.title ?? 'No route selected'}
          </div>
          <div className="text-[10px] text-slate-400 mb-4 font-medium">
            {visibleSchedules[0]?.days ?? 'No schedule published'}
          </div>

          {/* Morning Section */}
          <div className="text-[10px] font-bold text-[#1D4ED8] tracking-wider mb-2">
            MORNING
          </div>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {morningSlots.map((slot) => (
              <div key={slot.id} className="bg-slate-50 hover:bg-blue-50/50 border border-slate-100 rounded-xl py-2 px-3 text-center text-xs font-semibold text-slate-800 transition-colors">
                {slot.time}
              </div>
            ))}
            {morningSlots.length === 0 && <div className="col-span-2 rounded-xl border border-dashed border-slate-200 px-3 py-3 text-center text-xs text-slate-400">No morning departures published.</div>}
          </div>

          {/* Afternoon Section */}
          <div className="text-[10px] font-bold text-[#1D4ED8] tracking-wider mb-2">
            AFTERNOON
          </div>
          <div className="grid grid-cols-2 gap-2">
            {afternoonSlots.map((slot) => (
              <div key={slot.id} className="bg-slate-50 hover:bg-blue-50/50 border border-slate-100 rounded-xl py-2 px-3 text-center text-xs font-semibold text-slate-800 transition-colors">
                {slot.time}
              </div>
            ))}
            {afternoonSlots.length === 0 && <div className="col-span-2 rounded-xl border border-dashed border-slate-200 px-3 py-3 text-center text-xs text-slate-400">No afternoon departures published.</div>}
          </div>
        </div>
      </div>
    </div>
  );
};
