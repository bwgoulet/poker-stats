import { NightType, PokerNight, SeasonId, PlayerResult } from '@/types/poker';
import { getSeasonIds } from '@/lib/data/load-workbooks';

type FilterParam = string | string[] | undefined;
export type MultiFilterValue<T extends string> = T[];
export interface GlobalFilters{season:MultiFilterValue<SeasonId>; nightType:MultiFilterValue<NightType>; minNights:number}

const NIGHT_TYPES:NightType[]=['10','20','50','one-off'];
const DEFAULT_NIGHT_TYPES:NightType[]=['10','20'];
export const MIN_NIGHTS_OPTIONS=[1,3,5,10] as const;
export const DEFAULT_MIN_NIGHTS=3;

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

export function parseFilters(sp:Record<string,FilterParam>):GlobalFilters{return {season:parseMulti(sp.season,getSeasonIds()), nightType:parseMulti(sp.nightType,NIGHT_TYPES,DEFAULT_NIGHT_TYPES), minNights:parseMinNights(sp.minNights)};}
export function filterNights(nights:PokerNight[], f:GlobalFilters){return nights.filter(n=>f.season.includes(n.seasonId)&&f.nightType.includes(n.nightType));}
export function filterResults(results:PlayerResult[], nights:PokerNight[], f:GlobalFilters){const ids=new Set(filterNights(nights,f).map(n=>n.id)); return results.filter(r=>ids.has(r.nightId));}
export function seasonLabel(season: SeasonId){const [name,...rest]=season.split('-'); const year=rest.at(-1); return `${name.charAt(0).toUpperCase()}${name.slice(1)}${year ? ` ’${year.slice(-2)}` : ''}`;}
export function scopeLabel(f:GlobalFilters){const seasons=getSeasonIds(); const s=isAllSelected(f.season,seasons)?'All-time':f.season.map(seasonLabel).join(' + '); const n=isAllSelected(f.nightType,NIGHT_TYPES)?'All night types':f.nightType.map(v=>v==='one-off'?'One-offs':`$${v} nights`).join(' + '); return `${s} · ${n} · ${f.minNights}+ nights`;
}
