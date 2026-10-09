# Discord accounts and verified player links

The account page now uses **Sign in with Discord** to create or sign in to an
account through Supabase Auth. Email sign-in remains available. After signing in,
choose a league and player page or **No link for now**. A no-link choice is saved
on the account and can be changed later. Private league rosters remain restricted
to members; sign-in and linking never grant management privileges.

## Enable the live account flow

1. Connect the existing Supabase project using the two public variables described
   below, and apply migrations 001, 002, then
   `supabase/migrations/202610090003_discord_link_verification.sql`, followed by
   `supabase/migrations/202610090006_admin_self_player_links.sql`.
   Existing player links are preserved; all new claims become pending requests.
2. In the Discord Developer Portal, create/select your application and add this
   OAuth2 redirect: `https://<project-ref>.supabase.co/auth/v1/callback`.
   Use the callback shown by Supabase if your Auth endpoint uses a custom domain.
3. In Supabase Authentication → Sign In / Providers → Discord, enable Discord
   and enter the Discord application's client ID and client secret. The Discord
   secret belongs only in Supabase, never in this app's public environment values.
   Allow new user signups in Supabase Authentication.
4. Set Supabase's Site URL to the application's production origin and allow
   `<origin>/auth/callback` (plus the local development callback when needed).
   The Discord redirect goes to Supabase; Supabase then returns to the app.
5. Sign in with Discord. Assign your account `admin` in `public.users` using the
   privileged first-admin setup below, or assign `owner`/`admin` league membership.
   OAuth metadata can never promote an account. Account reviews require these
   actual database permissions.
6. Verify on the live project with two distinct accounts: submit a claim from a
   player account, approve it from a league owner/admin's **My account → Verify
   player links**, then refresh the player account to see its profile. Also test
   rejection, cancellation, no-link, sign-out/session refresh, and Discord denial.

App administrators can approve or reject any account's claim, including their own,
in every league. League owners/admins can do the same within their leagues. The review queue shows the Discord user ID from the Auth identity (or the account
ID for email users), so administrators can confirm who is making the claim.
Review records retain the decision, reviewer,
and time. Conflicting approvals are rejected atomically; a pending claim reserves
no player ownership. Claimants can cancel pending requests and choose again.
Existing verified ownership constraints still allow one account per player and
one player per account per league. The account page shows every accessible linked
profile, with all-time profit, ROI, rank, buy-ins/cash-outs, win rate, streaks,
championships, a profit chart, and full completed-game history. It uses the same
statistics and historical profit overrides as the league dashboards.

No live Supabase project or Discord application was configured by this code
change. The setup above is necessary before real OAuth sign-in works. Without
configuration league pages show a database setup error; no simulated account or
spreadsheet fallback is available.

The earlier setup notes below describe the existing database, email signup,
privileged administration, and workbook cutover. Where they describe instant
self-claims, migration 003 supersedes that behavior with administrator review.

# Supabase league management

The `/manage` portal is the entry point for recording games, updating results,
adding players, and creating or configuring leagues. The existing dashboards read
the selected league's completed database games once Supabase is configured.
Supabase configuration is required. Missing configuration or a database failure
shows an error; no archived workbook data is served.

## Connect a project

1. Create or select a Supabase project. Back up an existing project before applying
   migrations; these migrations create new `public` tables and functions.
2. Apply both files in `supabase/migrations/` in filename order, using the SQL
   editor as project administrator or the CLI below. The first migration seeds
   **UNC Poker**, with ID `00000000-0000-4000-8000-000000000001`; the second adds
   account profiles, player-page links, and app-wide admin permissions. If the
   first migration is already applied, apply only the second.
3. Copy `.env.example` to `.env.local` and set the project's URL and **publishable**
   key. A legacy anon key also works through `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   Never configure a service-role or secret key in this application. Set the same
   two public variables in the application's hosting environment and rebuild.
4. Set Supabase Authentication's site URL to the actual application origin, enable
   email/password signups, and keep email confirmation enabled. Add
   `<origin>/auth/callback**` to allowed redirect URLs to cover the callback and
   its `next` query parameter. Add a separate localhost origin for development.
5. Create and promote your first admin as described below, sign in, and open
   `/manage` to add players and games.

### Connect with the CLI

Run in the repository root (Node 20 or later):

```bash
npx supabase login
npx supabase init             # only if supabase/config.toml does not exist
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push --dry-run
npx supabase db push
```

The project ref is the identifier in the Supabase dashboard URL. Login uses your
Supabase account's access token/browser flow; linking may prompt for the database
password. Neither is the application's publishable key. The app still needs the
URL and publishable key in `.env.local`; CLI linking alone does not connect it.
If the first migration was applied manually and the CLI says it is pending, mark
that *already-applied* version before pushing:

```bash
npx supabase migration repair 202610090001 --status applied
```

Do not mark unapplied migrations as applied.
Keep CLI-generated `supabase/.temp/` and database passwords out of Git.

### Recover from the duplicate migration 004

An earlier main branch had two migrations numbered `202610090004`: the frozen
historical import and the later game-validation change. The game-validation
change now uses `202610090007`; the import and corrections keep their original
versions and SQL. Update your checkout before retrying a push.

If your push failed while recording `202610090004_import_historical_workbooks.sql`
with `schema_migrations_pkey` / SQLSTATE `23505`, and corrections 005 and admin
links 006 are still pending, run:

```bash
npx supabase migration list
npx supabase migration repair 202610090004 --status reverted
npx supabase db push --dry-run
npx supabase db push
```

The repair removes only the conflicting migration-history entry; it does not
undo SQL or delete application data. The import commits its own transaction, so
its data may already exist despite the history error. An identical import rerun
skips existing records, then records version 004 correctly before applying 005,
006, and 007. Migration 007 safely replaces the game-saving function even if the
old conflicting migration already ran.

If corrections 005 have already been applied, do not replay the original import:
it intentionally rejects corrected or portal-edited history. Check the remote
history and database state before repairing that case. The frozen import's
`supabase/imports/202610090004/verify.sql` can confirm an unmodified original
import; the correction verification is `supabase/imports/202610090005/verify.sql`.

### Create the first admin

1. Visit `/auth/signup`, create your account, and confirm its email. Alternatively,
   use Supabase **Authentication → Users → Add user**, with email confirmation.
   The Auth trigger creates a matching `public.users` row with role `player`;
   existing Auth users are also backfilled as players when the migration runs.
2. In Supabase **Table Editor → public.users**, change your row's `role` from
   `player` to `admin`. Or run this in the privileged SQL editor, replacing the
   email with the address you registered:

   ```sql
   update public.users
   set role = 'admin'
   where email = 'you@example.com'
   returning id, email, role;
   ```

3. Sign in at `/auth/login` and open `/manage`. An app admin can add/edit/delete
   games, add players, and update settings in all leagues, including UNC Poker,
   without an additional `league_members` entry. `/account` displays your role.
   If already signed in, refresh after changing the role.

Change **`public.users.role`**, not Supabase's internal `auth.users.role` or user
metadata. The application cannot update roles, even for admins. Signup metadata
can supply a display name, never permissions. Email changes sync into the profile
without overwriting its role. Setting the profile back to `player` removes
app-wide access on the next request; explicit league memberships still apply.

### League-specific access

`public.users.role` is app-wide. `league_members.role` remains league-specific,
so a player account can be a scorekeeper/admin in one league without access to
other private leagues. Assign those roles through privileged SQL/Table Editor:

```sql
insert into public.league_members (league_id, user_id, role)
values (
  '00000000-0000-4000-8000-000000000001',
  '<auth-user-uuid>'::uuid,
  'scorekeeper'
)
on conflict (league_id, user_id) do update set role = excluded.role;
```

Use `owner`, `admin`, `scorekeeper`, or `viewer`. A signed-in user creating a new
league becomes its owner automatically. Only an explicit owner can delete an
empty league; app-wide admin alone does not grant this permission. To appoint an
owner for the seeded UNC league, use the same SQL with `owner`. Existing
memberships keep working, and the profile migration does not promote their users
to app-wide admins. Keep at least one owner when changing ownership.

### Link a player page

Confirmed users can link an existing player from `/account` or its `/players/...`
page. Use the league selector to switch leagues. Each account can have one link
per league, and each player page can belong to one account. Linking never changes
game history, names, results, roles, or memberships. Users can unlink their own
pages, including after losing access to a now-private league, and choose another.
An unrelated user cannot claim a private league's player or replace another
account's claim. A public claim-status RPC exposes only claim status and the
caller's own linked player ID; account emails and IDs are not public.

This is self-service linking, not identity verification: the first confirmed
account to claim an unlinked page owns its link. If a mistake or dispute occurs,
a project administrator can repair `public.player_links` in the Table Editor or
delete the mistaken row with privileged SQL; no poker records are deleted. The
app has no account directory or claim-approval workflow in this version.

The default Supabase email template returns through `/auth/callback` using PKCE.
For confirmations opened in a different browser/device, a token-hash template is
also supported. Set the confirmation email link to:

```html
<a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email">Confirm email</a>
```

That template returns users to `/account`. Configure your production SMTP sender
before inviting your league; actual email delivery depends on the project
settings. No existing Supabase project or live account was modified as part of
this implementation.

## Move the historical workbooks

### Apply the committed historical migration

Connecting Supabase switches the dashboards to database reads. An empty database
therefore shows **No completed games yet** before the historical import has been applied. OAuth sign-in does not import those workbooks.

The frozen import of all four original season workbooks is ready to execute:

1. Confirm migrations `202610090001`, `202610090002`, and `202610090003` have
   already been applied to the same Supabase project used by the deployed app.
2. Review `supabase/imports/202610090004/manifest.json` for workbook SHA-256
   fingerprints, counts, source discrepancies, and import assumptions.
3. In Supabase **SQL Editor**, run the entire
   `supabase/migrations/202610090004_import_historical_workbooks.sql` as the project
   administrator. Alternatively, after reviewing `npx supabase db push --dry-run`,
   apply the pending migrations with `npx supabase db push`.
4. Run the entire `supabase/imports/202610090004/verify.sql`. The `game`, `player`,
   and `result` rows must each have `passed = true` and zero missing, changed, or
   unexpected records. Run this before editing historical records in the portal.
5. Refresh the deployed dashboard. No website redeployment is required for this
   database-only import. UNC Poker's existing visibility and memberships remain
   unchanged; its seeded public history is readable by newly signed-in accounts.

The migration inserts completed games, canonical players and aliases, buy-ins,
cash-outs, inferred placements, original dates, and historical Net overrides.
It contains 49 players, 62 games, and 696 valid results across fall 2025, spring
2026, summer 2026, and fall 2026. The one incomplete source result is Drew's
October 3, 2025 one-off: a $50 buy-in with `?` for cash-out and Net
(`fall-2025.xlsx`, `One-offs (not in totals)`, row 6). It remains in the external source archive
and is reported in the manifest; no payout or profit is invented. Correct this
record separately once its actual cash-out is known. Other source reconciliation
warnings and six Net overrides are preserved, not balanced artificially.
Exact reruns are safe. Conflicting existing records or previously deleted games
abort the whole transaction rather than overwriting portal edits. It does not
create accounts, grant administrator privileges, or claim player profiles.

Keep this applied migration frozen. For later spreadsheet changes, generate and
review a new export; do not regenerate an already-applied migration.

### Apply confirmed historical corrections

The owner-confirmed payout and Net corrections are a separate migration:
`supabase/migrations/202610090005_correct_historical_results.sql`. Apply it after
004, then run `supabase/imports/202610090005/verify.sql` and require both counts
to be 7 and `passed = true`. Drew's October 3 cash-out is $36.10 against a $50.00
buy-in (Net -$13.90); six erroneous spreadsheet Net overrides are cleared.
The original import verification intentionally reports these later corrections
as changes. Keep migration 004 frozen and do not rerun it to restore old figures.
See [Historical corrections and counting differences](data-quality-report.md).

### Generate a new export

Run from the repository root:

```bash
npm run db:export -- --input-dir /path/to/archive
```

This creates `work/supabase-import.sql`, `work/supabase-import-manifest.json`, and
`work/supabase-verify.sql`, without contacting a database. Review the
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
records. After import, execute the **entire** `work/supabase-verify.sql` as the
project administrator. This independent, read-only transaction compares the
frozen export with the database: canonical identities and aliases, game metadata
and provenance, and every result's buy-in, cash-out, placement and legacy profit.
It returns three rows (`game`, `player`, `result`); all `passed` values must be
`true`. Missing, changed, or extra historical results are listed in `mismatches`.
New players and new games do not invalidate verification. Use the verification
file produced alongside the import, before making portal edits to historical
records; regenerating it from changed workbooks changes the comparison baseline.

After cutover, record new games in the portal. This is an initial migration, not a
synchronization job. Follow [Spreadsheet retirement](spreadsheet-retirement.md)
for the source archive and database-only runtime.

## Data and access model

| Record | Scope and behavior |
| --- | --- |
| `leagues` | Name, unique slug, USD currency, timezone, public/private visibility |
| `league_members` | Supabase Auth user and league role |
| `users` | Auth-linked account profile; default `player`, manually promoted `admin` |
| `players` | Identity and aliases within one league; independent of Auth accounts |
| `player_links` | One account/page pair per league; unique page ownership |
| `games` | League, date, season, category, cash/tournament format, status, version |
| `game_results` | One player per game; integer-cent buy-in and nullable cash-out |
| `game_audit_log` | Actor and full before/after snapshots for game mutations |

Composite foreign keys prevent a game from referring to another league's players.
All tables have row-level security. The original UNC league is public to preserve
the existing analytics experience; new leagues default to private. Anonymous
users can read completed games and players in public leagues. League members and
app admins can also see drafts. Viewers cannot write; scorekeepers can manage
games and add players; owners/admins can rename leagues and change visibility. Only owners can
delete a league, and it must have no games. Its roster and membership then cascade
away; game audit history remains.

Direct table mutations are revoked from anonymous/authenticated roles. Every
game save and deletion uses an authenticated, authorization-checked Postgres RPC.
Game metadata, all results, and the audit event commit or roll back together.
Expected versions and row locks reject stale saves/deletions with a conflict,
preventing one scorekeeper from overwriting another. Membership and app admin
profile locks prevent a role-revocation race. API mutations also require
same-origin JSON requests and a server-verified session; the server uses the public
key and the caller's cookies.

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
audit records, rollback after a deliberately failing audit trigger, profile
backfill/defaults, manual promotion/demotion, role-tampering denial, email
confirmation, exclusive page claims, privacy, and caller-only unlinking. Vitest
also executes the complete real-workbook SQL import, checks exact standings and
safe reruns, and covers HTTP authorization/validation and pagination beyond
Supabase's 1,000-row default.

These checks validate Postgres and application logic without a live project.
After connecting the actual project, verify signup/email confirmation,
sign-in/session refresh, profile creation, admin game CRUD without a membership,
and account/player-page linking in Auth/PostgREST. Confirm a player/viewer is
read-only and a second private league is invisible to unrelated accounts. These
project-specific checks require a live Supabase connection.
