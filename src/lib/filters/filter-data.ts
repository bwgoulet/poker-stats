import { NightType, PokerNight, SeasonId, PlayerResult } from '@/types/poker';

type FilterParam = string | string[] | undefined;
export type MultiFilterValue<T extends string> = T[];
export interface GlobalFilters{season:MultiFilterValue<SeasonId>; nightType:MultiFilterValue<NightType>}

const SEASONS:SeasonId[]=['fall-2025','spring-2026'];
const NIGHT_TYPES:NightType[]=['10','20','50','one-off'];

function parseMulti<T extends string>(value:FilterParam, allowed:readonly T[]):T[]{
  const raw=(Array.isArray(value)?value:[value]).flatMap(v=>String(v??'').split(','));
  const selected=raw.filter((v):v is T=>(allowed as readonly string[]).includes(v));
  return selected.length?Array.from(new Set(selected)):Array.from(allowed);
}

function isAllSelected<T extends string>(selected:readonly T[], allowed:readonly T[]){return selected.length===allowed.length&&allowed.every(v=>selected.includes(v));}

export function parseFilters(sp:Record<string,FilterParam>):GlobalFilters{return {season:parseMulti(sp.season,SEASONS), nightType:parseMulti(sp.nightType,NIGHT_TYPES)};}
export function filterNights(nights:PokerNight[], f:GlobalFilters){return nights.filter(n=>f.season.includes(n.seasonId)&&f.nightType.includes(n.nightType));}
export function filterResults(results:PlayerResult[], nights:PokerNight[], f:GlobalFilters){const ids=new Set(filterNights(nights,f).map(n=>n.id)); return results.filter(r=>ids.has(r.nightId));}
export function scopeLabel(f:GlobalFilters){const s=isAllSelected(f.season,SEASONS)?'All-time':f.season.map(v=>v==='fall-2025'?'Fall ’25':'Spring ’26').join(' + '); const n=isAllSelected(f.nightType,NIGHT_TYPES)?'All night types':f.nightType.map(v=>v==='one-off'?'One-offs':`$${v} nights`).join(' + '); return `${s} · ${n}`;}
