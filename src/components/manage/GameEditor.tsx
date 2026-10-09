'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Plus, Trash2, UserPlus, Wallet } from 'lucide-react';
import type { GameInput, League, ManagedGame, ManagedPlayer } from '@/lib/backend/types';
import { blankResult, initialFields, needsReconciliation, toGameInput, validateFields, type GameFields } from './game-input';
import { NIGHT_TYPES, nightTypeLabel, classifyNightType } from '@/lib/filters/night-types';
import { PortalDialog } from './PortalDialog';

const fieldClass = 'mt-1.5 block w-full rounded-lg border bg-white px-3 py-2.5 text-sm font-normal text-ink focus:border-carolina-dark focus:outline-2 focus:outline-carolina/40 disabled:bg-slate-50';
const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
const types = NIGHT_TYPES.map(value => ({ value, label: nightTypeLabel(value) }));

export function GameEditor({ game, league, players, seasons, busy, onSave, onCancel, onCreatePlayer }: {
  game: ManagedGame | null; league: League; players: ManagedPlayer[]; seasons: string[]; busy: boolean;
  onSave: (input: GameInput) => Promise<boolean>; onCancel: () => void; onCreatePlayer: (name: string) => Promise<string | null>;
}) {
  const router = useRouter();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: league.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const month = Number(today.slice(5, 7));
  const defaultSeason = `${month <= 5 ? 'spring' : month <= 7 ? 'summer' : 'fall'}-${today.slice(0, 4)}`;
  const [fields, setFields] = useState<GameFields>(() => initialFields(game, defaultSeason, today));
  const original = useRef(JSON.stringify(fields));
  const [attempted, setAttempted] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [createPlayerOpen, setCreatePlayerOpen] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [playerError, setPlayerError] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const lastRow = useRef<HTMLDivElement>(null);
  const pendingNavigation = useRef<(() => void) | null>(null);
  const allowLeave = useRef(false);
  const validation = useMemo(() => validateFields(fields, players), [fields, players]);
  const canComplete = validation.draftErrors.length === 0 && validation.completionErrors.length === 0;
  const isDirty = JSON.stringify(fields) !== original.current;
  const historicalWarning = game && needsReconciliation(game);
  const playerNames = new Map(players.map(player => [player.id, player.displayName]));

  useEffect(() => { heading.current?.focus(); heading.current?.scrollIntoView({ block: 'start', behavior: 'instant' }); }, []);
  useEffect(() => {
    if (!isDirty) return;
    const protect = (event: BeforeUnloadEvent) => { if (!allowLeave.current) { event.preventDefault(); event.returnValue = ''; } };
    const protectLink = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest('a') : null;
      if (!anchor?.href || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      const next = new URL(anchor.href);
      if (next.origin === location.origin && next.pathname === location.pathname && next.search === location.search) return;
      event.preventDefault(); event.stopPropagation();
      pendingNavigation.current = () => next.origin === location.origin ? router.push(`${next.pathname}${next.search}${next.hash}`) : window.location.assign(next.href);
      setDiscardOpen(true);
    };
    const protectLeague = (event: Event) => {
      const detail = (event as CustomEvent<{ proceed?: () => void }>).detail;
      if (typeof detail?.proceed !== 'function') return;
      event.preventDefault(); pendingNavigation.current = detail.proceed; setDiscardOpen(true);
    };
    window.addEventListener('beforeunload', protect);
    document.addEventListener('click', protectLink, true);
    window.addEventListener('poker-league-switch', protectLeague);
    return () => {
      window.removeEventListener('beforeunload', protect);
      document.removeEventListener('click', protectLink, true);
      window.removeEventListener('poker-league-switch', protectLeague);
    };
  }, [isDirty, router]);

  function update<K extends keyof GameFields>(key: K, value: GameFields[K]) {
    setFields(current => {
      const next = { ...current, [key]: value };
      if (key === 'title' || key === 'nightType') next.nightType = classifyNightType(next.nightType, next.title);
      return next;
    });
  }
  function updateRow(key: string, property: 'playerId' | 'buyIn' | 'cashOut' | 'placement', value: string) {
    setFields(current => ({ ...current, results: current.results.map(row => row.key === key ? { ...row, [property]: value } : row) }));
  }
  function requestCancel() { pendingNavigation.current = null; if (isDirty) setDiscardOpen(true); else onCancel(); }
  function discardChanges() { allowLeave.current = true; const navigate = pendingNavigation.current; onCancel(); navigate?.(); }
  async function save(status: GameInput['status']) {
    setAttempted(true);
    if (validation.draftErrors.length || (status === 'completed' && !canComplete) || busy) return;
    await onSave(toGameInput(fields, status, game));
  }
  async function createPlayer() {
    if (!playerName.trim()) { setPlayerError('Enter a player name.'); return; }
    if (playerName.trim().length > 100) { setPlayerError('Use 100 characters or fewer.'); return; }
    const id = await onCreatePlayer(playerName.trim());
    if (id) {
      setFields(current => ({ ...current, results: [...current.results, { ...blankResult(), playerId: id }] }));
      setPlayerName(''); setPlayerError(''); setCreatePlayerOpen(false);
    }
  }
  function addRow() {
    setFields(current => ({ ...current, results: [...current.results, blankResult()] }));
    requestAnimationFrame(() => lastRow.current?.querySelector('select')?.focus());
  }

  return <section className="card overflow-hidden" aria-labelledby="game-editor-title">
    <div className="border-b bg-carolina-light/50 px-5 py-5 sm:px-6">
      <button type="button" onClick={requestCancel} disabled={busy} className="mb-4 inline-flex items-center gap-2 rounded text-sm font-semibold text-carolina-dark hover:text-navy disabled:opacity-50"><ArrowLeft size={16} /> Back to records</button>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-carolina-dark">{league.name}</p><h2 ref={heading} tabIndex={-1} id="game-editor-title" className="mt-1 text-2xl font-black tracking-tight text-navy focus:outline-none">{game ? 'Edit game' : 'Record a game'}</h2></div>
        <span className="rounded-full border bg-white px-3 py-1 text-xs font-semibold text-slate-600">{game ? `Version ${game.version} · ${game.status === 'completed' ? 'Completed' : 'Draft'}` : 'New game'}</span>
      </div>
    </div>
    <form className="space-y-6 p-5 sm:p-6" onSubmit={event => event.preventDefault()}>
      {historicalWarning && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong className="block">Buy-in/cash-out mismatch.</strong><p className="mt-1">Recorded buy-ins and cash-outs differ. Historical live-game counting differences can remain as recorded. You can complete or save this game with differing totals.</p></div>}
      <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <legend className="sr-only">Game details</legend>
        <label className="text-sm font-semibold sm:col-span-2">Game title <span className="text-slate-400">*</span><input required autoComplete="off" maxLength={120} className={fieldClass} value={fields.title} onChange={event => update('title', event.target.value)} placeholder="Friday at the house" /></label>
        <label className="text-sm font-semibold">Date <span className="text-slate-400">*</span><input required type="date" min="1900-01-01" max="2100-12-31" className={fieldClass} value={fields.date} onChange={event => update('date', event.target.value)} /><span className="mt-1 block text-xs font-normal text-slate-500">{league.timezone.replaceAll('_', ' ')}</span></label>
        <label className="text-sm font-semibold">Season <span className="text-slate-400">*</span><input required list="manage-seasons" maxLength={80} className={fieldClass} value={fields.seasonId} onChange={event => update('seasonId', event.target.value)} placeholder="fall-2026" /><datalist id="manage-seasons">{seasons.map(season => <option key={season} value={season} />)}</datalist><span className="mt-1 block text-xs font-normal text-slate-500">For example, fall-2026 or spring-2027.</span></label>
        <label className="text-sm font-semibold">Night type<select className={fieldClass} value={fields.nightType} onChange={event => update('nightType', event.target.value as GameFields['nightType'])}>{types.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
        <label className="text-sm font-semibold">Game format<select className={fieldClass} value={fields.format} onChange={event => update('format', event.target.value as GameFields['format'])}><option value="cash">Cash game</option><option value="tournament">Tournament</option></select></label>
        <label className="text-sm font-semibold sm:col-span-2 lg:col-span-3">Notes <span className="font-normal text-slate-500">(optional)</span><textarea rows={2} maxLength={2000} className={fieldClass} value={fields.notes} onChange={event => update('notes', event.target.value)} placeholder="Location, stakes, or anything worth remembering" /></label>
      </fieldset>

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-base font-bold text-navy">Player results</h3><p className="mt-1 text-xs text-slate-500">Include all buy-ins and rebuys. Leave cash-out blank while a game is in progress.</p></div><span className="rounded-full bg-carolina-light px-3 py-1 text-xs font-semibold text-navy">{fields.results.length} {fields.results.length === 1 ? 'player' : 'players'}</span></div>
        {!fields.results.length && <div className="rounded-xl border border-dashed bg-slate-50/60 px-5 py-7 text-center"><Wallet size={24} className="mx-auto mb-2 text-carolina-dark" /><p className="text-sm font-semibold text-navy">Start with the players at the table</p><p className="mt-1 text-xs text-slate-500">You can save a draft and finish payouts later.</p></div>}
        <fieldset disabled={busy} className="space-y-2"><legend className="sr-only">Player results in US dollars</legend>
          {fields.results.map((row, index) => <div ref={index === fields.results.length - 1 ? lastRow : undefined} key={row.key} className="grid grid-cols-2 gap-3 rounded-xl border bg-slate-50/50 p-3 sm:flex sm:items-end">
            <label className="col-span-2 min-w-0 text-xs font-semibold sm:flex-1">Player {index + 1}<select aria-label={`Player ${index + 1}`} className={fieldClass} value={row.playerId} onChange={event => updateRow(row.key, 'playerId', event.target.value)}><option value="">Select a player</option>{players.map(player => <option key={player.id} value={player.id} disabled={fields.results.some(other => other.key !== row.key && other.playerId === player.id)}>{player.displayName}</option>)}</select></label>
            <label className="min-w-0 text-xs font-semibold sm:w-28">Buy-in ($)<input aria-label={`Buy-in for ${playerNames.get(row.playerId) ?? `player ${index + 1}`} (US dollars)`} className={fieldClass} inputMode="decimal" autoComplete="off" value={row.buyIn} onChange={event => updateRow(row.key, 'buyIn', event.target.value)} placeholder="0.00" /></label>
            <label className="min-w-0 text-xs font-semibold sm:w-28">Cash-out ($)<input aria-label={`Cash-out for ${playerNames.get(row.playerId) ?? `player ${index + 1}`} (US dollars)`} className={fieldClass} inputMode="decimal" autoComplete="off" value={row.cashOut} onChange={event => updateRow(row.key, 'cashOut', event.target.value)} placeholder="Pending" /></label>
            {fields.format === 'tournament' && <label className="min-w-0 text-xs font-semibold sm:w-20">Place<input aria-label={`Placement for ${playerNames.get(row.playerId) ?? `player ${index + 1}`}`} className={fieldClass} inputMode="numeric" value={row.placement} onChange={event => updateRow(row.key, 'placement', event.target.value)} placeholder="1" /></label>}
            <button type="button" onClick={() => update('results', fields.results.filter(other => other.key !== row.key))} aria-label={`Remove ${playerNames.get(row.playerId) ?? `player row ${index + 1}`}`} className="flex h-10 items-center justify-center gap-2 self-end rounded-lg border bg-white px-3 text-sm text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-700 sm:w-10 sm:px-0"><Trash2 size={16} /><span className="sm:hidden">Remove</span></button>
          </div>)}
        </fieldset>
        <div className="mt-3 flex flex-wrap gap-3"><button type="button" onClick={addRow} disabled={busy || !players.length || fields.results.length >= players.length || fields.results.length >= 500} className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-navy hover:bg-carolina-light disabled:opacity-50"><Plus size={16} /> Add player row</button><button type="button" disabled={busy || fields.results.length >= 500} onClick={() => setCreatePlayerOpen(current => !current)} aria-expanded={createPlayerOpen} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-carolina-dark hover:bg-carolina-light disabled:opacity-50"><UserPlus size={16} /> Create a player</button></div>
        {createPlayerOpen && <div className="mt-3 rounded-xl border bg-carolina-light/40 p-4"><label className="block text-sm font-semibold">New player name<input maxLength={100} autoComplete="off" disabled={busy} className={fieldClass} value={playerName} onChange={event => { setPlayerName(event.target.value); setPlayerError(''); }} placeholder="Full name or nickname" /></label><p className="mt-2 text-xs text-slate-500">Creates a player in {league.name} and adds them to this game.</p>{playerError && <p role="alert" className="mt-2 text-sm text-red-700">{playerError}</p>}<button type="button" onClick={createPlayer} disabled={busy} className="mt-3 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Working…' : 'Create and add'}</button></div>}
      </div>

      <div className="rounded-xl border bg-carolina-light/35 p-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3"><div><p className="text-xs text-slate-500">Total buy-ins</p><p className="mt-1 text-xl font-bold tabular-nums text-navy">{money(validation.buyInCents)}</p></div><div><p className="text-xs text-slate-500">Total cash-outs</p><p className="mt-1 text-xl font-bold tabular-nums text-navy">{money(validation.cashOutCents)}</p></div><div className="col-span-2 sm:col-span-1"><p className="text-xs text-slate-500">Balance (buy-ins − cash-outs)</p><p className={`mt-1 text-xl font-bold tabular-nums ${validation.buyInCents === validation.cashOutCents && !validation.missingCashOuts ? 'text-emerald-700' : 'text-amber-700'}`}>{money(validation.buyInCents - validation.cashOutCents)}</p></div></div>
        {validation.buyInCents !== validation.cashOutCents && !validation.missingCashOuts && <p className="mt-3 text-xs text-amber-700">Buy-ins and cash-outs differ. You can still complete this game.</p>}
        <div className="mt-4 border-t pt-3 text-sm" aria-live="polite">{canComplete ? <p className="flex items-center gap-2 font-semibold text-emerald-700"><CheckCircle2 size={16} /> Ready to complete.</p> : <div><p className="font-semibold text-navy">Before completing this game</p><ul className="mt-1 list-inside list-disc text-xs leading-6 text-slate-600">{validation.draftErrors.length > 0 && <li>Add valid game details and player results.</li>}{validation.completionErrors.map(message => <li key={message}>{message}</li>)}</ul></div>}</div>
      </div>
      {attempted && validation.draftErrors.length > 0 && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p className="font-semibold">Check these details before saving:</p><ul className="mt-2 list-inside list-disc space-y-1">{validation.draftErrors.map(message => <li key={message}>{message}</li>)}</ul></div>}
      <div className="flex flex-col gap-4 border-t pt-5 sm:flex-row sm:items-center sm:justify-between"><p className="max-w-sm text-xs leading-5 text-slate-500">Draft games stay out of standings. Complete a game once every player has a payout. Buy-in and cash-out totals may differ.</p><div className="flex flex-wrap items-center gap-2"><button type="button" onClick={requestCancel} disabled={busy} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50">Cancel</button><button type="button" onClick={() => save('draft')} disabled={busy} className="rounded-lg border px-4 py-2.5 text-sm font-semibold text-navy hover:bg-carolina-light disabled:opacity-50">{game?.status === 'completed' ? 'Move to draft' : 'Save draft'}</button><button type="button" onClick={() => save('completed')} disabled={busy || !canComplete} className="inline-flex items-center gap-2 rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy/90 disabled:opacity-40"><CheckCircle2 size={16} />{busy ? 'Working…' : game?.status === 'completed' ? 'Save completed game' : 'Complete game'}</button></div></div>
    </form>
    {discardOpen && <PortalDialog title="Discard unsaved changes?" busy={busy} onClose={() => setDiscardOpen(false)}><p className="text-sm leading-6 text-slate-600">Your game changes have not been saved. Any players you created will still be available in the league.</p><div className="mt-6 flex justify-end gap-3"><button autoFocus data-dialog-focus type="button" disabled={busy} onClick={() => setDiscardOpen(false)} className="rounded-lg border px-4 py-2.5 text-sm font-semibold disabled:opacity-50">Keep editing</button><button type="button" disabled={busy} onClick={discardChanges} className="rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Discard changes</button></div></PortalDialog>}
  </section>;
}
