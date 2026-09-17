import React from 'react';
import { RouteCard } from './RouteCard';
import { getRoutePassingPoints, useTransit } from '../../contexts/TransitContext';

export interface DatscoRoutesScreenProps {
  onBack: () => void;
  onViewSchedule: (routeName: string) => void;
}

export const DatscoRoutesScreen: React.FC<DatscoRoutesScreenProps> = ({ onBack, onViewSchedule }) => {
  const { routes } = useTransit();

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
          DatscoGo Routes
        </div>

        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold text-white overflow-hidden border border-white/30">
          <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=60" alt="Profile" className="w-full h-full object-cover" />
        </div>
      </div>

      {/* Routes List Content */}
      <div className="flex-1 p-3.5 overflow-y-auto pb-6 sm:grid sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {routes.map((route) => (
          <div key={route.id} className={!route.available ? 'opacity-60 grayscale-[0.25]' : ''}>
            <RouteCard
              type={route.type}
              title={route.title}
              eta={route.available ? route.eta : 'Unavailable'}
              fare={`₱${route.fare}`}
              discountedFare={route.discountedFare === null ? null : `₱${route.discountedFare}`}
              durationBadge={route.duration}
              passingPoints={getRoutePassingPoints(route)}
              onViewSchedule={() => onViewSchedule(route.title)}
            />
            {!route.available && <p className="-mt-3 mb-3 px-3 text-[10px] font-bold uppercase tracking-wide text-red-600">Service currently unavailable</p>}
          </div>
        ))}
      </div>
    </div>
  );
};
