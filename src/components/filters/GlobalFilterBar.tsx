'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { navigationStartEvent } from '@/components/layout/NavigationLoader';

const nightTypes = [
  ['10', '$10 nights'],
  ['20', '$20 nights'],
  ['50', '$50 nights'],
  ['one-off', 'One-offs'],
] as const;
const currentSeason = 'fall-2026';
const currentSeasonNightTypes = ['10', '20'];
const defaultNightTypes = ['10', '20'];
const minNightsOptions = [1, 3, 5, 10] as const;
const defaultMinNights = 3;

function seasonLabel(season: string) {
  const [name, ...rest] = season.split('-');
  const year = rest.at(-1);
  return `${name.charAt(0).toUpperCase()}${name.slice(1)}${year ? ` ’${year.slice(-2)}` : ''}`;
}

export function GlobalFilterBar({ seasonIds }: { seasonIds: string[] }) {
  const seasons = seasonIds.map((value) => [value, seasonLabel(value)] as const);
  const sp = useSearchParams();
  const router = useRouter();
  const path = usePathname();

  function selected(
    key: string,
    all: readonly (readonly [string, string])[],
    defaults = all.map(([value]) => value),
  ) {
    const values = sp.getAll(key);
    return values.length ? values : defaults;
  }

  function navigate(params: URLSearchParams) {
    const query = params.toString();
    window.dispatchEvent(new Event(navigationStartEvent));
    router.push(query ? `${path}?${query}` : path);
  }

  function toggle(
    key: string,
    value: string,
    all: readonly (readonly [string, string])[],
    defaults = all.map(([option]) => option),
  ) {
    const params = new URLSearchParams(sp);
    const values = new Set(selected(key, all, defaults));
    values.has(value) ? values.delete(value) : values.add(value);
    params.delete(key);
    const isDefault =
      values.size === defaults.length && defaults.every((option) => values.has(option));
    if (!isDefault) {
      Array.from(values).forEach((selectedValue) => params.append(key, selectedValue));
    }
    navigate(params);
  }

  const currentSeasonSelected =
    selected('season', seasons).length === 1 &&
    selected('season', seasons)[0] === currentSeason &&
    selected('nightType', nightTypes, defaultNightTypes).length === currentSeasonNightTypes.length &&
    currentSeasonNightTypes.every((type) =>
      selected('nightType', nightTypes, defaultNightTypes).includes(type),
    );
  const allSelected =
    selected('season', seasons).length === seasons.length &&
    seasons.every(([value]) => selected('season', seasons).includes(value)) &&
    selected('nightType', nightTypes, defaultNightTypes).length === nightTypes.length &&
    nightTypes.every(([value]) =>
      selected('nightType', nightTypes, defaultNightTypes).includes(value),
    );

  function toggleAll() {
    const params = new URLSearchParams(sp);
    params.delete('season');
    params.delete('nightType');
    if (!allSelected) {
      nightTypes.forEach(([value]) => params.append('nightType', value));
    }
    navigate(params);
  }

  function toggleCurrentSeason() {
    const params = new URLSearchParams(sp);
    params.delete('season');
    params.delete('nightType');
    if (!currentSeasonSelected) {
      params.set('season', currentSeason);
      currentSeasonNightTypes.forEach((type) => params.append('nightType', type));
    }
    navigate(params);
  }

  const requestedMinNights = Number(sp.get('minNights'));
  const minNights = (minNightsOptions as readonly number[]).includes(requestedMinNights)
    ? requestedMinNights
    : defaultMinNights;

  function selectMinNights(value: number) {
    const params = new URLSearchParams(sp);
    if (value === defaultMinNights) params.delete('minNights');
    else params.set('minNights', String(value));
    navigate(params);
  }

  return (
    <section className="card overflow-hidden" aria-labelledby="scope-heading">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-carolina-light/50 px-4 py-3">
        <h2 className="text-xs font-black uppercase tracking-[.16em] text-navy" id="scope-heading">Scope</h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={allSelected}
            onClick={toggleAll}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold"
          >
            All
            <Toggle checked={allSelected} />
          </button>
          <button
            type="button"
            role="switch"
            aria-checked={currentSeasonSelected}
            onClick={toggleCurrentSeason}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold"
          >
            Current Season
            <Toggle checked={currentSeasonSelected} />
          </button>
        </div>
      </div>
      <div className="grid divide-y md:grid-cols-[9rem_1fr] md:divide-y-0">
        <div className="contents">
          <div className="bg-gray-50 px-4 py-3 text-sm font-bold text-navy md:border-b md:border-r">Season</div>
          <fieldset className="flex flex-wrap gap-2 px-4 py-3 md:border-b">
            <legend className="sr-only">Season</legend>
        {seasons.map(([value, label]) => (
          <label className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-medium shadow-sm hover:border-carolina" key={value}>
            <input
              type="checkbox"
              checked={selected('season', seasons).includes(value)}
              onChange={() => toggle('season', value, seasons)}
            />
            {label}
          </label>
        ))}
          </fieldset>
        </div>
        <div className="contents">
          <div className="bg-gray-50 px-4 py-3 text-sm font-bold text-navy md:border-b md:border-r">Night Type</div>
          <fieldset className="flex flex-wrap gap-2 px-4 py-3 md:border-b">
            <legend className="sr-only">Night type</legend>
        {nightTypes.map(([value, label]) => (
          <label className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-medium shadow-sm hover:border-carolina" key={value}>
            <input
              type="checkbox"
              checked={selected('nightType', nightTypes, defaultNightTypes).includes(value)}
              onChange={() => toggle('nightType', value, nightTypes, defaultNightTypes)}
            />
            {label}
          </label>
        ))}
          </fieldset>
        </div>
        <div className="contents">
          <div className="bg-gray-50 px-4 py-3 text-sm font-bold text-navy md:border-r">Min Nights</div>
          <fieldset className="flex flex-wrap gap-2 px-4 py-3">
            <legend className="sr-only">Minimum nights played</legend>
            {minNightsOptions.map((value) => (
              <label className="flex min-w-14 items-center justify-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-medium shadow-sm hover:border-carolina" key={value}>
                <input type="radio" name="min-nights" checked={minNights === value} onChange={() => selectMinNights(value)} />
                {value}
              </label>
            ))}
          </fieldset>
        </div>
      </div>
    </section>
  );
}

function Toggle({ checked }: { checked: boolean }) {
  return <span aria-hidden="true" className={`relative h-6 w-11 rounded-full transition-colors ${checked ? 'bg-carolina-dark' : 'bg-gray-300'}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} /></span>;
}
