import { FilterValue, NightType, PokerNight, SeasonId, PlayerResult } from '@/types/poker';
export interface GlobalFilters{season:FilterValue<SeasonId>; nightType:FilterValue<NightType>}
export function parseFilters(sp:Record<string,string|string[]|undefined>):GlobalFilters{const s=String(sp.season??'all'), n=String(sp.nightType??'all'); return {season:(['fall-2025','spring-2026'].includes(s)?s:'all') as any, nightType:(['10','20','50','one-off'].includes(n)?n:'all') as any};}
export function filterNights(nights:PokerNight[], f:GlobalFilters){return nights.filter(n=>(f.season==='all'||n.seasonId===f.season)&&(f.nightType==='all'||n.nightType===f.nightType));}
export function filterResults(results:PlayerResult[], nights:PokerNight[], f:GlobalFilters){const ids=new Set(filterNights(nights,f).map(n=>n.id)); return results.filter(r=>ids.has(r.nightId));}
export function scopeLabel(f:GlobalFilters){const s=f.season==='fall-2025'?'Fall ’25':f.season==='spring-2026'?'Spring ’26':'All-time'; const n=f.nightType==='all'?'All night types':f.nightType==='one-off'?'One-offs':`$${f.nightType} nights`; return `${s} · ${n}`;}
