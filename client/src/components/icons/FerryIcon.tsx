import React from 'react';
import { IconProps } from './MenuIcon';

export const FerryIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor', className = '', ...props }) => (
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
    <path d="M2 18h20v2H2z" />
    <path d="M4 14l2-6h12l2 6H4z" />
    <path d="M10 8V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v3" />
    <path d="M12 4v-1" />
  </svg>
);
