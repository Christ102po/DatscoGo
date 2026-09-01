import React from 'react';
import { IconProps } from './MenuIcon';

export const BusTransitIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor', className = '', ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <path d="M3 11h18" />
    <circle cx="7" cy="16" r="2" />
    <circle cx="17" cy="16" r="2" />
    <path d="M5 6V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v2" />
  </svg>
);
