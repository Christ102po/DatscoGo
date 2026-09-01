import React from 'react';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  label: string;
}

export const IconButton: React.FC<IconButtonProps> = ({ icon, label, className = '', ...props }) => (
  <button
    className={`p-1.5 hover:bg-blue-600 rounded-lg transition-colors cursor-pointer flex items-center justify-center ${className}`}
    aria-label={label}
    {...props}
  >
    {icon}
  </button>
);
