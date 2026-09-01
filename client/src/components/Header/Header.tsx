import React from 'react';
import { MenuIcon } from '../../assets/svg/MenuIcon';
import { HelpIcon } from '../../assets/svg/HelpIcon';
import { NotificationIcon } from '../../assets/svg/NotificationIcon';
import { IconButton } from './IconButton';

export interface HeaderProps {
  onMenuClick: () => void;
  onHelpClick: () => void;
  onNotificationClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick, onHelpClick, onNotificationClick }) => {
  return (
    <>
      <div className="w-full bg-[#1D4ED8] pt-3 pb-2 px-5 flex items-center justify-between text-white relative z-20">
        <div className="flex items-center space-x-3">
          <IconButton
            icon={<MenuIcon size={20} color="#ffffff" />}
            label="Menu"
            onClick={onMenuClick}
          />
        </div>
        
        <div className="font-black tracking-wide text-lg text-white">
          Datsco<span className="text-blue-100">Go</span>
        </div>

        <div className="flex items-center space-x-2">
          <IconButton
            icon={<HelpIcon size={18} color="#ffffff" />}
            label="Help"
            onClick={onHelpClick}
          />
          <IconButton
            icon={<NotificationIcon size={18} color="#ffffff" />}
            label="Notifications"
            onClick={onNotificationClick}
          />
        </div>
      </div>

      <div className="bg-[#1D4ED8] h-6 w-full rounded-b-[24px] absolute top-[48px] left-0 z-10 shadow-md"></div>
    </>
  );
};
