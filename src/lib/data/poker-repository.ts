import { cache } from 'react'; import { normalizeWorkbooks } from './normalize-workbooks';
export const getPokerData=cache(()=>normalizeWorkbooks());
export function getRepository(){const d=getPokerData(); return {getPlayers:()=>d.players,getNights:()=>d.nights,getResults:()=>d.results,getIssues:()=>d.issues};}
