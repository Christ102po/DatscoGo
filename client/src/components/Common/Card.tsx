import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = '', ...props }) => (
  <div
    className={`bg-white rounded-2xl shadow-sm border border-slate-100 p-3.5 ${className}`}
    {...props}
  >
    {children}
  </div>
);
