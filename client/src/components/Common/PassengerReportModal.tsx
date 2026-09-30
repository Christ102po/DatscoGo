import React, { useMemo, useRef, useState } from 'react';
import { Camera, ImagePlus, ShieldCheck, X } from 'lucide-react';
import { TransitRoute } from '../../contexts/TransitContext';

interface PassengerReportModalProps {
  isOpen: boolean;
  routes: TransitRoute[];
  onClose: () => void;
}

const fieldClass = 'mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100';

async function compressImage(file: File): Promise<string> {
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Unable to read this photo.'));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Unable to process this photo.'));
    img.src = source;
  });

  const maxDimension = 1600;
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Unable to process this photo.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  let quality = 0.84;
  let result = canvas.toDataURL('image/jpeg', quality);
  while (result.length > 3_200_000 && quality > 0.45) {
    quality -= 0.08;
    result = canvas.toDataURL('image/jpeg', quality);
  }
  if (result.length > 4_100_000) throw new Error('The selected photo is still too large. Please choose a smaller image.');
  return result;
}

export const PassengerReportModal: React.FC<PassengerReportModalProps> = ({ isOpen, routes, onClose }) => {
  const availableRoutes = useMemo(() => routes.filter((route) => route.available), [routes]);
  const [routeId, setRouteId] = useState('');
  const [issueType, setIssueType] = useState('Driver behavior');
  const [details, setDetails] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const selectPhoto = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return setNotice({ text: 'Please choose an image file.', error: true });
    try {
      setNotice({ text: 'Preparing photo…' });
      const prepared = await compressImage(file);
      setImageDataUrl(prepared);
      setNotice(null);
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : 'Unable to prepare this photo.', error: true });
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const route = routes.find((item) => item.id === routeId);
    if (!route) return setNotice({ text: 'Choose the route where the issue happened.', error: true });
    if (!details.trim()) return setNotice({ text: 'Please describe what happened.', error: true });

    setSending(true);
    setNotice(null);
    try {
      const response = await fetch('/api/driver-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routeId: route.id,
          routeTitle: route.title,
          issueType,
          details: details.trim(),
          reporterName: reporterName.trim(),
          imageDataUrl: imageDataUrl || undefined,
        }),
      });
      const payload = await response.json().catch(() => ({})) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Unable to submit your report.');

      setRouteId('');
      setIssueType('Driver behavior');
      setDetails('');
      setReporterName('');
      setImageDataUrl(null);
      setNotice({ text: 'Report submitted. The DatscoGo administrator can now review it.' });
      window.setTimeout(onClose, 1200);
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : 'Unable to submit your report.', error: true });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="absolute inset-0 z-[80] flex items-end justify-center bg-black/50 backdrop-blur-sm md:items-center md:p-5">
      <div className="max-h-[88dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl md:max-w-lg md:rounded-3xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.14em] text-blue-600">Passenger privacy</p>
            <h2 className="mt-1 text-lg font-black text-slate-900">Report a driver issue</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">Your name is optional. You may submit the report anonymously.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100" aria-label="Close report form"><X size={19} /></button>
        </div>

        <form onSubmit={submit} className="mt-5 space-y-4">
          <label className="block text-xs font-bold text-slate-600">Route with the issue
            <select required value={routeId} onChange={(event) => setRouteId(event.target.value)} className={fieldClass}>
              <option value="">Select route</option>
              {(availableRoutes.length ? availableRoutes : routes).map((route) => <option key={route.id} value={route.id}>{route.title}</option>)}
            </select>
          </label>

          <label className="block text-xs font-bold text-slate-600">Type of issue
            <select value={issueType} onChange={(event) => setIssueType(event.target.value)} className={fieldClass}>
              <option>Driver behavior</option>
              <option>Unsafe driving</option>
              <option>Overcharging / fare issue</option>
              <option>Route concern</option>
              <option>Vehicle condition</option>
              <option>Passenger treatment</option>
              <option>Other</option>
            </select>
          </label>

          <label className="block text-xs font-bold text-slate-600">What happened?
            <textarea required maxLength={2000} value={details} onChange={(event) => setDetails(event.target.value)} rows={4} placeholder="Describe the issue clearly so the admin can review it." className={fieldClass} />
          </label>

          <label className="block text-xs font-bold text-slate-600">Your name <span className="font-medium text-slate-400">(optional)</span>
            <input maxLength={120} value={reporterName} onChange={(event) => setReporterName(event.target.value)} placeholder="Leave blank to report anonymously" className={fieldClass} />
          </label>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-black text-slate-700">Photo evidence <span className="font-medium text-slate-400">(optional)</span></p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-3 py-2.5 text-xs font-bold text-blue-700 hover:bg-blue-50"><ImagePlus size={16} />Choose photo</button>
              <button type="button" onClick={() => cameraInputRef.current?.click()} className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2.5 text-xs font-bold text-white hover:bg-blue-700"><Camera size={16} />Take photo</button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => void selectPhoto(event.target.files?.[0])} />
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => void selectPhoto(event.target.files?.[0])} />
            {imageDataUrl && (
              <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
                <img src={imageDataUrl} alt="Report evidence preview" className="max-h-56 w-full object-contain" />
                <button type="button" onClick={() => setImageDataUrl(null)} className="w-full border-t border-slate-100 py-2 text-xs font-bold text-red-600 hover:bg-red-50">Remove photo</button>
              </div>
            )}
          </div>

          <div className="flex items-start gap-2 rounded-xl bg-blue-50 p-3 text-[11px] leading-5 text-blue-800"><ShieldCheck size={16} className="mt-0.5 shrink-0" /><span>If you leave the name field blank, the admin will only see “Anonymous passenger.”</span></div>

          {notice && <div className={`rounded-xl px-3 py-2 text-xs font-bold ${notice.error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{notice.text}</div>}

          <button disabled={sending || routes.length === 0} className="w-full rounded-xl bg-blue-600 py-3 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{sending ? 'Submitting report…' : 'Submit report'}</button>
          {routes.length === 0 && <p className="text-center text-xs text-slate-400">No routes are currently available to report.</p>}
        </form>
      </div>
    </div>
  );
};
