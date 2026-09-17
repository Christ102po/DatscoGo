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
    <div className="relative z-20 flex items-center justify-around border-t border-slate-100 bg-white px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <NavigationButton
        active={activeTab === 'datsco'}
        onClick={() => onTabChange('datsco')}
        icon={<BusIcon size={20} />}
        label="DATSCOGO"
      />
      <NavigationButton
        active={activeTab === 'schedule'}
        onClick={() => onTabChange('schedule')}
        icon={<CalendarIcon size={20} />}
        label="SCHEDULE"
      />
      <NavigationButton
        active={activeTab === 'terminal'}
        onClick={() => onTabChange('terminal')}
        icon={<LocationIcon size={20} />}
        label="TERMINAL"
      />
    </div>
  );
};
