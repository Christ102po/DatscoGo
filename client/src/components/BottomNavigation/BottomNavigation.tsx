import React from 'react';
import { BusIcon } from '../../assets/svg/BusIcon';
import { CalendarIcon } from '../../assets/svg/CalendarIcon';
import { LocationIcon } from '../../assets/svg/LocationIcon';
import { NavigationButton } from './NavigationButton';

export interface BottomNavigationProps {
  activeTab: 'datsco' | 'schedule' | 'terminal' | null;
  onTabChange: (tab: 'datsco' | 'schedule' | 'terminal') => void;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({ activeTab, onTabChange }) => {
  return (
    <div className="relative z-40 flex w-full shrink-0 items-center justify-around border-t border-slate-200 bg-white/95 px-3 pb-[max(0.55rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.06)] backdrop-blur sm:px-6 md:mx-auto md:max-w-3xl md:rounded-t-2xl md:border-x">
      <NavigationButton active={activeTab === 'datsco'} onClick={() => onTabChange('datsco')} icon={<BusIcon size={20} />} label="DATSCOGO" />
      <NavigationButton active={activeTab === 'schedule'} onClick={() => onTabChange('schedule')} icon={<CalendarIcon size={20} />} label="SCHEDULE" />
      <NavigationButton active={activeTab === 'terminal'} onClick={() => onTabChange('terminal')} icon={<LocationIcon size={20} />} label="TERMINAL" />
    </div>
  );
};
