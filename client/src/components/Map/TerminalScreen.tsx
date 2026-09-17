import React from 'react';
import { LocationIcon } from '../../assets/svg/LocationIcon';
import { useTransit } from '../../contexts/TransitContext';

export interface TerminalScreenProps {
  onBack: () => void;
  onViewMap: (terminalId: string) => void;
}

export const TerminalScreen: React.FC<TerminalScreenProps> = ({ onBack, onViewMap }) => {
  const { terminals } = useTransit();

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
          DatscoGo Terminals
        </div>

        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold text-white overflow-hidden border border-white/30">
          <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=60" alt="Profile" className="w-full h-full object-cover" />
        </div>
      </div>

      {/* Terminals List Content */}
      <div className="flex-1 p-3.5 overflow-y-auto pb-6">
        {terminals.map((term) => (
          <div key={term.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-3">
            {/* Map Preview Thumbnail Area */}
            <div className="h-24 bg-[#E8EEF5] relative flex items-center justify-center border-b border-slate-100 overflow-hidden">
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#1D4ED8_1px,transparent_1px)] [background-size:12px_12px]"></div>
              <div className="w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center border-2 border-[#1D4ED8]">
                <LocationIcon size={16} color="#1D4ED8" />
              </div>
            </div>

            {/* Bottom Content Section */}
            <div className="p-3.5 flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-900 text-sm mb-0.5">
                  {term.name}
                </div>
                <div className="text-[11px] text-slate-500">
                  {term.details}
                </div>
              </div>

              <button
                onClick={() => onViewMap(term.id)}
                className="px-3 py-1.5 rounded-lg border border-[#1D4ED8] text-[#1D4ED8] text-xs font-semibold hover:bg-blue-50 transition-colors cursor-pointer"
              >
                View map
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
