import React from 'react';
import { BusIcon } from '../../assets/svg/BusIcon';
import { TerminalIcon } from '../../assets/svg/TerminalIcon';
import { ArrowRightIcon } from '../../assets/svg/ArrowRightIcon';

export interface RouteCardProps {
  type: 'ferry' | 'bus';
  title: string;
  eta: string;
  fare: string;
  discountedFare: string | null;
  durationBadge: string;
  passingPoints: string[];
  onViewSchedule: () => void;
}

export const RouteCard: React.FC<RouteCardProps> = ({
  type,
  title,
  eta,
  fare,
  discountedFare,
  durationBadge,
  passingPoints,
  onViewSchedule,
}) => {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-3">
      {/* Top Blue Header Section */}
      <div className="bg-[#1D4ED8] p-4 text-white relative flex flex-col items-center justify-center min-h-[90px]">
        <div className="absolute top-2.5 right-2.5 bg-amber-400 text-slate-900 font-bold text-[10px] px-2 py-0.5 rounded-md shadow-xs">
          {durationBadge}
        </div>
        <div className="text-white">
          {type === 'ferry' ? <TerminalIcon size={28} color="#ffffff" /> : <BusIcon size={28} color="#ffffff" />}
        </div>
      </div>

      {/* Bottom Content Section */}
      <div className="p-3.5 bg-white">
        <div className="font-bold text-slate-900 text-sm mb-1">
          {title}
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
          <span>ETA <strong className="text-slate-900">{eta}</strong></span>
          <span>&bull;</span>
          <span>Regular <strong className="text-slate-900">{fare}</strong></span>
          {discountedFare && <><span>&bull;</span><span className="font-semibold text-emerald-700">Discounted <strong>{discountedFare}</strong></span></>}
        </div>

        {passingPoints.length > 0 && <p className="mb-3 rounded-lg bg-blue-50 px-2.5 py-2 text-[11px] leading-4 text-blue-800"><b>Passes through:</b> {passingPoints.join(' · ')}</p>}

        <div className="flex flex-wrap gap-2">
          <button onClick={onViewSchedule} className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-[#1D4ED8] text-[#1D4ED8] text-xs font-semibold hover:bg-blue-50 transition-colors cursor-pointer"><span>View schedule</span><ArrowRightIcon size={14} color="#1D4ED8" /></button>
        </div>
      </div>
    </div>
  );
};
