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
          DatscoGo Routes
        </div>

        <div className="h-8 w-8" aria-hidden="true" />
      </div>

      {/* Routes List Content */}
      <div className="mx-auto grid min-h-0 w-full max-w-7xl flex-1 gap-4 overflow-y-auto p-3.5 pb-24 sm:grid-cols-2 sm:p-5 sm:pb-24 lg:grid-cols-3 lg:p-8 lg:pb-24">
        {routes.map((route) => (
          <div key={route.id} className={!route.available ? 'opacity-60 grayscale-[0.25]' : ''}>
            <RouteCard
              type={route.type}
              title={route.title}
              eta={route.available ? route.eta : 'Unavailable'}
              fare={`₱${route.fare}`}
              studentFare={route.studentFare === null || route.studentFare === undefined ? null : `₱${route.studentFare}`}
              seniorCitizenFare={route.seniorCitizenFare === null || route.seniorCitizenFare === undefined ? null : `₱${route.seniorCitizenFare}`}
              durationBadge={route.duration}
              passingPoints={getRoutePassingPoints(route)}
              stopFares={(route.waypoints ?? []).filter((point) => point.label.trim()).map((point) => ({ label: point.label.trim(), regularFare: point.regularFare ?? null, studentFare: point.studentFare ?? null, seniorCitizenFare: point.seniorCitizenFare ?? null }))}
              onViewSchedule={() => onViewSchedule(route.title)}
            />
            {!route.available && <p className="-mt-3 mb-3 px-3 text-[10px] font-bold uppercase tracking-wide text-red-600">Service currently unavailable</p>}
          </div>
        ))}
      </div>
    </div>
  );
};
