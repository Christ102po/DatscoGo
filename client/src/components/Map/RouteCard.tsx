import React from 'react';
import { BusIcon } from '../../assets/svg/BusIcon';
import { TerminalIcon } from '../../assets/svg/TerminalIcon';
import { ArrowRightIcon } from '../../assets/svg/ArrowRightIcon';

export interface RouteStopFare {
  label: string;
  regularFare: number | null;
  studentFare: number | null;
  seniorCitizenFare: number | null;
}

export interface RouteCardProps {
  type: 'ferry' | 'bus';
  title: string;
  eta: string;
  fare: string;
  studentFare: string | null;
  seniorCitizenFare: string | null;
  durationBadge: string;
  passingPoints: string[];
  stopFares: RouteStopFare[];
  onViewSchedule: () => void;
}

const money = (value: number | null) => value === null ? '—' : `₱${value}`;

export const RouteCard: React.FC<RouteCardProps> = ({
  type,
  title,
  eta,
  fare,
  studentFare,
  seniorCitizenFare,
  durationBadge,
  passingPoints,
  stopFares,
  onViewSchedule,
}) => {
  return (
    <div className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="relative flex min-h-[92px] flex-col items-center justify-center bg-[#1D4ED8] p-4 text-white">
        <div className="absolute right-2.5 top-2.5 rounded-md bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-slate-900 shadow-xs">{durationBadge}</div>
        <div className="text-white">{type === 'ferry' ? <TerminalIcon size={28} color="#ffffff" /> : <BusIcon size={28} color="#ffffff" />}</div>
      </div>

      <div className="bg-white p-4">
        <div className="text-sm font-black text-slate-900">{title}</div>
        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-600">
          <span className="rounded-lg bg-slate-50 px-2 py-1">ETA <strong className="text-slate-900">{eta}</strong></span>
          <span className="rounded-lg bg-slate-50 px-2 py-1">Regular <strong className="text-slate-900">{fare}</strong></span>
          {studentFare && <span className="rounded-lg bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">Student <strong>{studentFare}</strong></span>}
          {seniorCitizenFare && <span className="rounded-lg bg-violet-50 px-2 py-1 font-semibold text-violet-700">Senior <strong>{seniorCitizenFare}</strong></span>}
        </div>

        {passingPoints.length > 0 && (
          <p className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-[11px] leading-5 text-blue-800"><b>Passes through:</b> {passingPoints.join(' · ')}</p>
        )}

        {stopFares.length > 0 && (
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
            <div className="grid grid-cols-[1.4fr_.7fr_.7fr_.7fr] bg-slate-50 px-2 py-2 text-[9px] font-black uppercase tracking-wide text-slate-500">
              <span>Stop</span><span className="text-center">Regular</span><span className="text-center">Student</span><span className="text-center">Senior</span>
            </div>
            {stopFares.map((stop) => (
              <div key={stop.label} className="grid grid-cols-[1.4fr_.7fr_.7fr_.7fr] items-center border-t border-slate-100 px-2 py-2 text-[10px] text-slate-600">
                <span className="pr-2 font-semibold text-slate-800">{stop.label}</span>
                <span className="text-center">{money(stop.regularFare)}</span>
                <span className="text-center text-emerald-700">{money(stop.studentFare)}</span>
                <span className="text-center text-violet-700">{money(stop.seniorCitizenFare)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={onViewSchedule} className="inline-flex items-center space-x-1.5 rounded-lg border border-[#1D4ED8] px-3 py-1.5 text-xs font-semibold text-[#1D4ED8] transition-colors hover:bg-blue-50"><span>View schedule</span><ArrowRightIcon size={14} color="#1D4ED8" /></button>
        </div>
      </div>
    </div>
  );
};
