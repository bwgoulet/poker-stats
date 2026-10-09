import { PlayersTable } from '@/components/players/PlayersTable';
import { getPokerData } from '@/lib/data/poker-repository';
import { getDataSeasonIds, parseFilters, filterNights, filterResults, scopeLabel } from '@/lib/filters/filter-data';
import { playerStats } from '@/lib/stats/statistics';
import { classifyPlayers } from '@/lib/stats/player-classification';

export default async function Players({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const data = await getPokerData();
  const seasonIds = getDataSeasonIds(data.nights);
  const filters = parseFilters(params, seasonIds);
  const nights = filterNights(data.nights, filters);
  const stats = playerStats(data.players, nights, filterResults(data.results, data.nights, filters));
  const classifications = classifyPlayers(stats, nights);
  const rows = stats.filter(
    (row) => row.nightsPlayed >= filters.minNights,
  ).map((row) => ({ ...row, classification: classifications.get(row.player.id)! }));

  return <><header><p className="text-carolina-dark font-semibold">{scopeLabel(filters, seasonIds)}</p><h1 className="text-4xl font-black">Players</h1></header><PlayersTable rows={rows} query={new URLSearchParams(params as Record<string, string>).toString()} /></>;
}
