import React from 'react';

export interface DividerProps {
  className?: string;
}

export const Divider: React.FC<DividerProps> = ({ className = '' }) => (
  <div className={`w-full h-[1px] bg-slate-100 my-2 ${className}`} />
);
