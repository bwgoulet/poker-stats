import type { NightType } from '@/types/poker';

export type LeagueRole = 'owner' | 'admin' | 'scorekeeper' | 'viewer';
export interface League {
  id: string;
  slug: string;
  name: string;
  currency: 'USD';
  timezone: string;
  visibility: 'public' | 'private';
  role: LeagueRole | null;
}
export interface ManagedPlayer {
  id: string;
  displayName: string;
  aliases: string[];
}
export interface ManagedResult {
  playerId: string;
  buyInCents: number;
  cashOutCents: number | null;
  placement: number | null;
  legacyProfitCents?: number | null;
}
export interface ManagedGame {
  id: string;
  leagueId: string;
  title: string;
  date: string;
  seasonId: string;
  nightType: NightType;
  format: 'cash' | 'tournament';
  status: 'draft' | 'completed';
  notes: string;
  version: number;
  results: ManagedResult[];
  sourceRef: string | null;
}
export interface GameInput {
  id?: string;
  expectedVersion?: number;
  title: string;
  date: string;
  seasonId: string;
  nightType: NightType;
  format: 'cash' | 'tournament';
  status: 'draft' | 'completed';
  notes: string;
  results: Omit<ManagedResult, 'legacyProfitCents'>[];
}
export interface PortalData {
  configured: boolean;
  user: { id: string; email: string | null } | null;
  leagues: League[];
  selectedLeagueId: string | null;
  players: ManagedPlayer[];
  games: ManagedGame[];
}
export const UNC_LEAGUE_ID = '00000000-0000-4000-8000-000000000001';
export const canEdit = (role: LeagueRole | null) => role === 'owner' || role === 'admin' || role === 'scorekeeper';
export const canAdmin = (role: LeagueRole | null) => role === 'owner' || role === 'admin';
