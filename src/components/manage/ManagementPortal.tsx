'use client';

import { nightTypeLabel } from '@/lib/filters/night-types';
import type { NightType } from '@/types/poker';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, CalendarDays, ChevronDown, ChevronRight, CircleHelp, Edit3, FileClock, Globe2, Layers3, LockKeyhole, Plus, Search, Settings2, ShieldCheck, Trash2, Users } from 'lucide-react';
import { canAdmin, canEdit, type GameInput, type League, type ManagedGame, type PortalData } from '@/lib/backend/types';
import { GameEditor } from './GameEditor';
import { PortalDialog } from './PortalDialog';
import { gameCashTotals, needsReconciliation } from './game-input';

const fieldClass = 'mt-1.5 block w-full rounded-lg border bg-white px-3 py-2.5 text-sm font-normal text-ink focus:border-carolina-dark focus:outline-2 focus:outline-carolina/40';
const primaryClass = 'inline-flex items-center justify-center gap-2 rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy/90 disabled:opacity-40';
const secondaryClass = 'inline-flex items-center justify-center gap-2 rounded-lg border bg-white px-3 py-2.5 text-sm font-semibold text-navy hover:bg-carolina-light disabled:opacity-40';
const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
const dateLabel = (date: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
const nightLabel = (value: NightType) => nightTypeLabel(value);
const pageSize = 20;
type Notice = { text: string; tone: 'success' | 'error' } | null;
type DialogState = { kind: 'league'; league: League | null } | { kind: 'delete'; game: ManagedGame } | { kind: 'players' } | { kind: 'reload'; game: ManagedGame } | null;

async function api<T>(path: string, options?: { method: 'POST' | 'PATCH' | 'DELETE'; body?: unknown }): Promise<T> {
  const response = await fetch(`/api/portal${path}`, options ? { method: options.method, headers: { 'Content-Type': 'application/json' }, body: options.body === undefined ? undefined : JSON.stringify(options.body) } : { cache: 'no-store' });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : 'The request could not be completed. Please try again.');
  return body as T;
}

export function ManagementPortal({ initialData }: { initialData: PortalData }) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [busy, setBusy] = useState<string | null>(null);
  const busyRef = useRef(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [editor, setEditor] = useState<{ game: ManagedGame | null } | null>(null);
  const [editorRevision, setEditorRevision] = useState(0);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [season, setSeason] = useState('all');
  const [page, setPage] = useState(1);
  const [newestFirst, setNewestFirst] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const newGameButton = useRef<HTMLButtonElement>(null);
  const deepLinkHandled = useRef(false);
  const previousLeague = useRef(data.selectedLeagueId);
  const league = data.leagues.find(item => item.id === data.selectedLeagueId) ?? null;
  const editable = data.configured && !!data.user && !!league && canEdit(league.role);
  const admin = data.configured && !!data.user && !!league && canAdmin(league.role);
  const seasons = useMemo(() => [...new Set(data.games.map(game => game.seasonId))].sort().reverse(), [data.games]);
  const players = useMemo(() => [...data.players].sort((a, b) => a.displayName.localeCompare(b.displayName)), [data.players]);
  const playerNames = useMemo(() => new Map(data.players.map(player => [player.id, player.displayName])), [data.players]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.games.filter(game => (!needle || `${game.title} ${game.date} ${game.seasonId} ${nightLabel(game.nightType)} ${game.results.map(result => playerNames.get(result.playerId) ?? '').join(' ')}`.toLowerCase().includes(needle))
      && (status === 'all' || game.status === status) && (season === 'all' || game.seasonId === season))
      .sort((a, b) => (a.date.localeCompare(b.date) || a.title.localeCompare(b.title)) * (newestFirst ? -1 : 1));
  }, [data.games, query, status, season, playerNames, newestFirst]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const drafts = data.games.filter(game => game.status === 'draft').length;
  const completed = data.games.length - drafts;
  const volume = data.games.filter(game => game.status === 'completed').reduce((sum, game) => sum + game.results.reduce((total, result) => total + result.buyInCents, 0), 0);

  useEffect(() => { setData(initialData); }, [initialData]);
  useEffect(() => { updateLeagueQuery(data.selectedLeagueId); }, [data.selectedLeagueId]);
  useEffect(() => {
    if (previousLeague.current === data.selectedLeagueId) return;
    previousLeague.current = data.selectedLeagueId;
    setEditor(null); setDialog(null); setExpanded(null); setPage(1); setQuery(''); setStatus('all'); setSeason('all');
  }, [data.selectedLeagueId]);
  useEffect(() => {
    if (deepLinkHandled.current || !editable) return;
    deepLinkHandled.current = true;
    const params = new URLSearchParams(window.location.search);
    const game = data.games.find(item => item.id === params.get('gameId'));
    if (game) setEditor({ game });
    else if (params.get('new') === '1') setEditor({ game: null });
  }, [data.games, editable]);

  function openEditor(game: ManagedGame | null) { setNotice(null); setEditorRevision(value => value + 1); setEditor({ game }); }
  function closeEditor() {
    setEditor(null);
    const url = new URL(window.location.href); url.searchParams.delete('gameId'); url.searchParams.delete('new');
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    requestAnimationFrame(() => newGameButton.current?.focus());
  }
  function updateLeagueQuery(id: string | null) {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set('leagueId', id); else url.searchParams.delete('leagueId');
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }
  async function refresh(targetLeagueId: string | null | undefined = league?.id, refreshShell = false) {
    const fresh = await api<PortalData>(targetLeagueId ? `?leagueId=${encodeURIComponent(targetLeagueId)}` : '');
    setData(fresh);
    updateLeagueQuery(fresh.selectedLeagueId);
    if (refreshShell) router.refresh();
    return fresh;
  }
  async function refreshAfterMutation(targetLeagueId: string | null | undefined = league?.id, refreshShell = false): Promise<boolean> {
    try { await refresh(targetLeagueId, refreshShell); return true; }
    catch { if (refreshShell) router.refresh(); return false; }
  }
  const refreshSuffix = (refreshed: boolean) => refreshed ? '' : ' Your change was saved, but the latest records could not be loaded. Refresh the page to view them.';
  async function run<T>(key: string, task: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false }> {
    if (busyRef.current) return { ok: false };
    busyRef.current = true; setBusy(key); setNotice(null);
    try { return { ok: true, value: await task() }; }
    catch (error) { setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Something went wrong. Please try again.' }); return { ok: false }; }
    finally { busyRef.current = false; setBusy(null); }
  }
  async function selectLeague(id: string) {
    const result = await run('selection', async () => { await api('/selection', { method: 'POST', body: { leagueId: id } }); await refresh(id, true); });
    if (result.ok) { setPage(1); setQuery(''); setSeason('all'); setStatus('all'); setExpanded(null); }
  }
  async function saveGame(input: GameInput): Promise<boolean> {
    if (!league || !editable) return false;
    const result = await run('game', async () => {
      const saved = await api<{ id: string; version: number }>('/games', { method: 'POST', body: { leagueId: league.id, game: input } });
      const record: ManagedGame = { ...input, id: saved.id, version: saved.version, leagueId: league.id, sourceRef: editor?.game?.sourceRef ?? null };
      setData(current => ({ ...current, games: [...current.games.filter(game => game.id !== saved.id), record] }));
      return refreshAfterMutation();
    });
    if (!result.ok) return false;
    closeEditor(); setNotice({ tone: 'success', text: (input.status === 'draft' ? 'Draft saved. It is excluded from standings until completed.' : 'Game saved. The completed results are included in standings.') + refreshSuffix(result.value) });
    return true;
  }
  async function createPlayer(displayName: string): Promise<string | null> {
    if (!league || !editable) return null;
    const result = await run('player', async () => {
      const created = await api<{ id: string }>('/players', { method: 'POST', body: { leagueId: league.id, displayName } });
      setData(current => ({ ...current, players: [...current.players, { id: created.id, displayName, aliases: [] }] }));
      const refreshed = await refreshAfterMutation(); return { id: created.id, refreshed };
    });
    if (!result.ok) return null;
    setNotice({ tone: 'success', text: `${displayName} was added to ${league.name}.` + refreshSuffix(result.value.refreshed) }); return result.value.id;
  }
  async function deleteGame(game: ManagedGame) {
    const result = await run('delete', async () => {
      await api(`/games/${game.id}`, { method: 'DELETE', body: { leagueId: game.leagueId, expectedVersion: game.version } });
      setData(current => ({ ...current, games: current.games.filter(item => item.id !== game.id) }));
      return refreshAfterMutation();
    });
    if (result.ok) { setDialog(null); setExpanded(null); setNotice({ tone: 'success', text: 'Game deleted. Its results have been removed from standings.' + refreshSuffix(result.value) }); }
  }
  async function saveLeague(values: { name: string; slug: string; visibility: League['visibility'] }, existing: League | null) {
    const result = await run('league', async () => {
      let selected = true;
      let targetLeagueId = existing?.id ?? league?.id;
      if (existing) {
        await api(`/leagues/${existing.id}`, { method: 'PATCH', body: { name: values.name, visibility: values.visibility } });
        setData(current => ({ ...current, leagues: current.leagues.map(item => item.id === existing.id ? { ...item, name: values.name, visibility: values.visibility } : item) }));
      }
      else {
        const created = await api<{ id: string }>('/leagues', { method: 'POST', body: values });
        setData(current => ({ ...current, leagues: [...current.leagues, { ...values, id: created.id, currency: 'USD', timezone: 'America/New_York', role: 'owner' }] }));
        try { await api('/selection', { method: 'POST', body: { leagueId: created.id } }); targetLeagueId = created.id; }
        catch { selected = false; }
      }
      return { selected, refreshed: await refreshAfterMutation(targetLeagueId, true) };
    });
    if (result.ok) { setDialog(null); setPage(1); setSeason('all'); setStatus('all'); setQuery(''); setNotice({ tone: 'success', text: (existing ? 'League settings updated.' : result.value.selected ? 'League created. Add players and record your first game.' : 'League created. Select it from the active league menu to get started.') + refreshSuffix(result.value.refreshed) }); }
    return result.ok;
  }
  async function deleteLeague(existing: League) {
    const result = await run('league-delete', async () => {
      await api(`/leagues/${existing.id}`, { method: 'DELETE' });
      setData(current => ({ ...current, leagues: current.leagues.filter(item => item.id !== existing.id), selectedLeagueId: null, players: [], games: [] }));
      return refreshAfterMutation(null, true);
    });
    if (result.ok) { setDialog(null); setPage(1); setSeason('all'); setQuery(''); setNotice({ tone: 'success', text: 'League and its player roster deleted.' + refreshSuffix(result.value) }); }
    return result.ok;
  }
  async function reloadGame(game: ManagedGame) {
    const result = await run('reload', () => refresh(league?.id, true));
    if (!result.ok) return;
    const latest = result.value.games.find(item => item.id === game.id);
    setDialog(null);
    if (latest) { setEditorRevision(value => value + 1); setEditor({ game: latest }); setNotice({ tone: 'success', text: 'Loaded the latest saved game. Your unsaved changes were discarded.' }); }
    else { closeEditor(); setNotice({ tone: 'error', text: 'This game no longer exists. The league records have been refreshed.' }); }
  }

  return <div className="space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p>League operations</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">Manage your league</h1><p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">One home for games, players, and payouts. Keep the records here and the standings take care of themselves.</p></div><div className="flex items-center gap-2 pt-1"><Link href="/games" className={secondaryClass}>View games</Link>{!editor && <button ref={newGameButton} type="button" onClick={() => openEditor(null)} disabled={!editable || !!busy} className={primaryClass}><Plus size={17} /> Record game</button>}</div></header>
    {!data.configured && <div className="flex gap-3 rounded-xl border border-carolina/70 bg-carolina-light px-4 py-4"><CircleHelp size={20} className="mt-0.5 shrink-0 text-carolina-dark" /><div><p className="text-sm font-semibold text-navy">Connect Supabase to start managing league records.</p><p className="mt-1 text-xs leading-5 text-slate-600">League records will be available once the database connection is ready.</p></div></div>}
    {data.configured && !data.user && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-carolina/70 bg-carolina-light px-4 py-4"><div><p className="text-sm font-semibold text-navy">Sign in to manage league records.</p><p className="mt-1 text-xs text-slate-600">Public leagues are available to browse. Admins and league scorekeepers can record and update games.</p></div><Link href="/auth/login?next=%2Fmanage" className={primaryClass}>Sign in</Link></div>}
    {data.configured && data.user && league && !canEdit(league.role) && <p className="rounded-xl border bg-white px-4 py-3 text-sm text-slate-600">You have viewing access to {league.name}. Ask a league owner or admin for permission to manage games.</p>}
    {notice && <div role={notice.tone === 'error' ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm ${notice.tone === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{notice.text}{notice.tone === 'error' && editor?.game && <button type="button" disabled={!!busy} onClick={() => setDialog({ kind: 'reload', game: editor.game! })} className="ml-2 rounded px-2 py-1 text-xs font-semibold underline underline-offset-4 disabled:opacity-50">Load latest game</button>}</div>}
    {!editor && <>
      <section className="card flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5" aria-label="Active league">
        <div className="flex min-w-0 flex-1 items-center gap-3"><div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-carolina-light text-carolina-dark sm:flex"><Layers3 size={21} /></div><label className="min-w-0 flex-1 text-xs font-semibold text-slate-500">Active league<select aria-label="Active league" value={league?.id ?? ''} disabled={!!busy || !data.leagues.length} onChange={event => selectLeague(event.target.value)} className="mt-1 block w-full max-w-sm rounded-lg border bg-white px-3 py-2 text-base font-bold text-navy focus:outline-2 focus:outline-carolina/40 disabled:opacity-50">{!league && <option value="">{data.leagues.length ? 'Select a league' : 'No leagues yet'}</option>}{data.leagues.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>
        <div className="flex flex-wrap items-center gap-2">{league && <><span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-600">{league.visibility === 'private' ? <LockKeyhole size={13} /> : <Globe2 size={13} />}{league.visibility === 'private' ? 'Private league' : 'Public league'}</span>{league.role && <span className="inline-flex items-center gap-1.5 rounded-full bg-carolina-light px-2.5 py-1.5 text-xs font-medium capitalize text-navy"><ShieldCheck size={13} />{league.role}</span>}<button type="button" onClick={() => { setNotice(null); setDialog({ kind: 'players' }); }} disabled={!!busy} className={secondaryClass}><Users size={16} /> Players</button>{admin && <button type="button" onClick={() => { setNotice(null); setDialog({ kind: 'league', league }); }} disabled={!!busy} className={secondaryClass}><Settings2 size={16} /> Settings</button>}</>}{data.configured && data.user && <button type="button" onClick={() => { setNotice(null); setDialog({ kind: 'league', league: null }); }} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-carolina-dark hover:bg-carolina-light disabled:opacity-50"><Plus size={16} /> New league</button>}</div>
      </section>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Metric icon={<CalendarDays size={19} />} label="Completed games" value={String(completed)} detail="Included in standings" /><Metric icon={<FileClock size={19} />} label="Draft games" value={String(drafts)} detail="Waiting for final results" /><Metric icon={<Users size={19} />} label="League players" value={String(data.players.length)} detail="Ready for the next table" /><Metric icon={<Layers3 size={19} />} label="Total buy-ins" value={money(volume)} detail="Across completed games" /></div>
      <section className="card overflow-hidden" aria-labelledby="game-records-title">
        <div className="space-y-4 border-b p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-2"><h2 id="game-records-title" className="text-lg font-bold text-navy">Game records <span className="ml-1 text-sm font-normal text-slate-400">{data.games.length}</span></h2><p className="text-xs text-slate-500">{league?.name ?? 'Select or create a league to get started'}</p></div>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem_11rem]"><label className="relative"><span className="sr-only">Search game records</span><Search size={17} className="pointer-events-none absolute left-3 top-3 text-slate-400" /><input type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} className="w-full rounded-lg border bg-slate-50/70 py-2.5 pl-10 pr-3 text-sm focus:border-carolina-dark focus:outline-2 focus:outline-carolina/40" placeholder="Search games or players…" /></label><label><span className="sr-only">Game status</span><select value={status} onChange={event => { setStatus(event.target.value); setPage(1); }} className="w-full rounded-lg border bg-white px-3 py-2.5 text-sm"><option value="all">All statuses</option><option value="completed">Completed</option><option value="draft">Drafts</option></select></label><label><span className="sr-only">Game season</span><select value={season} onChange={event => { setSeason(event.target.value); setPage(1); }} className="w-full rounded-lg border bg-white px-3 py-2.5 text-sm"><option value="all">All seasons</option>{seasons.map(item => <option key={item} value={item}>{item}</option>)}</select></label></div>
        </div>
        <div className="relative overflow-x-auto"><table className="w-full min-w-[640px] text-sm"><thead><tr><th scope="col" className="px-5 py-3 text-left" aria-sort={newestFirst ? 'descending' : 'ascending'}><button type="button" onClick={() => { setNewestFirst(value => !value); setPage(1); }} className="inline-flex items-center gap-1.5 font-semibold">Game date{newestFirst ? <ArrowDown size={13} /> : <ArrowUp size={13} />}</button></th><th scope="col" className="px-3 py-3 text-left">Game</th><th scope="col" className="px-3 py-3 text-center">Players</th><th scope="col" className="px-3 py-3 text-right">Buy-ins</th><th scope="col" className="px-3 py-3 text-left">Status</th><th scope="col" className="px-4 py-3 text-right"><span className="sr-only">Actions</span></th></tr></thead><tbody>{visible.map(game => <GameRow key={game.id} game={game} names={playerNames} editable={editable} busy={!!busy} expanded={expanded === game.id} onExpand={() => setExpanded(value => value === game.id ? null : game.id)} onEdit={() => openEditor(game)} onDelete={() => { setNotice(null); setDialog({ kind: 'delete', game }); }} />)}</tbody></table></div>
        {!visible.length && <div className="px-5 py-12 text-center"><CalendarDays size={28} className="mx-auto mb-3 text-carolina-dark" /><h3 className="text-base font-bold text-navy">{data.games.length ? 'No matching games' : 'Your next game starts here'}</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">{data.games.length ? 'Try another search, status, or season.' : 'Add players and record a game. Save it as a draft until the payouts are settled.'}</p>{data.games.length ? <button type="button" onClick={() => { setQuery(''); setStatus('all'); setSeason('all'); }} className="mt-4 rounded-lg border px-4 py-2 text-sm font-semibold text-navy">Clear filters</button> : editable && <button type="button" onClick={() => openEditor(null)} className={`${primaryClass} mt-4`}><Plus size={16} /> Record first game</button>}</div>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-slate-50/50 px-5 py-3"><p className="text-xs text-slate-500">{filtered.length ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filtered.length)} of ${filtered.length} games` : '0 games'}{query || season !== 'all' || status !== 'all' ? ' match your filters' : ''}</p>{pages > 1 && <nav aria-label="Game records pagination" className="flex items-center gap-3 text-xs"><button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="rounded-lg border bg-white px-3 py-2 font-semibold disabled:opacity-40">Previous</button><span>{currentPage} / {pages}</span><button type="button" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)} className="rounded-lg border bg-white px-3 py-2 font-semibold disabled:opacity-40">Next</button></nav>}</div>
      </section>
    </>}
    {editor && league && <GameEditor key={`${editor.game?.id ?? 'new'}:${editor.game?.version ?? 0}:${editorRevision}`} game={editor.game} league={league} players={players} seasons={seasons} busy={!!busy || !editable} onSave={saveGame} onCancel={closeEditor} onCreatePlayer={createPlayer} />}
    {dialog?.kind === 'delete' && <PortalDialog title="Delete this game?" onClose={() => setDialog(null)} busy={!!busy}><p className="text-sm leading-6 text-slate-600"><strong className="text-navy">{dialog.game.title}</strong> from {dateLabel(dialog.game.date)} and all {dialog.game.results.length} player results will be permanently removed. Completed results will also leave the standings.</p>{notice?.tone === 'error' && <p role="alert" className="mt-3 text-sm text-red-700">{notice.text}</p>}<div className="mt-6 flex justify-end gap-3"><button autoFocus data-dialog-focus type="button" disabled={!!busy} onClick={() => setDialog(null)} className={secondaryClass}>Keep game</button><button type="button" disabled={!!busy} onClick={() => deleteGame(dialog.game)} className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Trash2 size={16} />{busy ? 'Deleting…' : 'Delete game'}</button></div></PortalDialog>}
    {dialog?.kind === 'league' && <LeagueDialog league={dialog.league} deletable={dialog.league?.role === 'owner' && !data.games.length} busy={!!busy} error={notice?.tone === 'error' ? notice.text : null} onClose={() => setDialog(null)} onSave={values => saveLeague(values, dialog.league)} onDelete={() => dialog.league ? deleteLeague(dialog.league) : Promise.resolve(false)} />}
    {dialog?.kind === 'reload' && <PortalDialog title="Load the latest saved game?" busy={!!busy} onClose={() => setDialog(null)}><p className="text-sm leading-6 text-slate-600">Loading the latest version of <strong>{dialog.game.title}</strong> will discard the unsaved changes in this editor.</p>{notice?.tone === 'error' && <p className="mt-3 text-sm text-red-700">{notice.text}</p>}<div className="mt-5 flex justify-end gap-2"><button type="button" autoFocus data-dialog-focus disabled={!!busy} onClick={() => setDialog(null)} className={secondaryClass}>Keep editing</button><button type="button" disabled={!!busy} onClick={() => reloadGame(dialog.game)} className={primaryClass}>{busy ? 'Loading…' : 'Load latest game'}</button></div></PortalDialog>}
    {dialog?.kind === 'players' && league && <PlayersDialog league={league} players={players} editable={editable} busy={!!busy} error={notice?.tone === 'error' ? notice.text : null} onClose={() => setDialog(null)} onCreate={createPlayer} />}
    {!editor && <p className="flex items-center justify-center gap-2 px-2 text-center text-xs leading-5 text-slate-400"><ShieldCheck size={14} className="shrink-0" />Games and players belong to the selected league. Drafts stay out of the standings.</p>}
  </div>;
}

function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return <div className="card p-4 sm:p-5"><div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold text-slate-500">{label}</p><span className="text-carolina-dark">{icon}</span></div><p className="mt-3 truncate text-2xl font-black tracking-tight tabular-nums text-navy sm:text-3xl" title={value}>{value}</p><p className="mt-1 text-[11px] text-slate-400">{detail}</p></div>;
}

export function GameRow({ game, names, editable, busy, expanded, onExpand, onEdit, onDelete }: { game: ManagedGame; names: Map<string, string>; editable: boolean; busy: boolean; expanded: boolean; onExpand: () => void; onEdit: () => void; onDelete: () => void }) {
  const totals = gameCashTotals(game);
  const total = totals.totalIn;
  const warning = needsReconciliation(game);
  return <><tr className="border-t"><td className="whitespace-nowrap px-5 py-4 text-xs text-slate-500">{dateLabel(game.date)}</td><td className="max-w-sm px-3 py-4"><button type="button" aria-expanded={expanded} aria-controls={`results-${game.id}`} onClick={onExpand} className="flex items-start gap-1.5 text-left font-semibold text-navy hover:text-carolina-dark">{expanded ? <ChevronDown size={15} className="mt-0.5 shrink-0" /> : <ChevronRight size={15} className="mt-0.5 shrink-0" />}<span>{game.title}<span className="mt-1 block text-xs font-normal text-slate-500">{game.seasonId} · {nightLabel(game.nightType)} · {game.format === 'tournament' ? 'Tournament' : 'Cash'}</span>{warning && <span className="mt-1 block text-[11px] font-medium text-amber-700">Buy-in/cash-out mismatch</span>}</span></button></td><td className="px-3 py-4 text-center tabular-nums text-slate-600">{game.results.length}</td><td className="whitespace-nowrap px-3 py-4 text-right font-semibold tabular-nums text-navy">{money(total)}</td><td className="px-3 py-4"><span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${game.status === 'draft' ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-700'}`}>{game.status === 'draft' ? 'Draft' : 'Completed'}</span></td><td className="px-4 py-4"><div className="flex justify-end gap-1"><button type="button" disabled={!editable || busy} onClick={onEdit} aria-label={`Edit ${game.title}`} title="Edit game" className="rounded-lg p-2 text-carolina-dark hover:bg-carolina-light disabled:opacity-30"><Edit3 size={16} /></button><button type="button" disabled={!editable || busy} onClick={onDelete} aria-label={`Delete ${game.title}`} title="Delete game" className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-700 disabled:opacity-30"><Trash2 size={16} /></button></div></td></tr>{expanded && <tr id={`results-${game.id}`}><td colSpan={6} className="border-t bg-carolina-light/25 px-5 py-4"><div className="max-w-3xl"><div className="mb-3 flex items-center justify-between gap-2"><h3 className="text-xs font-bold uppercase tracking-wider text-carolina-dark">Player results</h3>{game.status === 'completed' && <Link href={`/games/${game.id}`} className="text-xs font-semibold text-carolina-dark underline underline-offset-4">Full game details</Link>}</div><div className="mb-4 rounded-lg border bg-white px-3 py-3 text-xs"><div className="flex flex-wrap gap-x-6 gap-y-2"><p>Total buy-ins: <strong>{money(totals.totalIn)}</strong></p><p>Total cash-outs: <strong>{money(totals.totalOut)}</strong>{totals.pendingPayouts > 0 && " (entered payouts)"}</p></div><p className={`mt-2 ${totals.difference ? "text-amber-800" : "text-slate-600"}`}>{totals.difference === null ? `${totals.pendingPayouts} pending payout(s); mismatch cannot be calculated yet.` : totals.difference === 0 ? "Buy-ins and cash-outs match ($0.00 difference)." : `Mismatch: ${money(Math.abs(totals.difference))} — cash-outs ${totals.difference > 0 ? "exceed" : "fall short of"} buy-ins.`}</p></div>{!game.results.length ? <p className="text-sm text-slate-500">No player results have been entered yet.</p> : <table className="w-full text-xs"><thead><tr><th scope="col" className="rounded-tl-lg px-3 py-2 text-left">Player</th><th scope="col" className="px-3 py-2 text-right">Buy-in</th><th scope="col" className="px-3 py-2 text-right">Cash-out</th><th scope="col" className="px-3 py-2 text-right">Profit</th>{game.format === 'tournament' && <th scope="col" className="px-3 py-2 text-right">Place</th>}</tr></thead><tbody>{game.results.map(result => <tr key={result.playerId} className="border-t"><td className="px-3 py-2 font-medium">{names.get(result.playerId) ?? 'Unknown player'}</td><td className="px-3 py-2 text-right tabular-nums">{money(result.buyInCents)}</td><td className="px-3 py-2 text-right tabular-nums">{result.cashOutCents === null ? 'Pending' : money(result.cashOutCents)}</td><td className="px-3 py-2 text-right tabular-nums">{result.legacyProfitCents != null ? money(result.legacyProfitCents) : result.cashOutCents === null ? '—' : money(result.cashOutCents - result.buyInCents)}</td>{game.format === 'tournament' && <td className="px-3 py-2 text-right">{result.placement ?? '—'}</td>}</tr>)}</tbody></table>}{game.sourceRef && <p className="mt-3 break-all text-xs text-slate-500">Import source: {game.sourceRef}</p>}{game.notes && <p className="mt-3 whitespace-pre-wrap text-xs leading-6 text-slate-600"><span className="font-semibold">Notes: </span>{game.notes}</p>}</div></td></tr>}</>;
}

function LeagueDialog({ league, deletable, busy, error, onClose, onSave, onDelete }: {
  league: League | null; deletable: boolean; busy: boolean; error: string | null; onClose: () => void;
  onSave: (values: { name: string; slug: string; visibility: League['visibility'] }) => Promise<boolean>; onDelete: () => Promise<boolean>;
}) {
  const [name, setName] = useState(league?.name ?? '');
  const [slug, setSlug] = useState(league?.slug ?? '');
  const [slugEdited, setSlugEdited] = useState(false);
  const [visibility, setVisibility] = useState<League['visibility']>(league?.visibility ?? 'private');
  const [localError, setLocalError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteName, setDeleteName] = useState('');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) { setLocalError('Enter a league name.'); return; }
    if (!league && (slug.length < 2 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))) { setLocalError('Use at least two lowercase letters or numbers, with optional single hyphens, for the league address.'); return; }
    setLocalError(''); await onSave({ name: name.trim(), slug, visibility });
  }
  return <PortalDialog title={league ? 'League settings' : 'Create a league'} onClose={onClose} busy={busy}>
    <form onSubmit={submit} className="space-y-4"><fieldset disabled={busy} className="space-y-4"><legend className="sr-only">League details</legend><label className="block text-sm font-semibold">League name<input autoFocus data-dialog-focus required maxLength={100} className={fieldClass} value={name} onChange={event => { setName(event.target.value); if (!league && !slugEdited) setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')); }} placeholder="UNC Poker" /></label><label className="block text-sm font-semibold">League address<input required readOnly={!!league} minLength={2} maxLength={80} className={`${fieldClass} ${league ? 'bg-slate-50 text-slate-500' : ''}`} value={slug} onChange={event => { setSlugEdited(true); setSlug(event.target.value.toLowerCase()); }} placeholder="unc-poker" /><span className="mt-1.5 block text-xs font-normal text-slate-500">{league ? 'The league address stays the same when you rename it.' : 'A unique address, using lowercase letters and hyphens.'}</span></label><label className="block text-sm font-semibold">Visibility<select className={fieldClass} value={visibility} onChange={event => setVisibility(event.target.value as League['visibility'])}><option value="private">Private — members only</option><option value="public">Public — anyone can view</option></select></label><p className="text-xs leading-5 text-slate-500">{visibility === 'private' ? 'Only league members and app admins can view this league’s games and players.' : 'Anyone can view this league’s games and players. Editing requires an admin or league scorekeeper role.'}</p></fieldset>{(localError || error) && <p role="alert" className="text-sm text-red-700">{localError || error}</p>}<div className="flex justify-end gap-2 border-t pt-4"><button type="button" disabled={busy} onClick={onClose} className={secondaryClass}>Cancel</button><button type="submit" disabled={busy || confirmDelete} className={primaryClass}>{busy ? 'Saving…' : league ? 'Save settings' : 'Create league'}</button></div></form>
    {league?.role === 'owner' && <div className="mt-6 border-t pt-4"><h3 className="text-sm font-bold text-red-700">Delete league</h3><p className="mt-1 text-xs leading-5 text-slate-500">A league can be deleted after all its games are removed. Deleting it also permanently deletes its player roster.</p>{!confirmDelete ? <button type="button" disabled={busy || !deletable} onClick={() => setConfirmDelete(true)} className="mt-3 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-40">Delete league</button> : <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3"><label className="block text-xs font-semibold text-red-800">Type “{league.name}” to delete this league and its player roster<input className={fieldClass} disabled={busy} value={deleteName} onChange={event => setDeleteName(event.target.value)} /></label><div className="mt-3 flex gap-2"><button type="button" disabled={busy} onClick={() => { setConfirmDelete(false); setDeleteName(''); }} className={secondaryClass}>Keep league</button><button type="button" disabled={busy || deleteName !== league.name} onClick={onDelete} className="rounded-lg bg-red-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">{busy ? 'Deleting…' : 'Permanently delete'}</button></div></div>}</div>}
  </PortalDialog>;
}

function PlayersDialog({ league, players, editable, busy, error, onClose, onCreate }: { league: League; players: PortalData['players']; editable: boolean; busy: boolean; error: string | null; onClose: () => void; onCreate: (name: string) => Promise<string | null> }) {
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [localError, setLocalError] = useState('');
  const matches = players.filter(player => `${player.displayName} ${player.aliases.join(' ')}`.toLowerCase().includes(search.toLowerCase()));
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) { setLocalError('Enter a player name.'); return; }
    setLocalError(''); if (await onCreate(name.trim())) setName('');
  }
  return <PortalDialog title="League players" onClose={onClose} busy={busy}><p className="mb-4 text-xs text-slate-500">{players.length} {players.length === 1 ? 'player' : 'players'} in {league.name}</p><label className="block text-xs font-semibold">Find a player<input type="search" className={fieldClass} value={search} onChange={event => setSearch(event.target.value)} placeholder="Name or nickname" /></label><ul className="mt-3 max-h-60 space-y-1 overflow-y-auto rounded-lg border bg-slate-50/50 p-2">{matches.map(player => <li key={player.id} className="rounded px-3 py-2 text-sm"><span className="font-semibold text-navy">{player.displayName}</span>{player.aliases.length > 0 && <span className="ml-2 text-xs text-slate-400">{player.aliases.join(', ')}</span>}</li>)}{!matches.length && <li className="px-3 py-5 text-center text-sm text-slate-500">{players.length ? 'No players match this search.' : 'No players yet. Add the first player below.'}</li>}</ul>{editable && <form onSubmit={submit} className="mt-5 space-y-3 border-t pt-4"><label className="block text-sm font-semibold">Add a player<input required disabled={busy} autoComplete="off" maxLength={100} className={fieldClass} value={name} onChange={event => { setName(event.target.value); setLocalError(''); }} placeholder="Full name or nickname" /></label>{(localError || error) && <p role="alert" className="text-sm text-red-700">{localError || error}</p>}<div className="flex justify-end"><button type="submit" disabled={busy} className={primaryClass}><Plus size={16} />{busy ? 'Adding…' : 'Add player'}</button></div></form>}</PortalDialog>;
}
