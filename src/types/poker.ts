export type { NightType } from '@/lib/filters/night-types';
import type { NightType } from '@/lib/filters/night-types';
export type SeasonId=string; export type FilterValue<T extends string>=T|'all';
export interface Player{ id:string; displayName:string; aliases:string[] }
export interface PokerNight{ id:string; date:string; title:string; seasonId:SeasonId; nightType:NightType; format?:'cash'|'tournament'; notes?:string }
export interface PlayerResult{ nightId:string; playerId:string; buyIn:number; cashOut:number; profit:number; placement?:number; sourceName:string }
export interface ValidationIssue{ workbook:string; sheet:string; row:number; message:string; severity:'warning'|'error'; }
