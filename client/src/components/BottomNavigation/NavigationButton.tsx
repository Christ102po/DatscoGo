import React, { useState } from 'react';

export interface NavigationButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

export const NavigationButton: React.FC<NavigationButtonProps> = ({ active, onClick, icon, label }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = () => {
    setIsLoading(true);
    onClick();
    setTimeout(() => {
      setIsLoading(false);
    }, 350);
  };

  return (
    <button
      onClick={handleClick}
      className={`flex flex-col items-center py-1.5 px-4 rounded-2xl transition-all duration-200 transform active:scale-95 hover:bg-blue-50/80 cursor-pointer ${
        active
          ? 'bg-[#1D4ED8] text-white shadow-md scale-105 hover:bg-blue-700'
          : 'text-slate-500 hover:text-[#1D4ED8] bg-transparent'
      }`}
    >
      <div className="mb-0.5 transition-transform duration-200 hover:scale-110 flex items-center justify-center">
        {isLoading ? (
          <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
        ) : (
          React.cloneElement(icon as React.ReactElement<any>, {
            color: active ? '#ffffff' : 'currentColor'
          })
        )}
      </div>
      <span className="text-[9px] font-bold tracking-wider">{label}</span>
    </button>
  );
};
