import type { GlobalFilters } from './filter-data';

export type SearchParams = Record<string, string | string[] | undefined>;
export const SCOPE_KEYS = ['season', 'nightType', 'minNights'] as const;

/** Preserve repeated selections rather than coercing arrays to comma-separated strings. */
export function toSearchParams(values: SearchParams) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
      params.append(key, item);
    }
  }
  return params;
}

export function scopeQuery(params: URLSearchParams) {
  const scope = new URLSearchParams();
  for (const key of SCOPE_KEYS) {
    for (const value of params.getAll(key)) scope.append(key, value);
  }
  return scope;
}

export function scopeCookieName(leagueId?: string) {
  return `poker-scope-${encodeURIComponent(leagueId || 'default')}`;
}

export function withScope(params: URLSearchParams, filters: GlobalFilters, seasonIds: readonly string[]) {
  const next = new URLSearchParams(params);
  SCOPE_KEYS.forEach(key => next.delete(key));
  // Explicit defaults allow returning to the default scope to replace a saved selection.
  const allSeasons = seasonIds.length === filters.season.length && seasonIds.every(id => filters.season.includes(id));
  if (allSeasons) next.set('season', 'all');
  else filters.season.forEach(value => next.append('season', value));
  filters.nightType.forEach(value => next.append('nightType', value));
  next.set('minNights', String(filters.minNights));
  next.delete('page');
  return next;
}

export function isAnalyticsPath(pathname: string) {
  return /^\/(dashboard|games|players|stats|compare)(\/|$)/.test(pathname);
}
