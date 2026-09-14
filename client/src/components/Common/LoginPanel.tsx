import React, { useState } from 'react';
import { Eye, EyeOff, LockKeyhole, UserRound, X } from 'lucide-react';

export type LoginRole = 'passenger' | 'driver' | 'admin';

interface LoginPanelProps {
  onClose: () => void;
  onLogin: (username: string, password: string) => Promise<LoginRole | null>;
}

export const LoginPanel: React.FC<LoginPanelProps> = ({ onClose, onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    const role = await onLogin(username.trim(), password);
    setIsSubmitting(false);
    if (!role) setError('The username or password is incorrect.');
  };

  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <section aria-modal="true" role="dialog" aria-labelledby="login-panel-title" className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 sm:p-7">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">DatscoGo access</p>
            <h2 id="login-panel-title" className="mt-1 text-2xl font-black text-slate-900">Sign in</h2>
            <p className="mt-2 text-sm text-slate-600">Driver and administrator accounts can access operational controls.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 active:scale-95" aria-label="Close login">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-slate-700">Username</span>
            <span className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 focus-within:border-blue-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100">
              <UserRound size={17} className="text-slate-400" />
              <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required className="w-full bg-transparent py-3 text-sm text-slate-900 outline-none" placeholder="Enter your username" />
            </span>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-slate-700">Password</span>
            <span className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 focus-within:border-blue-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100">
              <LockKeyhole size={17} className="text-slate-400" />
              <input value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? 'text' : 'password'} autoComplete="current-password" required className="w-full bg-transparent py-3 text-sm text-slate-900 outline-none" placeholder="Enter your password" />
              <button type="button" onClick={() => setShowPassword((shown) => !shown)} className="rounded p-1 text-slate-400 transition hover:text-blue-600" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </span>
          </label>
          {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p>}
          <button type="submit" disabled={isSubmitting} className="flex w-full items-center justify-center rounded-xl bg-[#1D4ED8] py-3 text-sm font-bold text-white transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-70 active:scale-[0.98]">
            {isSubmitting ? 'Signing in…' : 'Login'}
          </button>
        </form>

        <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">Starter administrator credentials are <strong>admin123</strong> / <strong>admin123</strong>. Change this starter password from the administrator dashboard before production use.</p>
      </section>
    </div>
  );
};
