import React, { useEffect, useState } from 'react';
import {
  CircleHelp,
  Download,
  Info,
  LogIn,
  Mail,
  X,
} from 'lucide-react';
import { DatscoLogo } from '../../assets/svg/DatscoLogo';

export type SidebarAction = 'about' | 'contact' | 'help' | 'login';

interface DatscoGoSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (action: SidebarAction) => void;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
}

const sidebarItems = [
  { action: 'about' as const, label: 'About Us', icon: Info },
  { action: 'contact' as const, label: 'Contact Us', icon: Mail },
  { action: 'help' as const, label: 'Help', icon: CircleHelp },
  { action: 'login' as const, label: 'Login', icon: LogIn },
];

export const DatscoGoSidebar: React.FC<DatscoGoSidebarProps> = ({
  isOpen,
  onClose,
  onSelect,
}) => {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    if (standalone) {
      setIsInstalled(true);
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setInstallPrompt(null);
      setIsInstalled(true);
    };

    window.addEventListener(
      'beforeinstallprompt',
      handleBeforeInstallPrompt,
    );

    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt,
      );

      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  if (!isOpen) return null;

  const select = (action: SidebarAction) => {
    onClose();
    onSelect(action);
  };

  const installApp = async () => {
    if (isInstalled) return;

    if (installPrompt) {
      await installPrompt.prompt();

      const result = await installPrompt.userChoice;

      if (result.outcome === 'accepted') {
        setInstallPrompt(null);
      }

      return;
    }

    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

    if (isIOS) {
      window.alert(
        'To install DatscoGo on iPhone/iPad: tap the Share button in Safari, then choose "Add to Home Screen".',
      );
      return;
    }

    window.alert(
      'DatscoGo cannot be installed yet. Open the online DatscoGo website using Chrome, then try again.',
    );
  };

  return (
    <div
      className="absolute inset-0 z-50 flex bg-slate-950/45 backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in"
      role="presentation"
    >
      <aside
        aria-label="DatscoGo navigation"
        className="flex h-full w-[min(84%,340px)] flex-col bg-white p-5 shadow-2xl motion-safe:animate-in motion-safe:slide-in-from-left-4 sm:w-[360px]"
      >
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-600/20">
              <DatscoLogo size={23} color="#ffffff" />
            </span>

            <div>
              <p className="text-base font-black tracking-tight text-slate-900">
                Datsco<span className="text-blue-600">Go</span>
              </p>

              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                Siargao Transit
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 active:scale-95"
            aria-label="Close navigation menu"
          >
            <X size={19} />
          </button>
        </div>

        <nav className="space-y-2">
          {sidebarItems.map(({ action, label, icon: Icon }) => (
            <button
              key={action}
              type="button"
              onClick={() => select(action)}
              className="flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left text-sm font-bold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 active:scale-[0.98]"
            >
              <span className="rounded-xl bg-slate-100 p-2 text-slate-500">
                <Icon size={18} />
              </span>

              {label}
            </button>
          ))}

          <div className="my-3 border-t border-slate-100" />

          <button
            type="button"
            onClick={installApp}
            disabled={isInstalled}
            className={`flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left text-sm font-bold transition active:scale-[0.98] ${
              isInstalled
                ? 'cursor-default bg-emerald-50 text-emerald-700'
                : 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700'
            }`}
          >
            <span
              className={`rounded-xl p-2 ${
                isInstalled
                  ? 'bg-emerald-100 text-emerald-600'
                  : 'bg-white/15 text-white'
              }`}
            >
              <Download size={18} />
            </span>

            <div>
              <div>{isInstalled ? 'App Installed' : 'Install App'}</div>

              {!isInstalled && (
                <div className="mt-0.5 text-[10px] font-medium text-blue-100">
                  Add DatscoGo to your Home Screen
                </div>
              )}
            </div>
          </button>
        </nav>

        <p className="mt-auto border-t border-slate-100 pt-4 text-xs leading-5 text-slate-400">
          Travel smarter across Siargao with routes, terminal information,
          and trip updates in one place.
        </p>
      </aside>

      <button
        type="button"
        onClick={onClose}
        className="flex-1 cursor-default"
        aria-label="Close navigation overlay"
      />
    </div>
  );
};
