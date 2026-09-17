import React from 'react';
import { LocateFixed, MapPin, Navigation, ShieldCheck, X } from 'lucide-react';

interface LocationPermissionPromptProps {
  open: boolean;
  mode?: 'passenger' | 'driver';
  isRequesting?: boolean;
  onAllow: () => void;
  onNotNow: () => void;
}

export const LocationPermissionPrompt: React.FC<LocationPermissionPromptProps> = ({
  open,
  mode = 'passenger',
  isRequesting = false,
  onAllow,
  onNotNow,
}) => {
  if (!open) return null;

  const isDriver = mode === 'driver';

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-5">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${mode}-location-permission-title`}
        className="w-full max-w-md rounded-t-[2rem] bg-white p-5 shadow-2xl sm:rounded-[2rem] sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
            <LocateFixed size={28} />
          </div>
          <button
            type="button"
            onClick={onNotNow}
            disabled={isRequesting}
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            aria-label="Not now"
          >
            <X size={20} />
          </button>
        </div>

        <p className="mt-5 text-[10px] font-black uppercase tracking-[0.16em] text-blue-600">Location permission</p>
        <h2 id={`${mode}-location-permission-title`} className="mt-1 text-2xl font-black tracking-tight text-slate-900">
          Allow DatscoGo to use your location?
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          {isDriver
            ? 'Your phone GPS is used while you are on duty so passengers can see the current Datsco location after you start a departure.'
            : 'Your phone GPS is used to show where you are on the map and help guide you toward terminals and route stops.'}
        </p>

        <div className="mt-5 space-y-3 rounded-2xl bg-slate-50 p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 rounded-xl bg-white p-2 text-blue-600 shadow-sm"><MapPin size={16} /></span>
            <div><p className="text-xs font-black text-slate-800">Uses your device GPS</p><p className="mt-0.5 text-xs leading-5 text-slate-500">DatscoGo asks the browser for your current location only after you continue.</p></div>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 rounded-xl bg-white p-2 text-blue-600 shadow-sm">{isDriver ? <Navigation size={16} /> : <ShieldCheck size={16} />}</span>
            <div><p className="text-xs font-black text-slate-800">{isDriver ? 'Live trip sharing' : 'You stay in control'}</p><p className="mt-0.5 text-xs leading-5 text-slate-500">{isDriver ? 'Live sharing starts only for an active departure and stops when the trip is no longer active.' : 'You can choose Not now and still browse routes, schedules, and terminals.'}</p></div>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onNotNow}
            disabled={isRequesting}
            className="order-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 sm:order-1"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={onAllow}
            disabled={isRequesting}
            className="order-1 flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-70 sm:order-2"
          >
            <LocateFixed className={isRequesting ? 'animate-pulse' : ''} size={17} />
            {isRequesting ? 'Requesting…' : 'Allow location'}
          </button>
        </div>

        <p className="mt-4 text-center text-[10px] leading-4 text-slate-400">
          Your browser will show its official location permission prompt next. GPS normally requires HTTPS when the app is hosted online.
        </p>
      </div>
    </div>
  );
};
