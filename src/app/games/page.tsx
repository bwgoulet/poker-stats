import type { SearchParams } from '@/lib/filters/scope-query';
import { getPokerData } from '@/lib/data/poker-repository';
import { getDataSeasonIds, parseFilters, filterNights, filterResults, scopeLabel } from '@/lib/filters/filter-data';
import { nightStats } from '@/lib/stats/statistics';
import GamesListing from './games-listing';

export default async function Games({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const data = await getPokerData();
  const seasonIds = getDataSeasonIds(data.nights);
  const filters = parseFilters(sp, seasonIds);
  const players = new Map(data.players.map(player => [player.id, player.displayName]));
  const rows = nightStats(filterNights(data.nights, filters), filterResults(data.results, data.nights, filters)).map(row => ({
    id: row.night.id,
    date: row.night.date,
    title: row.night.title,
    seasonId: row.night.seasonId,
    nightType: row.night.nightType,
    players: row.players,
    totalPot: row.totalPot,
    winner: players.get(row.winner?.playerId ?? '') ?? '—',
  }));

  return <>
    <header><p className="text-carolina-dark font-semibold">{scopeLabel(filters, seasonIds)}</p><h1 className="text-4xl font-black">Games</h1></header>
    <GamesListing rows={rows} />
  </>;
}
