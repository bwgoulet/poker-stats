import { PlayersTable } from '@/components/players/PlayersTable';
import { getPokerData } from '@/lib/data/poker-repository';
import { parseFilters, filterNights, filterResults, scopeLabel } from '@/lib/filters/filter-data';
import { playerStats } from '@/lib/stats/statistics';

export default async function Players({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const filters = parseFilters(params);
  const data = getPokerData();
  const rows = playerStats(data.players, filterNights(data.nights, filters), filterResults(data.results, data.nights, filters)).filter(
    (row) => row.nightsPlayed > 0,
  );

  return <><header><p className="text-red-600 font-semibold">{scopeLabel(filters)}</p><h1 className="text-4xl font-black">Players</h1></header><PlayersTable rows={rows} query={new URLSearchParams(params as Record<string, string>).toString()} /></>;
}
