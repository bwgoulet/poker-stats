export const NIGHT_TYPES = ['10', '20', '50', 'online', 'one-off', 'one-off-10', 'one-off-20'] as const;
export type NightType = typeof NIGHT_TYPES[number];
// Keep legacy `one-off` URLs as a selection of every one-off category.
export type ScopeNightType = NightType | 'one-off-other';
export const ONE_OFF_SCOPE_TYPES: ScopeNightType[] = ['one-off-10', 'one-off-20', 'one-off-other'];
export const NIGHT_TYPE_OPTIONS = [
  ['10', '$10 nights'], ['20', '$20 nights'], ['50', '$50 nights'],
  ['one-off-10', '$10 one-offs'], ['one-off-20', '$20 one-offs'],
  ['one-off-other', 'Other one-offs'], ['online', 'Online'],
] as const satisfies readonly (readonly [ScopeNightType, string])[];
export const DEFAULT_NIGHT_TYPES: ScopeNightType[] = ['10', '20'];

export function nominalNightBuyIn(type: NightType) {
  if (type === '10' || type === 'one-off-10') return 10;
  if (type === '20' || type === 'one-off-20') return 20;
  if (type === '50') return 50;
  return null;
}

export function cashGameBigBlind(night: { nightType: NightType; format?: 'cash' | 'tournament' }) {
  if (night.format === 'tournament') return null;
  if (night.nightType === '10' || night.nightType === 'one-off-10') return 0.1;
  if (night.nightType === '20' || night.nightType === 'one-off-20') return 0.2;
  return null;
}

export function isOneOff(type: string) {
  return type === 'one-off' || type === 'one-off-10' || type === 'one-off-20';
}

/** Use an explicit one-off title stake, otherwise retain the recorded nominal stake. */
export function classifyNightType(type: NightType, title: string): NightType {
  if (!/\bone[\s‐‑–—-]*offs?\b/i.test(title)) return type;
  if (type === '10' || type === '20' || isOneOff(type)) {
    const ten = /\$10\b/.test(title);
    const twenty = /\$20\b/.test(title);
    if (ten && !twenty) return 'one-off-10';
    if (twenty && !ten) return 'one-off-20';
  }
  if (type === '10') return 'one-off-10';
  if (type === '20') return 'one-off-20';
  return type;
}

export function nightTypeLabel(type: NightType | ScopeNightType) {
  if (type === 'one-off' || type === 'one-off-other') return 'Other one-offs';
  return NIGHT_TYPE_OPTIONS.find(([value]) => value === type)?.[1] ?? type;
}
