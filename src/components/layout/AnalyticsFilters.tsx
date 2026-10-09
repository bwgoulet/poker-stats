'use client';

import { usePathname } from 'next/navigation';
import { GlobalFilterBar } from '@/components/filters/GlobalFilterBar';

export function AnalyticsFilters({ seasonIds, gameSeasonIds, currentSeason }: { seasonIds: string[]; gameSeasonIds?: string[]; currentSeason?: string }) {
  const pathname = usePathname();
  const seasons = pathname.startsWith('/games') ? gameSeasonIds ?? seasonIds : seasonIds;
  if (pathname.startsWith('/manage') || pathname.startsWith('/auth') || pathname.startsWith('/account') || seasons.length === 0) return null;
  return <GlobalFilterBar seasonIds={seasons} currentSeason={pathname.startsWith('/games') ? seasons[0] : currentSeason} />;
}
