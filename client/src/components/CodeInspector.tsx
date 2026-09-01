import React, { useState } from 'react';

const filesCode = {
  "DatscoMobileApp.tsx": `import React, { useState } from 'react';
import { MenuIcon } from './icons/MenuIcon';
import { HelpIcon } from './icons/HelpIcon';
import { NotificationIcon } from './icons/NotificationIcon';
import { LocationPinIcon } from './icons/LocationPinIcon';
import { BusTransitIcon } from './icons/BusTransitIcon';
import { FerryIcon } from './icons/FerryIcon';
import { ScheduleCalendarIcon } from './icons/ScheduleCalendarIcon';

export const DatscoMobileApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'datsco' | 'schedule' | 'terminal'>('datsco');
  const [selectedRoute, setSelectedRoute] = useState<string | null>('General Luna — Dapa');
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="flex flex-col items-center justify-center p-4">
      {/* Smartphone Device Shell */}
      <div className="relative w-[320px] h-[640px] bg-white rounded-[40px] shadow-2xl border-[8px] border-slate-900 overflow-hidden flex flex-col font-sans">
        
        {/* Status / Header Bar */}
        <div className="w-full bg-[#1D4ED8] pt-3 pb-2 px-5 flex items-center justify-between text-white relative z-20">
          <MenuIcon size={20} color="#ffffff" className="cursor-pointer" />
          <div className="font-black tracking-widest text-lg text-white">DATSCO</div>
          <div className="flex items-center space-x-2">
            <HelpIcon size={18} color="#ffffff" className="cursor-pointer" />
            <NotificationIcon size={18} color="#ffffff" className="cursor-pointer" />
          </div>
        </div>

        {/* Curved blue header bottom transition */}
        <div className="bg-[#1D4ED8] h-6 w-full rounded-b-[24px] absolute top-[48px] left-0 z-10"></div>

        {/* App Content */}
        <div className="flex-1 bg-slate-50 flex flex-col pt-4 px-3 pb-3 relative z-10 overflow-y-auto">
          {/* Search Destination Card */}
          <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100 mb-3 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold tracking-wider text-[#1D4ED8]">ENTER YOUR DESTINATION</div>
              <div className="text-lg font-bold text-slate-900">{searchQuery || "Where to?"}</div>
            </div>
            <div className="w-10 h-10 rounded-full bg-[#1D4ED8] flex items-center justify-center text-white shadow-md">
              <LocationPinIcon size={20} color="#ffffff" />
            </div>
          </div>

          {/* Interactive Map Area */}
          <div className="flex-1 bg-[#E8EEF5] rounded-2xl relative overflow-hidden border border-slate-200 mb-3 min-h-[220px]">
            {/* Map Pins */}
            <div className="absolute top-[90px] left-[95px] w-5 h-5 rounded-full bg-white shadow flex items-center justify-center border-2 border-[#1D4ED8]">
              <div className="w-2 h-2 rounded-full bg-[#1D4ED8]"></div>
            </div>
            <div className="absolute top-[65px] right-[75px] w-5 h-5 rounded-full bg-white shadow flex items-center justify-center border-2 border-[#1D4ED8]">
              <div className="w-2 h-2 rounded-full bg-[#1D4ED8]"></div>
            </div>
            <div className="absolute top-[135px] left-[155px] w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center border-2 border-amber-500">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
            </div>
          </div>

          {/* Route Selector Chips */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-1">
            <button className="flex items-center space-x-1.5 px-3 py-2 rounded-full text-xs font-semibold bg-white border border-[#1D4ED8] text-slate-900 shadow-sm">
              <LocationPinIcon size={14} color="#1D4ED8" />
              <span>General Luna — Dapa</span>
            </button>
            <button className="flex items-center space-x-1.5 px-3 py-2 rounded-full text-xs font-semibold bg-white border border-slate-200 text-slate-700">
              <FerryIcon size={14} color="#0284C7" />
              <span>Del Carmen — Dapa</span>
            </button>
          </div>
        </div>

        {/* Bottom Navigation */}
        <div className="bg-white border-t border-slate-100 py-2 px-4 flex items-center justify-around relative z-20">
          <button onClick={() => setActiveTab('datsco')} className="flex flex-col items-center py-1 px-4 rounded-xl bg-[#1D4ED8] text-white">
            <BusTransitIcon size={20} color="#ffffff" />
            <span className="text-[9px] font-bold tracking-widest mt-1">DATSCO</span>
          </button>
          <button onClick={() => setActiveTab('schedule')} className="flex flex-col items-center py-1 px-4 rounded-xl text-slate-400">
            <ScheduleCalendarIcon size={20} color="currentColor" />
            <span className="text-[9px] font-bold tracking-widest mt-1">SCHEDULE</span>
          </button>
          <button onClick={() => setActiveTab('terminal')} className="flex flex-col items-center py-1 px-4 rounded-xl text-slate-400">
            <LocationPinIcon size={20} color="currentColor" />
            <span className="text-[9px] font-bold tracking-widest mt-1">TERMINAL</span>
          </button>
        </div>
      </div>
    </div>
  );
};`,

  "MenuIcon.tsx": `import React from 'react';

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  color?: string;
}

export const MenuIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor', className = '', ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);`,

  "HelpIcon.tsx": `import React from 'react';
import { IconProps } from './MenuIcon';

export const HelpIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor', className = '', ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);`,

  "NotificationIcon.tsx": `import React from 'react';
import { IconProps } from './MenuIcon';

export const NotificationIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor', className = '', ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    <circle cx="18" cy="5" r="3" fill="#F59E0B" stroke="#ffffff" strokeWidth="1.5" />
  </svg>
);`,

  "LocationPinIcon.tsx": `import React from 'react';
import { IconProps } from './MenuIcon';

export const LocationPinIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor', className = '', ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);`,

  "BusTransitIcon.tsx": `import React from 'react';
import { IconProps } from './MenuIcon';

export const BusTransitIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor', className = '', ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <path d="M3 11h18" />
    <circle cx="7" cy="16" r="2" />
    <circle cx="17" cy="16" r="2" />
    <path d="M5 6V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v2" />
  </svg>
);`,

  "ScheduleCalendarIcon.tsx": `import React from 'react';
import { IconProps } from './MenuIcon';

export const ScheduleCalendarIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor', className = '', ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);`
};

export const CodeInspector: React.FC = () => {
  const [activeFile, setActiveFile] = useState<keyof typeof filesCode>("DatscoMobileApp.tsx");
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(filesCode[activeFile]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-slate-900 rounded-2xl shadow-xl overflow-hidden border border-slate-800 text-slate-200">
      {/* File Tabs */}
      <div className="flex items-center bg-slate-950 px-4 py-2.5 overflow-x-auto border-b border-slate-800">
        {Object.keys(filesCode).map((filename) => (
          <button
            key={filename}
            onClick={() => setActiveFile(filename as keyof typeof filesCode)}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-lg mr-2 transition-all cursor-pointer whitespace-nowrap ${
              activeFile === filename
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            {filename}
          </button>
        ))}
      </div>

      {/* Code Header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs text-slate-400">
        <span className="font-mono text-slate-300">client/src/components/{activeFile}</span>
        <button
          onClick={handleCopy}
          className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md transition-colors cursor-pointer text-xs font-semibold"
        >
          {copied ? 'Copied to Clipboard!' : 'Copy Code'}
        </button>
      </div>

      {/* Code Content */}
      <div className="p-4 overflow-x-auto max-h-[500px]">
        <pre className="font-mono text-xs leading-relaxed text-blue-300">
          <code>{filesCode[activeFile]}</code>
        </pre>
      </div>
    </div>
  );
};
