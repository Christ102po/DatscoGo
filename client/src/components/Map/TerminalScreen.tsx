import React from 'react';
import { Navigation } from 'lucide-react';
import { LocationIcon } from '../../assets/svg/LocationIcon';
import { useTransit } from '../../contexts/TransitContext';

export interface TerminalScreenProps {
  onBack: () => void;
  onViewMap: (terminalId: string) => void;
  onGuideToTerminal?: (terminalId: string) => void;
}

export const TerminalScreen: React.FC<TerminalScreenProps> = ({ onBack, onViewMap, onGuideToTerminal }) => {
  const { terminals } = useTransit();

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50">
      <div className="relative z-20 flex w-full shrink-0 items-center justify-between bg-[#1D4ED8] px-4 pb-3 pt-3 text-white shadow-sm sm:px-6 md:px-8">
        <button onClick={onBack} className="rounded-lg p-1.5 text-white transition-colors hover:bg-blue-600" aria-label="Back to map">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
        </button>
        <div className="text-base font-bold tracking-wide text-white sm:text-lg">DatscoGo Terminals</div>
        <div className="h-8 w-8" aria-hidden="true" />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3.5 pb-24 sm:p-5 sm:pb-24 md:p-8 md:pb-24">
        <div className="mx-auto grid w-full max-w-7xl gap-4 md:grid-cols-2 xl:grid-cols-3">
          {terminals.map((term) => (
            <article key={term.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="relative flex h-28 items-center justify-center overflow-hidden border-b border-slate-100 bg-[#E8EEF5] sm:h-32">
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#1D4ED8_1px,transparent_1px)] [background-size:12px_12px]"></div>
                <div className="z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#1D4ED8] bg-white shadow-md"><LocationIcon size={17} color="#1D4ED8" /></div>
              </div>

              <div className="p-4">
                <div className="text-sm font-black text-slate-900">{term.name}</div>
                <div className="mt-1 text-[11px] leading-5 text-slate-500">{term.details}</div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button onClick={() => onViewMap(term.id)} className="rounded-xl border border-[#1D4ED8] px-3 py-2 text-xs font-bold text-[#1D4ED8] transition-colors hover:bg-blue-50">View map</button>
                  <button onClick={() => onGuideToTerminal?.(term.id)} className="flex items-center justify-center gap-1.5 rounded-xl bg-[#1D4ED8] px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-700"><Navigation size={14} />Guide me</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
};
