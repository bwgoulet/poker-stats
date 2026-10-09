import { PokerNight, SeasonId, PlayerResult } from '@/types/poker';
import { DEFAULT_NIGHT_TYPES, NIGHT_TYPE_OPTIONS, ONE_OFF_SCOPE_TYPES, classifyNightType, isOneOff, nightTypeLabel, type ScopeNightType } from './night-types';

type FilterParam = string | string[] | undefined;
export type MultiFilterValue<T extends string> = T[];
export interface GlobalFilters{season:MultiFilterValue<SeasonId>; nightType:MultiFilterValue<ScopeNightType>; minNights:number}

const SCOPE_NIGHT_TYPES = NIGHT_TYPE_OPTIONS.map(([value]) => value);
export const MIN_NIGHTS_OPTIONS=[1,3,5,10] as const;
export const DEFAULT_MIN_NIGHTS=1;

function parseMulti<T extends string>(value:FilterParam, allowed:readonly T[], defaults:readonly T[]=allowed):T[]{
  if(value===undefined)return Array.from(defaults);
  const raw=(Array.isArray(value)?value:[value]).flatMap(v=>String(v??'').split(','));
  const selected=raw.filter((v):v is T=>(allowed as readonly string[]).includes(v));
  return selected.length?Array.from(new Set(selected)):Array.from(defaults);
}

function isAllSelected<T extends string>(selected:readonly T[], allowed:readonly T[]){return selected.length===allowed.length&&allowed.every(v=>selected.includes(v));}

function parseMinNights(value:FilterParam){
  const raw=Array.isArray(value)?value[0]:value;
  const parsed=Number(raw);
  return (MIN_NIGHTS_OPTIONS as readonly number[]).includes(parsed)?parsed:DEFAULT_MIN_NIGHTS;
}

/** Use the selected league's actual seasons, including seasons added in the portal. */
export function getDataSeasonIds(nights: readonly PokerNight[]): SeasonId[] {
  const newestDateBySeason = new Map<SeasonId, string>();
  for (const night of nights) {
    const newest = newestDateBySeason.get(night.seasonId);
    if (!newest || night.date > newest) newestDateBySeason.set(night.seasonId, night.date);
  }
  return [...newestDateBySeason].sort(([leftId, leftDate], [rightId, rightDate]) =>
    rightDate.localeCompare(leftDate) || leftId.localeCompare(rightId),
  ).map(([seasonId]) => seasonId);
}

export function getCurrentSeasonId(nights: readonly PokerNight[]): SeasonId | undefined {
  return getDataSeasonIds(nights)[0];
}

export function parseFilters(sp:Record<string,FilterParam>, seasonIds: readonly SeasonId[] = []):GlobalFilters{
  const raw = sp.nightType === undefined ? undefined : (Array.isArray(sp.nightType) ? sp.nightType : [sp.nightType])
    .flatMap(value => value.split(',')).flatMap(value => value === 'one-off' ? ONE_OFF_SCOPE_TYPES : [value]);
  return {season:parseMulti(sp.season,seasonIds), nightType:parseMulti(raw,SCOPE_NIGHT_TYPES,DEFAULT_NIGHT_TYPES), minNights:parseMinNights(sp.minNights)};
}
export function filterNights(nights:PokerNight[], f:GlobalFilters){return nights.map(n=>{
  const nightType = classifyNightType(n.nightType, n.title);
  return nightType === n.nightType ? n : { ...n, nightType };
}).filter(n=>f.season.includes(n.seasonId)&&(f.nightType.includes(n.nightType === 'one-off' ? 'one-off-other' : n.nightType) || (f.nightType.includes('one-off') && isOneOff(n.nightType))));}
export function filterResults(results:PlayerResult[], nights:PokerNight[], f:GlobalFilters){const ids=new Set(filterNights(nights,f).map(n=>n.id)); return results.filter(r=>ids.has(r.nightId));}
export function seasonLabel(season: SeasonId){const [name,...rest]=season.split('-'); const year=rest.at(-1); return `${name.charAt(0).toUpperCase()}${name.slice(1)}${year ? ` ’${year.slice(-2)}` : ''}`;}
export function scopeLabel(f:GlobalFilters, seasons: readonly SeasonId[] = []){const s=isAllSelected(f.season,seasons)?'All-time':f.season.map(seasonLabel).join(' + '); const n=isAllSelected(f.nightType,SCOPE_NIGHT_TYPES)?'All night types':f.nightType.map(type => type === 'one-off' ? 'All one-offs' : nightTypeLabel(type)).join(' + '); return `${s} · ${n} · ${f.minNights}+ nights`;
}
