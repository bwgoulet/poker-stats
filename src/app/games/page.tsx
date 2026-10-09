import { getPortalData } from '@/lib/backend/repository';
import { gameListingRows } from '@/lib/backend/game-listing';
import { getDataSeasonIds, parseFilters, scopeLabel } from '@/lib/filters/filter-data';
import GamesListing from './games-listing';

type SearchParams = Record<string, string | string[] | undefined>;

export default async function Games({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const portal = await getPortalData();
  const seasonIds = getDataSeasonIds(portal.games);
  const filters = parseFilters(sp, seasonIds);
  const rows = gameListingRows(portal, filters);

  return <>
    <header><p className="text-carolina-dark font-semibold">{scopeLabel(filters, seasonIds)}</p><h1 className="text-4xl font-black">Games</h1></header>
    <GamesListing rows={rows} />
  </>;
}
