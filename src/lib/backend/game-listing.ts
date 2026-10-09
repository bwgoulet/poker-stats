import { filterNights, type GlobalFilters } from '@/lib/filters/filter-data';
import { nightStats } from '@/lib/stats/statistics';
import { portalToPokerData } from './repository';
import type { ManagedGame, PortalData } from './types';

export type GameListingRow = Pick<ManagedGame, 'id' | 'date' | 'title' | 'seasonId' | 'nightType' | 'status'> & {
  players: number;
  totalPot: number;
  winner: string;
};

/** Game history includes drafts; the analytics adapter remains completed-only. */
export function gameListingRows(portal: PortalData, filters: GlobalFilters): GameListingRow[] {
  const data = portalToPokerData(portal);
  const completed = new Map(nightStats(data.nights, data.results).map(row => [row.night.id, row]));
  const names = new Map(portal.players.map(player => [player.id, player.displayName]));
  const visible = new Set(filterNights(portal.games, filters).map(game => game.id));
  return portal.games.filter(game => visible.has(game.id)).map(game => ({
    id: game.id, date: game.date, title: game.title, seasonId: game.seasonId,
    nightType: game.nightType, status: game.status,
    players: game.results.length,
    totalPot: game.results.reduce((sum, row) => sum + row.buyInCents, 0) / 100,
    winner: game.status === 'draft' ? 'Pending' : names.get(completed.get(game.id)?.winner?.playerId ?? '') ?? '—',
  }));
}
