# Supabase league management

The `/manage` portal is the entry point for recording games, updating results,
adding players, and creating or configuring leagues. The existing dashboards read
the selected league's completed database games once Supabase is configured.
Without configuration the committed workbooks remain a clearly labeled read-only
archive; writes are disabled. A configured database failure never substitutes old
workbook data.

## Connect a project

1. Create or select a Supabase project. Back up an existing project before applying
   migrations; this migration creates new `public` tables and functions.
2. Execute the complete file
   `supabase/migrations/202610090001_league_game_management.sql` in the Supabase SQL
   editor as the project administrator. It seeds **UNC Poker**, with ID
   `00000000-0000-4000-8000-000000000001`.
3. Copy `.env.example` to `.env.local` and set the project's URL and **publishable**
   key. A legacy anon key also works through `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   Never configure a service-role or secret key in this application. Set the same
   two public variables in the application's hosting environment and rebuild.
4. In Supabase Authentication, create the first administrator account with an
   email and password. Copy its user UUID, then assign the initial owner using the
   following privileged SQL. Replace the placeholder with that UUID:

   ```sql
   insert into public.league_members (league_id, user_id, role)
   values (
     '00000000-0000-4000-8000-000000000001',
     '<administrator-auth-user-uuid>'::uuid,
     'owner'
   );
   ```

5. Set Supabase Authentication's site URL to the actual application origin and
   allow `<origin>/auth/callback` as a redirect URL. Sign in at `/auth/login` and
   open `/manage`.

Additional accounts are provisioned through Supabase Authentication. Membership
changes are deliberately privileged administration operations, not client table
writes. Insert another member with the same SQL pattern and a role of `admin`,
`scorekeeper`, or `viewer`. Keep at least one owner per league when changing roles.
An authenticated user creating a new league becomes its owner automatically.
No existing Supabase project was modified as part of this implementation.

## Move the historical workbooks

Run from the repository root:

```bash
npm run db:export
```

This creates `work/supabase-import.sql` and
`work/supabase-import-manifest.json`, without contacting a database. Review the
manifest and execute the **entire** SQL file in the project's SQL editor after
applying the schema. The import runs in one transaction and retains canonical
player/game IDs, preserving existing links. All source records belong to UNC
Poker.

The current export contains 49 players, 62 games, and 696 results. Six valid source
Net values differ from cash-out minus buy-in; these are retained in an explicitly
named `legacy_profit_cents` field. The manifest carries the normalizer's 40 issues,
including skipped malformed source rows. Source workbooks cannot establish cash
versus tournament format or official finishing positions, so imports are labeled
as cash games with their existing profit-ranked placements and provenance. These
assumptions are recorded in the manifest.

Historical games remain completed to preserve existing standings, even where
their financial totals require review. The portal flags those records. Editing
one removes any legacy profit overrides and requires balanced payouts to complete
it again; saving a draft removes it from standings until it is reconciled.

An identical rerun skips complete existing games. Changed source records,
portal-edited records, mismatched provenance, missing result rows, and deleted
game tombstones abort the transaction rather than overwriting or resurrecting
records. After cutover, record new games in the portal and retain the spreadsheets
as historical evidence. This is an initial migration, not a synchronization job.

## Data and access model

| Record | Scope and behavior |
| --- | --- |
| `leagues` | Name, unique slug, USD currency, timezone, public/private visibility |
| `league_members` | Supabase Auth user and league role |
| `players` | Identity and aliases within one league; independent of Auth accounts |
| `games` | League, date, season, category, cash/tournament format, status, version |
| `game_results` | One player per game; integer-cent buy-in and nullable cash-out |
| `game_audit_log` | Actor and full before/after snapshots for game mutations |

Composite foreign keys prevent a game from referring to another league's players.
All tables have row-level security. The original UNC league is public to preserve
the existing analytics experience; new leagues default to private. Anonymous
users can read completed games and players in public leagues. League members can
also see drafts. Viewers cannot write; scorekeepers can manage games and add
players; owners/admins can rename leagues and change visibility. Only owners can
delete a league, and it must have no games. Its roster and membership then cascade
away; game audit history remains.

Direct table mutations are revoked from anonymous/authenticated roles. Every
game save and deletion uses an authenticated, authorization-checked Postgres RPC.
Game metadata, all results, and the audit event commit or roll back together.
Expected versions and row locks reject stale saves/deletions with a conflict,
preventing one scorekeeper from overwriting another. Membership locks prevent a
role-revocation race. API mutations also require same-origin JSON requests and a
server-verified session; the server uses the public key and the caller's cookies.

Completed games require at least two distinct players, positive buy-ins, every
cash-out entered, and balanced total buy-ins/cash-outs. A blank cash-out in a draft
means unknown; zero means no payout. Completed tournaments require a unique
finishing order from 1 through the participant count. Cash champions retain the
existing highest-profit tie semantics; tournament championships use first place.
Both formats store total contributions per player, including rebuys. Fees, rake,
and carryover are outside this first version; such games need reconciliation
before completion. Existing `$10`, `$20`, `$50`, `Online`, and `One-off` categories
remain available. Seasons are derived from league data rather than workbook files.

## Verify and run

```bash
npm ci
npm run typecheck
npm test
npm run test:db
npm run build
npm run dev
```

`test:db` executes the actual migration and RPCs in PGlite PostgreSQL, with fixtures
only for Supabase's Auth helpers. It checks JWT roles/RLS, tenant isolation,
direct-write denial, invalid completion, tournament positions, stale versions,
audit records, and rollback after a deliberately failing audit trigger. Vitest
also executes the complete real-workbook SQL import, checks exact standings and
safe reruns, and covers HTTP authorization/validation and pagination beyond
Supabase's 1,000-row default.

These checks validate Postgres and application logic without a live project.
After connecting the actual project, verify sign-in/session refresh and game CRUD
with a scorekeeper, confirm a viewer is read-only, and confirm a second private
league is invisible to unrelated accounts. The Supabase project configuration and
live Auth/PostgREST behavior require this final environment check.
