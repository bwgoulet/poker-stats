import type { Metadata } from 'next';
import { unstable_rethrow } from 'next/navigation';

import { AppShell } from '@/components/layout/AppShell';
import { getPokerData } from '@/lib/data/poker-repository';
import { getPortalData } from '@/lib/backend/repository';
import { getCurrentSeasonId, getDataSeasonIds } from '@/lib/filters/filter-data';

import './globals.css';

export const metadata: Metadata = {
  title: 'Poker Tracker',
  description: 'Poker league statistics',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const shell = await Promise.all([getPokerData(), getPortalData()])
    .then(([data, portal]) => ({
      seasonIds: getDataSeasonIds(data.nights),
      currentSeason: getCurrentSeasonId(data.nights),
      leagueName: data.league.name,
      portal: { configured: portal.configured, leagues: portal.leagues, selectedLeagueId: portal.selectedLeagueId, user: portal.user },
      backendUnavailable: false,
    }))
    .catch((error: unknown) => {
      unstable_rethrow(error);
      // Keep sign-in reachable when league records cannot be loaded.
      return {
        seasonIds: [], currentSeason: undefined, leagueName: 'Poker Tracker',
        portal: { configured: true, leagues: [], selectedLeagueId: null, user: null },
        backendUnavailable: true,
      };
    });
  return (
    <html lang="en">
      <body>
        <AppShell {...shell}>{children}</AppShell>
      </body>
    </html>
  );
}
