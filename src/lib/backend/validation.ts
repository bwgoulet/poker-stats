import { z } from 'zod';
import { NIGHT_TYPES, classifyNightType } from '@/lib/filters/night-types';

const identifier = z.string().min(1).max(180).regex(/^[a-zA-Z0-9_-]+$/);
const amount = z.number().int().min(0).max(100_000_000);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(+parsed) && parsed.toISOString().slice(0, 10) === value && value >= '1900-01-01' && value <= '2100-12-31';
}, 'Use a valid calendar date.');

export const gameInputSchema = z.object({
  id: identifier.optional(),
  expectedVersion: z.number().int().positive().max(2_147_483_646).optional(),
  title: z.string().trim().min(1).max(120),
  date,
  seasonId: z.string().regex(/^[a-z][a-z0-9-]*-\d{4}$/).max(80),
  nightType: z.enum(NIGHT_TYPES),
  format: z.enum(['cash', 'tournament']),
  status: z.enum(['draft', 'completed']),
  notes: z.string().max(2000),
  results: z.array(z.object({
    playerId: identifier,
    buyInCents: amount,
    cashOutCents: amount.nullable(),
    placement: z.number().int().min(1).max(500).nullable(),
  }).strict()).max(500),
}).strict().superRefine((game, context) => {
  const add = (message: string) => context.addIssue({ code: 'custom', message });
  if (game.id && !game.expectedVersion) add('The current game version is required when editing.');
  if (!game.id && game.expectedVersion) add('A new game cannot have an existing version.');
  if (new Set(game.results.map(row => row.playerId)).size !== game.results.length) add('Each player may appear only once.');
  if (game.format === 'tournament') {
    const placements = game.results.map(row => row.placement).filter(value => value !== null);
    if (new Set(placements).size !== placements.length) add('Tournament placements must be unique.');
  }
  if (game.status === 'completed') {
    if (game.results.length < 2) add('Completed games need at least two players.');
    if (game.results.some(row => row.cashOutCents === null)) add('Enter every cash-out before completing the game.');
    const buyIns = game.results.reduce((sum, row) => sum + row.buyInCents, 0);
    if (!buyIns) add('Completed games need a positive total buy-in.');
    if (game.format === 'tournament') {
      if (game.results.some(row => row.placement === null)) add('Enter every tournament placement.');
      if (game.results.some(row => row.placement !== null && row.placement > game.results.length)) add('Tournament placements must run from first place to the number of players.');
    }
  }
}).transform(game => ({ ...game, nightType: classifyNightType(game.nightType, game.title) }));

export const saveGameSchema = z.object({ leagueId: z.uuid(), game: gameInputSchema }).strict();
export const deleteGameSchema = z.object({ leagueId: z.uuid(), expectedVersion: z.number().int().positive().max(2_147_483_647) }).strict();
export const selectionSchema = z.object({ leagueId: z.uuid() }).strict();
export const createLeagueSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z.string().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  visibility: z.enum(['public', 'private']),
}).strict();
export const updateLeagueSchema = createLeagueSchema.omit({ slug: true });
export const createPlayerSchema = z.object({ leagueId: z.uuid(), displayName: z.string().trim().min(1).max(100) }).strict();
export const signupSchema = z.object({
  email: z.email().max(320),
  password: z.string().min(8, 'Use at least 8 characters for your password.').max(72),
  displayName: z.string().trim().min(1).max(100),
  next: z.string().max(200).optional(),
}).strict();
export const playerLinkSchema = z.object({ leagueId: z.uuid(), playerId: identifier }).strict();
