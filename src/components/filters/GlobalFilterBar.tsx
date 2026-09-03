'use client';

import { useEffect, useState } from 'react';
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
const defaultMinNights = 1;

function seasonLabel(season: string) {
  const [name, ...rest] = season.split('-');
  const year = rest.at(-1);
  return `${name.charAt(0).toUpperCase()}${name.slice(1)}${year ? ` ’${year.slice(-2)}` : ''}`;
}

function sameValues(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((value) => right.includes(value));
}

export function GlobalFilterBar({ seasonIds }: { seasonIds: string[] }) {
  const seasons = seasonIds.map((value) => [value, seasonLabel(value)] as const);
  const sp = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const search = sp.toString();

  function selected(
    key: string,
    all: readonly (readonly [string, string])[],
    defaults = all.map(([value]) => value),
  ) {
    const values = sp.getAll(key).flatMap((value) => value.split(',')).filter(Boolean);
    return values.length ? values : defaults;
  }

  function selectedMinNights() {
    const requested = Number(sp.get('minNights'));
    return (minNightsOptions as readonly number[]).includes(requested)
      ? requested
      : defaultMinNights;
  }

  const appliedSeasons = selected('season', seasons);
  const appliedNightTypes = selected('nightType', nightTypes, defaultNightTypes);
  const appliedMinNights = selectedMinNights();
  const [draftSeasons, setDraftSeasons] = useState(appliedSeasons);
  const [draftNightTypes, setDraftNightTypes] = useState(appliedNightTypes);
  const [draftMinNights, setDraftMinNights] = useState(appliedMinNights);

  useEffect(() => {
    setDraftSeasons(appliedSeasons);
    setDraftNightTypes(appliedNightTypes);
    setDraftMinNights(appliedMinNights);
    // The serialized query is the source of truth after navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function toggleValue(value: string, values: string[], setValues: (values: string[]) => void) {
    setValues(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  }

  const currentSeasonSelected =
    draftSeasons.length === 1 &&
    draftSeasons[0] === currentSeason &&
    sameValues(draftNightTypes, currentSeasonNightTypes);
  const allSelected =
    sameValues(draftSeasons, seasonIds) &&
    sameValues(draftNightTypes, nightTypes.map(([value]) => value));
  const isDirty =
    !sameValues(draftSeasons, appliedSeasons) ||
    !sameValues(draftNightTypes, appliedNightTypes) ||
    draftMinNights !== appliedMinNights;

  function toggleAll() {
    if (allSelected) {
      setDraftSeasons(seasonIds);
      setDraftNightTypes(defaultNightTypes.slice());
    } else {
      setDraftSeasons(seasonIds);
      setDraftNightTypes(nightTypes.map(([value]) => value));
    }
  }

  function toggleCurrentSeason() {
    if (currentSeasonSelected) {
      setDraftSeasons(seasonIds);
      setDraftNightTypes(defaultNightTypes.slice());
    } else {
      setDraftSeasons([currentSeason]);
      setDraftNightTypes(currentSeasonNightTypes.slice());
    }
  }

  function updateScope() {
    if (!isDirty) return;
    const params = new URLSearchParams(sp);
    params.delete('season');
    params.delete('nightType');
    params.delete('minNights');

    if (!sameValues(draftSeasons, seasonIds)) {
      draftSeasons.forEach((value) => params.append('season', value));
    }
    if (!sameValues(draftNightTypes, defaultNightTypes)) {
      draftNightTypes.forEach((value) => params.append('nightType', value));
    }
    if (draftMinNights !== defaultMinNights) {
      params.set('minNights', String(draftMinNights));
    }

    const query = params.toString();
    window.dispatchEvent(new Event(navigationStartEvent));
    router.push(query ? `${path}?${query}` : path);
  }

  return (
    <section className="card overflow-hidden" aria-labelledby="scope-heading">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-carolina-light/50 px-4 py-3">
        <h2 className="text-xs font-black uppercase tracking-[.16em] text-navy" id="scope-heading">Scope</h2>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" role="switch" aria-checked={allSelected} onClick={toggleAll} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold">
            All
            <Toggle checked={allSelected} />
          </button>
          <button type="button" role="switch" aria-checked={currentSeasonSelected} onClick={toggleCurrentSeason} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold">
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
                <input type="checkbox" checked={draftSeasons.includes(value)} onChange={() => toggleValue(value, draftSeasons, setDraftSeasons)} />
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
                <input type="checkbox" checked={draftNightTypes.includes(value)} onChange={() => toggleValue(value, draftNightTypes, setDraftNightTypes)} />
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
                <input type="radio" name="min-nights" checked={draftMinNights === value} onChange={() => setDraftMinNights(value)} />
                {value}
              </label>
            ))}
          </fieldset>
        </div>
      </div>
      <div className="flex items-center justify-end border-t bg-gray-50/70 px-4 py-3">
        <button
          type="button"
          disabled={!isDirty}
          onClick={updateScope}
          className="rounded-lg bg-carolina-dark px-5 py-2.5 text-sm font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 disabled:shadow-none"
        >
          Update Scope
        </button>
      </div>
    </section>
  );
}

function Toggle({ checked }: { checked: boolean }) {
  return <span aria-hidden="true" className={`relative h-6 w-11 rounded-full transition-colors ${checked ? 'bg-carolina-dark' : 'bg-gray-300'}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} /></span>;
}
