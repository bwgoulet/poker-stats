'use client';

import { usePathname } from 'next/navigation';
import { GlobalFilterBar } from '@/components/filters/GlobalFilterBar';

export function AnalyticsFilters({ seasonIds, currentSeason }: { seasonIds: string[]; currentSeason?: string }) {
  const pathname = usePathname();
  if (pathname.startsWith('/manage') || pathname.startsWith('/auth') || seasonIds.length === 0) return null;
  return <GlobalFilterBar seasonIds={seasonIds} currentSeason={currentSeason} />;
}
