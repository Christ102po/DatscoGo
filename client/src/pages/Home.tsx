import HomeTabScreen from '@/app/(tabs)/home';
import { TransitProvider } from '@/contexts/TransitContext';

/**
 * Standalone application entry point.
 * The surrounding showcase, folder tree, explanatory panels, and preview chrome
 * have intentionally been removed so users see only the DATSCO mobile interface.
 */
export default function Home() {
  return (
    <main className="min-h-[100dvh] bg-slate-100 p-0">
      <TransitProvider>
        <HomeTabScreen />
      </TransitProvider>
    </main>
  );
}
