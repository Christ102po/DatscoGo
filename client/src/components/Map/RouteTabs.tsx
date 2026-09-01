import React from 'react';
import { LocationIcon } from '../../assets/svg/LocationIcon';
import { TerminalIcon } from '../../assets/svg/TerminalIcon';
import { useTransit } from '../../contexts/TransitContext';

export interface RouteTabsProps {
  selectedRouteId: string | null;
  onSelectRoute: (routeId: string) => void;
}

export const RouteTabs: React.FC<RouteTabsProps> = ({ selectedRouteId, onSelectRoute }) => {
  const { routes } = useTransit();

  return (
    <div className="mb-2">
      <div className="flex items-center space-x-2 overflow-x-auto pb-1 no-scrollbar">
        {routes.map((route, index) => <button key={route.id} onClick={() => onSelectRoute(route.id)} className={`flex items-center space-x-1.5 px-3 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border ${selectedRouteId === route.id ? 'bg-white border-[#1D4ED8] text-slate-900 shadow-sm ring-1 ring-[#1D4ED8]/20' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'}`}>
          {index % 2 === 0 ? <LocationIcon size={14} color="#1D4ED8" /> : <TerminalIcon size={14} color="#0284C7" />}
          <span>{route.title}</span>
        </button>)}
      </div>

      <div className="flex items-center justify-between px-1 mt-1.5">
        <span className="text-[10px] text-slate-400 font-bold">&#9664;</span>
        <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div className="w-12 h-full bg-slate-400 rounded-full"></div>
        </div>
        <span className="text-[10px] text-slate-400 font-bold">&#9654;</span>
      </div>
    </div>
  );
};
