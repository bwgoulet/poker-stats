import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { GameRow } from '@/components/manage/ManagementPortal';
import type { ManagedGame } from '@/lib/backend/types';

function render(cashOutCents: number | null, expanded = true, legacyProfitCents: number | null = null) {
  const game: ManagedGame = { id: 'historical', leagueId: 'league', title: 'Historical game', date: '2025-10-03',
    seasonId: 'fall-2025', nightType: 'one-off', format: 'cash', status: 'completed', version: 1,
    sourceRef: 'workbook:v1:fall-2025.xlsx#historical', notes: 'Original source notes',
    results: [{ playerId: 'drew', buyInCents: 5000, cashOutCents, placement: 1, legacyProfitCents }] };
  return renderToStaticMarkup(createElement(GameRow, { game, expanded, names: new Map([['drew', 'Drew']]),
    editable: false, busy: false, onExpand() {}, onEdit() {}, onDelete() {} }));
}

it('shows the cash mismatch, exact totals, direction and retained import information when expanded', () => {
  const html = render(3610);
  expect(html).toContain('Buy-in/cash-out mismatch');
  expect(html).toContain('$50.00');
  expect(html).toContain('$36.10');
  expect(html).toContain('Mismatch: $13.90 — cash-outs fall short of buy-ins.');
  expect(html).toContain('Import source:');
  expect(html).toContain('Original source notes');
  expect(html).not.toContain('needs reconciliation');
  expect(render(6390)).toContain('Mismatch: $13.90 — cash-outs exceed buy-ins.');
});

it('does not label an old Net override as a cash mismatch when amounts balance', () => {
  expect(render(5000, true, 100)).not.toContain('Buy-in/cash-out mismatch');
  expect(render(5000)).toContain('Buy-ins and cash-outs match ($0.00 difference).');
});

it('keeps detail under the expansion and does not claim an exact mismatch for pending payouts', () => {
  expect(render(3610, false)).not.toContain('Total cash-outs');
  const html = render(null);
  expect(html).toContain('mismatch cannot be calculated yet');
  expect(html).not.toContain('Mismatch: $50.00');
});
