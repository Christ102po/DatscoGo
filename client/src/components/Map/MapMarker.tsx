import React from 'react';

export interface MapMarkerProps {
  color?: string;
  active?: boolean;
}

export const MapMarker: React.FC<MapMarkerProps> = ({ color = '#1D4ED8', active = false }) => (
  <div className="flex flex-col items-center">
    <div
      className={`rounded-full bg-white shadow-md flex items-center justify-center transition-all ${
        active ? 'w-7 h-7 border-2 border-amber-500 shadow-lg' : 'w-5 h-5 border-2'
      }`}
      style={{ borderColor: active ? '#F59E0B' : color }}
    >
      <div
        className={`rounded-full ${active ? 'w-3 h-3 bg-amber-500 animate-pulse' : 'w-2 h-2'}`}
        style={{ backgroundColor: active ? '#F59E0B' : color }}
      />
    </div>
  </div>
);
