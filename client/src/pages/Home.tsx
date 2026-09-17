import HomeTabScreen from '@/app/(tabs)/home';
import { TransitProvider } from '@/contexts/TransitContext';

/**
 * Responsive application entry point.
 * The passenger experience fills the available viewport on phones, tablets,
 * laptops, and large desktop screens instead of being forced into a phone shell.
 */
export default function Home() {
  return (
    <main className="min-h-[100dvh] w-full bg-slate-100">
      <TransitProvider>
        <HomeTabScreen />
      </TransitProvider>
    </main>
  );
}
