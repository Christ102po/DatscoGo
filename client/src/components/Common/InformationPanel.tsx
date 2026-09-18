import React from 'react';
import { Mail, MessageCircle, Phone, X } from 'lucide-react';
import { useTransit } from '../../contexts/TransitContext';

export type InformationPanelView = 'about' | 'contact' | 'help' | null;

interface InformationPanelProps {
  view: InformationPanelView;
  onClose: () => void;
  onOpenContact?: () => void;
}

const faqs = [
  {
    question: 'What is DatscoGo for?',
    answer: 'DatscoGo helps Siargao passengers find available routes, view departure schedules, see terminal locations, and monitor active trips.',
  },
  {
    question: 'How do I know whether a route is available?',
    answer: 'Available routes are marked in the route list and can be checked from the passenger map before travel.',
  },
  {
    question: 'Why is the vehicle location not moving?',
    answer: 'A vehicle stays at its last reported terminal until the assigned driver begins the next departure or shares an updated location.',
  },
];

export const InformationPanel: React.FC<InformationPanelProps> = ({ view, onClose, onOpenContact }) => {
  const { contact } = useTransit();
  if (!view) return null;

  const titles: Record<Exclude<InformationPanelView, null>, string> = {
    about: 'About DatscoGo',
    contact: 'Contact Us',
    help: 'Help & FAQ',
  };

  return (
    <div className="absolute inset-0 z-[60] flex items-end bg-slate-950/45 p-3 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6">
      <section
        aria-modal="true"
        role="dialog"
        aria-labelledby="information-panel-title"
        className="max-h-[84dvh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 sm:p-7"
      >
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">DatscoGo</p>
            <h2 id="information-panel-title" className="mt-1 text-xl font-black text-slate-900">{titles[view]}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 active:scale-95"
            aria-label="Close panel"
          >
            <X size={20} />
          </button>
        </div>

        {view === 'about' && (
          <div className="space-y-4 text-sm leading-6 text-slate-600">
            <p>
              <strong className="text-slate-900">DatscoGo</strong> is a Siargao transit companion that brings routes, schedules, terminal locations, and active trip updates into one place.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ['Plan', 'Check routes, estimated travel times, and fare information before you leave.'],
                ['Locate', 'Find terminals on the island map and use them to plan your trip.'],
                ['Travel', 'See when a driver has departed and where the service last reported its position.'],
              ].map(([title, text]) => (
                <article key={title} className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
                  <h3 className="font-bold text-blue-900">{title}</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{text}</p>
                </article>
              ))}
            </div>
          </div>
        )}

        {view === 'contact' && (
          <div className="space-y-3">
            <p className="text-sm leading-6 text-slate-600">Use the official DatscoGo support channels below. The administrator manages these details from the dashboard.</p>
            {[
              [MessageCircle, 'Facebook Page', contact.facebook],
              [Phone, 'Contact Number', contact.phone],
              [Mail, 'Email', contact.email],
            ].map(([Icon, label, detail]) => {
              const ContactIcon = Icon as typeof MessageCircle;
              return (
                <div key={label as string} className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4">
                  <span className="rounded-xl bg-blue-50 p-2.5 text-blue-600"><ContactIcon size={19} /></span>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{label as string}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{(detail as string) || 'Not yet published'}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {view === 'help' && (
          <div className="space-y-3">
            {faqs.map(({ question, answer }) => (
              <details key={question} className="group rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <summary className="cursor-pointer list-none pr-6 text-sm font-bold text-slate-900 marker:content-none">
                  {question}
                  <span className="float-right text-blue-600 transition group-open:rotate-45">+</span>
                </summary>
                <p className="pt-3 text-xs leading-5 text-slate-600">{answer}</p>
              </details>
            ))}

            {onOpenContact && (
              <button
                type="button"
                onClick={onOpenContact}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#1D4ED8] px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 active:scale-[0.98]"
              >
                <Phone size={17} />
                Contact Us
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
