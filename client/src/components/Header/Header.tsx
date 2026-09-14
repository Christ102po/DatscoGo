import React from 'react';
import { MenuIcon } from '../../assets/svg/MenuIcon';
import { HelpIcon } from '../../assets/svg/HelpIcon';
import { NotificationIcon } from '../../assets/svg/NotificationIcon';
import { IconButton } from './IconButton';

export interface HeaderProps {
  onMenuClick: () => void;
  onHelpClick: () => void;
  onNotificationClick: () => void;
  notificationCount?: number;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick, onHelpClick, onNotificationClick, notificationCount = 0 }) => {
  return (
    <>
      <div className="relative z-20 flex w-full shrink-0 items-center justify-between bg-[#1D4ED8] px-4 pb-2 pt-3 text-white sm:px-6 md:px-8">
        <div className="flex items-center space-x-3">
          <IconButton icon={<MenuIcon size={20} color="#ffffff" />} label="Menu" onClick={onMenuClick} />
        </div>

        <div className="text-lg font-black tracking-wide text-white sm:text-xl">Datsco<span className="text-blue-100">Go</span></div>

        <div className="flex items-center space-x-2">
          <IconButton icon={<HelpIcon size={18} color="#ffffff" />} label="Help" onClick={onHelpClick} />
          <div className="relative">
            <IconButton icon={<NotificationIcon size={18} color="#ffffff" />} label="Notifications" onClick={onNotificationClick} />
            {notificationCount > 0 && <span className="pointer-events-none absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-amber-400 px-1 text-[9px] font-black text-slate-900 ring-2 ring-blue-700">{notificationCount > 9 ? '9+' : notificationCount}</span>}
          </div>
        </div>
      </div>

      <div className="absolute left-0 top-[48px] z-10 h-6 w-full rounded-b-[24px] bg-[#1D4ED8] shadow-md sm:top-[50px]"></div>
    </>
  );
};
