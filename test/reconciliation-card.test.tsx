import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { ReconciliationCard } from '@/components/dashboard/ReconciliationCard';
import { leagueReconciliation } from '@/lib/stats/statistics';
import type { PokerNight } from '@/types/poker';

it('renders a collapsed list with game links, dates, amounts and both directions', () => {
  const nights: PokerNight[] = ['short', 'extra'].map((id) => ({
    id, date: '2026-01-01', title: `Game ${id}`, seasonId: 'spring-2026', nightType: '20',
  }));
  const reconciliation = leagueReconciliation(nights, nights.map((night, index) => ({
    nightId: night.id, playerId: 'a', buyIn: 50, cashOut: index ? 60 : 45,
    profit: 0, sourceName: 'A',
  })));
  const html = renderToStaticMarkup(createElement(ReconciliationCard, { reconciliation }));
  expect(html).toContain('<details');
  expect(html).not.toContain('<details open');
  expect(html).toContain('View affected games (2)');
  expect(html).toContain('href="/games/short"');
  expect(html).toContain('href="/games/extra"');
  expect(html).toContain('Game short');
  expect(html).toContain('Jan 1, 2026');
  expect(html).toContain('$5.00');
  expect(html).toContain('$10.00');
  expect(html).toContain('Extra bought in</span>');
  expect(html).toContain('Extra bought out</span>');
});

it('shows the balanced state without an empty expandable list', () => {
  const html = renderToStaticMarkup(createElement(ReconciliationCard, {
    reconciliation: leagueReconciliation([], []),
  }));
  expect(html).toContain('All completed games balance.');
  expect(html).not.toContain('<details');
});
