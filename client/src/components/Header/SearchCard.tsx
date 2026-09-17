import React, { useMemo, useState } from 'react';
import { MapPin, Search, X } from 'lucide-react';

export interface SearchDestination {
  id: string;
  label: string;
  subtitle: string;
  routeId: string;
  latitude: number;
  longitude: number;
  terminalId?: string;
  kind: 'terminal' | 'stop';
}

export interface SearchCardProps {
  searchQuery: string;
  destinations: SearchDestination[];
  onSearchQueryChange: (value: string) => void;
  onSelectDestination: (destination: SearchDestination) => void;
  onClear: () => void;
}

export const SearchCard: React.FC<SearchCardProps> = ({
  searchQuery,
  destinations,
  onSearchQueryChange,
  onSelectDestination,
  onClear,
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const visibleSuggestions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const matches = query
      ? destinations.filter((destination) =>
          `${destination.label} ${destination.subtitle}`.toLowerCase().includes(query),
        )
      : destinations;
    return matches.slice(0, 8);
  }, [destinations, searchQuery]);

  const chooseDestination = (destination: SearchDestination) => {
    onSelectDestination(destination);
    setIsFocused(false);
  };

  const submitFirstMatch = (event: React.FormEvent) => {
    event.preventDefault();
    if (visibleSuggestions[0]) chooseDestination(visibleSuggestions[0]);
  };

  return (
    <div className="relative z-40 mb-3 overflow-visible rounded-2xl border border-slate-100 bg-white shadow-sm">
      <form onSubmit={submitFirstMatch} className="relative">
        <div className="flex items-center gap-3 px-3.5 py-3 sm:px-4 sm:py-3.5">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-[#1D4ED8]">
            <Search size={19} strokeWidth={2.5} />
          </div>

          <div className="min-w-0 flex-1">
            <label htmlFor="destination-search" className="mb-0.5 block text-[9px] font-black uppercase tracking-[0.12em] text-[#1D4ED8] sm:text-[10px]">
              Where do you want to go?
            </label>
            <input
              id="destination-search"
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => window.setTimeout(() => setIsFocused(false), 120)}
              autoComplete="off"
              placeholder="Search barangay, stop, or terminal"
              className="w-full bg-transparent text-sm font-bold text-slate-900 outline-none placeholder:font-semibold placeholder:text-slate-400 sm:text-base"
            />
          </div>

          {searchQuery ? (
            <button
              type="button"
              onClick={() => {
                onClear();
                setIsFocused(false);
                (document.activeElement as HTMLElement | null)?.blur();
              }}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Clear destination search"
            >
              <X size={18} />
            </button>
          ) : (
            <button
              type="submit"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#1D4ED8] text-white shadow-md transition hover:bg-blue-700 active:scale-95"
              aria-label="Search destination"
            >
              <MapPin size={18} />
            </button>
          )}
        </div>

        {isFocused && (
          <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-[80] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/15">
            <div className="border-b border-slate-100 px-3.5 py-2 text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">
              DatscoGo destinations and passing stops
            </div>
            <div className="max-h-72 overflow-y-auto p-1.5">
              {visibleSuggestions.map((destination) => (
                <button
                  key={destination.id}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => chooseDestination(destination)}
                  className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition hover:bg-blue-50"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-[#1D4ED8]">
                    <MapPin size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-black text-slate-900 sm:text-sm">{destination.label}</span>
                    <span className="mt-0.5 block truncate text-[10px] font-medium text-slate-500">{destination.subtitle}</span>
                  </span>
                  <span className="shrink-0 rounded-full bg-blue-50 px-2 py-1 text-[8px] font-black uppercase tracking-wide text-blue-700">
                    {destination.kind === 'terminal' ? 'Terminal' : 'Stop'}
                  </span>
                </button>
              ))}

              {visibleSuggestions.length === 0 && (
                <div className="px-4 py-6 text-center">
                  <p className="text-xs font-bold text-slate-600">No DatscoGo stop matches “{searchQuery}”.</p>
                  <p className="mt-1 text-[10px] leading-4 text-slate-400">Suggestions only include terminals, barangays, and stops published by the administrator in DatscoGo routes.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </form>
    </div>
  );
};
