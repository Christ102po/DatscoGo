import React, { useState } from 'react';
import { ChevronsLeftRight } from 'lucide-react';
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
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50">
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

        <div className="h-8 w-8" aria-hidden="true" />
      </div>

      {/* Schedule Content */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3.5 pb-24 sm:p-5 sm:pb-24 md:p-8 md:pb-24">
        {/* Route Tabs Selector */}
        <div className="mx-auto mb-4 w-full max-w-6xl">
          <div className="relative">
            <div
              className="flex w-full snap-x snap-mandatory items-center gap-1 overflow-x-auto rounded-2xl bg-slate-200/80 p-1 scroll-smooth touch-pan-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              aria-label="Scrollable route schedule tabs"
            >
              {routes.map((route) => (
                <button
                  key={route.id}
                  onClick={() => setActiveRouteId(route.id)}
                  className={`shrink-0 snap-start whitespace-nowrap sm:flex-1 sm:shrink rounded-xl px-3 py-2 text-xs font-bold transition-all cursor-pointer ${activeRouteId === route.id ? 'bg-[#1D4ED8] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  {route.title}
                </button>
              ))}
            </div>

            {routes.length > 1 && (
              <div className="pointer-events-none absolute inset-y-1 right-1 w-8 rounded-r-xl bg-gradient-to-l from-slate-200/95 to-transparent sm:hidden" aria-hidden="true" />
            )}
          </div>

          {routes.length > 1 && (
            <div className="mt-1.5 flex items-center justify-center gap-1.5 text-[10px] font-semibold text-slate-500 sm:hidden">
              <ChevronsLeftRight size={14} className="animate-pulse text-[#1D4ED8]" aria-hidden="true" />
              <span>Swipe left or right to view other route schedules</span>
            </div>
          )}
        </div>

        {/* Schedule Card */}
        <div className="mx-auto w-full max-w-6xl rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
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
