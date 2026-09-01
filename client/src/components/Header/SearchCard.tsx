import React from 'react';
import { LocationIcon } from '../../assets/svg/LocationIcon';
import { Card } from '../Common/Card';

export interface SearchCardProps {
  searchQuery: string;
  onSearchClick: () => void;
}

export const SearchCard: React.FC<SearchCardProps> = ({ searchQuery, onSearchClick }) => {
  return (
    <Card className="mb-3 relative z-20 flex items-center justify-between">
      <div>
        <div className="text-[10px] font-bold tracking-wider text-[#1D4ED8] mb-0.5">
          ENTER YOUR DESTINATION
        </div>
        <div className="text-lg font-bold text-slate-900">
          {searchQuery || "Where to?"}
        </div>
      </div>
      <button 
        onClick={onSearchClick}
        className="w-10 h-10 rounded-full bg-[#1D4ED8] flex items-center justify-center text-white shadow-md hover:bg-blue-700 transition-all cursor-pointer"
        title="Search Location"
      >
        <LocationIcon size={20} color="#ffffff" />
      </button>
    </Card>
  );
};
