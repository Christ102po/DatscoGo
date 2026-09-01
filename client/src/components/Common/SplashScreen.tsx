import React from 'react';
import { DatscoLogo } from '../../assets/svg/DatscoLogo';

interface SplashScreenProps {
  isExiting: boolean;
}

/** A short, branded loading layer shown before the application becomes interactive. */
export const SplashScreen: React.FC<SplashScreenProps> = ({ isExiting }) => (
  <section
    aria-label="Loading DatscoGo"
    aria-live="polite"
    className={`datsco-splash absolute inset-0 z-[70] flex flex-col items-center justify-center overflow-hidden bg-[#1256E8] text-white ${
      isExiting ? 'datsco-splash--exiting' : ''
    }`}
  >
    <div className="absolute -left-16 top-12 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
    <div className="absolute -bottom-24 -right-16 h-56 w-56 rounded-full bg-cyan-300/20 blur-3xl" />

    <div className="datsco-splash__mark relative flex h-20 w-20 items-center justify-center rounded-[1.65rem] border border-white/25 bg-white/15 shadow-[0_18px_40px_rgba(0,34,123,0.32)] backdrop-blur-sm">
      <DatscoLogo size={42} color="#ffffff" />
    </div>
    <p className="relative mt-5 text-2xl font-black tracking-[0.12em]">Datsco<span className="text-cyan-200">Go</span></p>
    <p className="relative mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-100">
      Siargao Transit
    </p>
    <div className="relative mt-9 h-1 w-24 overflow-hidden rounded-full bg-white/25">
      <div className="datsco-splash__loader h-full w-1/2 rounded-full bg-white" />
    </div>
  </section>
);
