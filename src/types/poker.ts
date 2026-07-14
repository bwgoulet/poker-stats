export type SeasonId='fall-2025'|'spring-2026'; export type NightType='10'|'20'|'50'|'one-off'; export type FilterValue<T extends string>=T|'all';
export interface Player{ id:string; displayName:string; aliases:string[] }
export interface PokerNight{ id:string; date:string; title:string; seasonId:SeasonId; nightType:NightType; notes?:string }
export interface PlayerResult{ nightId:string; playerId:string; buyIn:number; cashOut:number; profit:number; placement?:number; sourceName:string }
export interface ValidationIssue{ workbook:string; sheet:string; row:number; message:string; severity:'warning'|'error'; }
