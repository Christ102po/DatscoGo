import React from 'react';

interface DatscoLogoProps {
  size?: number;
  color?: string;
  title?: string;
}

/**
 * Original DatscoGo transit monogram: a D-shaped route with a directional stop marker.
 * Kept as a reusable SVG component so the brand mark remains crisp at every screen size.
 */
export const DatscoLogo: React.FC<DatscoLogoProps> = ({
  size = 40,
  color = 'currentColor',
  title = 'DatscoGo',
}) => (
  <svg
    role="img"
    aria-label={title}
    width={size}
    height={size}
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <title>{title}</title>
    <path
      d="M10 9.5H22.1C31.8 9.5 38 16.1 38 24C38 31.9 31.8 38.5 22.1 38.5H10V9.5Z"
      stroke={color}
      strokeWidth="4.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M10 14.5V33.5" stroke={color} strokeWidth="4.3" strokeLinecap="round" />
    <circle cx="25.4" cy="24" r="3.6" fill={color} />
    <path d="M17 24H21" stroke={color} strokeWidth="3" strokeLinecap="round" />
  </svg>
);
