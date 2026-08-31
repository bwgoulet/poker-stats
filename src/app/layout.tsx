import type { Metadata } from 'next';

import { AppShell } from '@/components/layout/AppShell';
import { getSeasonIds } from '@/lib/data/load-workbooks';

import './globals.css';

export const metadata: Metadata = {
  title: 'Poker Tracker',
  description: 'Poker league statistics',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppShell seasonIds={getSeasonIds()}>{children}</AppShell>
      </body>
    </html>
  );
}
