import type { GameInput, ManagedGame, ManagedPlayer } from '@/lib/backend/types';

export interface ResultFields {
  key: string;
  playerId: string;
  buyIn: string;
  cashOut: string;
  placement: string;
}

export interface GameFields {
  title: string;
  date: string;
  seasonId: string;
  nightType: GameInput['nightType'];
  format: GameInput['format'];
  notes: string;
  results: ResultFields[];
}

/** Parse decimal dollars without floating point rounding or silently dropping cents. */
export function moneyToCents(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed)) return null;
  const [whole, decimal = ''] = trimmed.split('.');
  const cents = Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents <= 100_000_000 ? cents : null;
}

export function centsToInput(value: number | null): string {
  return value === null ? '' : (value / 100).toFixed(2);
}

export function blankResult(): ResultFields {
  return { key: crypto.randomUUID(), playerId: '', buyIn: '', cashOut: '', placement: '' };
}

export function initialFields(game: ManagedGame | null, defaultSeason: string, today: string): GameFields {
  return {
    title: game?.title ?? '', date: game?.date ?? today, seasonId: game?.seasonId ?? defaultSeason,
    nightType: game?.nightType ?? '10', format: game?.format ?? 'cash', notes: game?.notes ?? '',
    results: game?.results.map((row, index) => ({ key: `${row.playerId}-${index}`, playerId: row.playerId,
      buyIn: centsToInput(row.buyInCents), cashOut: centsToInput(row.cashOutCents),
      placement: row.placement === null ? '' : String(row.placement),
    })) ?? [],
  };
}

export function validateFields(fields: GameFields, players: ManagedPlayer[]) {
  const draftErrors: string[] = [];
  const completionErrors: string[] = [];
  if (!fields.title.trim()) draftErrors.push('Enter a game title.');
  const parsedDate = new Date(`${fields.date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fields.date) || !Number.isFinite(+parsedDate) || parsedDate.toISOString().slice(0, 10) !== fields.date || fields.date < '1900-01-01' || fields.date > '2100-12-31') draftErrors.push('Choose a valid game date between 1900 and 2100.');
  if (!/^[a-z][a-z0-9-]*-\d{4}$/.test(fields.seasonId.trim())) draftErrors.push('Use a season such as fall-2026 or spring-2027.');
  if (fields.title.trim().length > 120) draftErrors.push('Keep the title to 120 characters or fewer.');
  if (fields.seasonId.trim().length > 80) draftErrors.push('Keep the season to 80 characters or fewer.');
  if (fields.notes.length > 2000) draftErrors.push('Keep notes to 2,000 characters or fewer.');
  if (fields.results.length > 500) draftErrors.push('A game can include at most 500 players.');
  const knownPlayers = new Set(players.map(player => player.id));
  const usedPlayers = new Set<string>();
  const placements = new Set<number>();
  let buyInCents = 0;
  let cashOutCents = 0;
  let missingCashOuts = 0;
  fields.results.forEach((row, index) => {
    const label = `Player row ${index + 1}`;
    if (!knownPlayers.has(row.playerId)) draftErrors.push(`${label}: choose a player.`);
    else if (usedPlayers.has(row.playerId)) draftErrors.push(`${label}: this player is already entered.`);
    usedPlayers.add(row.playerId);
    const buyIn = moneyToCents(row.buyIn);
    const cashOut = row.cashOut.trim() === '' ? null : moneyToCents(row.cashOut);
    if (buyIn === null) draftErrors.push(`${label}: enter a buy-in with up to two decimal places.`);
    else buyInCents += buyIn;
    if (row.cashOut.trim() && cashOut === null) draftErrors.push(`${label}: enter a cash-out with up to two decimal places.`);
    if (cashOut === null) missingCashOuts++;
    else cashOutCents += cashOut;
    if (fields.format === 'tournament' && row.placement.trim()) {
      const placement = Number(row.placement);
      if (!/^\d+$/.test(row.placement) || !Number.isSafeInteger(placement) || placement < 1 || placement > 500) draftErrors.push(`${label}: placement must be between 1 and 500.`);
      else if (placements.has(placement)) draftErrors.push(`${label}: this placement is already entered.`);
      else if (placement > fields.results.length) completionErrors.push(`${label}: completed placements must run from 1 through ${fields.results.length}.`);
      placements.add(placement);
    } else if (fields.format === 'tournament') completionErrors.push(`${label}: enter a finishing position.`);
  });
  if (fields.results.length < 2) completionErrors.push('Add at least two players before completing this game.');
  if (!buyInCents) completionErrors.push('Enter a positive total buy-in before completing this game.');
  if (missingCashOuts) completionErrors.push(`Enter cash-outs for ${missingCashOuts} ${missingCashOuts === 1 ? 'player' : 'players'} (use 0 for no payout).`);
  return { draftErrors, completionErrors, buyInCents, cashOutCents, missingCashOuts };
}

export function toGameInput(fields: GameFields, status: GameInput['status'], game: ManagedGame | null): GameInput {
  return {
    ...(game ? { id: game.id, expectedVersion: game.version } : {}),
    title: fields.title.trim(), date: fields.date, seasonId: fields.seasonId.trim(), nightType: fields.nightType,
    format: fields.format, status, notes: fields.notes.trim(),
    results: fields.results.map(row => ({ playerId: row.playerId,
      buyInCents: moneyToCents(row.buyIn)!, cashOutCents: row.cashOut.trim() === '' ? null : moneyToCents(row.cashOut),
      placement: fields.format === 'tournament' && row.placement.trim() ? Number(row.placement) : null,
    })),
  };
}

export function gameCashTotals(game: ManagedGame) {
  const totalIn = game.results.reduce((sum, row) => sum + row.buyInCents, 0);
  const totalOut = game.results.reduce((sum, row) => sum + (row.cashOutCents ?? 0), 0);
  const pendingPayouts = game.results.filter(row => row.cashOutCents === null).length;
  return { totalIn, totalOut, pendingPayouts, difference: pendingPayouts ? null : totalOut - totalIn };
}

export function needsReconciliation(game: ManagedGame): boolean {
  const totals = gameCashTotals(game);
  return game.status === 'completed' && (totals.pendingPayouts > 0 || totals.difference !== 0);
}
