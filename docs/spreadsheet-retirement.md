# Spreadsheet migration and retirement

For this project, use a one-time snapshot import of all four season workbooks in
`data/`. The existing normalizer already handles their differing layouts, player
aliases, date formats and money values. Direct CSV table uploads would bypass
those rules. Temporary synchronization is only needed if spreadsheet editing
must continue during migration; in that case agree on a final editing cutoff and
generate the final export afterward. The importer deliberately refuses to
overwrite changed or portal-edited historical records.

## Prepare the snapshot

1. Stop spreadsheet edits for the final export and save copies of every source
   workbook in an archive outside the deployment. Keep the archive access limited
   to the appropriate league organizers. Back up an existing target database.
2. Run `npm run db:export`. Keep the SQL, manifest and verification SQL together.
   The manifest records each source file's SHA-256 fingerprint. The export fails
   if a source file changes while it is being read.
3. Review the manifest's source issues and assumptions. The current snapshot has
   49 players, 62 games and 696 valid results. Forty normalizer issues include
   excluded malformed rows; six source Net values differ from cash-out minus
   buy-in and are retained as legacy profits. Preserving today's analytics does
   not recover values absent from, or malformed in, the original workbooks.
   Cash format and profit-ranked placements are inferred and should be reviewed.

Historical player records remain independent of login users. Importing a player's
name does not create an Auth account or grant league membership. The separate
users-table work can proceed without inventing emails or account links.

## Import and verify

1. Confirm the intended Supabase project and apply any unapplied schema
   migrations following [Backend setup](backend-setup.md). Do not reapply the
   initial schema to a project that already has it.
2. Run the entire `supabase-import.sql` as the project administrator. Its
   transaction either inserts the initial history or aborts on a conflict; exact
   reruns skip existing games. Do not paste only selected portions of the file.
3. Run the entire companion `supabase-verify.sql` before modifying historical
   records. All three `passed` values must be `true`. Save the returned rows as
   migration evidence. Resolve missing or changed rows and rerun verification
   before proceeding; equal totals alone are insufficient.
4. Configure the application's Supabase URL and publishable key, rebuild, and
   check the player directory, game history, standings, and each season's totals.
   Test sign-in and a draft game as a scorekeeper, and confirm viewers cannot
   write. A configured database outage must surface an error.

The frozen verification file remains usable after archiving the workbooks. It
checks the original history, so deliberate later corrections will appear as
changes. Retain the initial passing output rather than treating future edits as
failed migrations. Normal financial review remains separate from migration
fidelity: a copied source discrepancy is still a source discrepancy.

## Retire the spreadsheets later

Once the live checks pass, stop entering results in spreadsheets and use `/manage`
for all new games. Keep the source archive, import files, fingerprints, and a
database backup through the agreed recovery period.

In a later change, remove the four `data/*.xlsx` files from the deployed source
and make database configuration required if the archive fallback is no longer
wanted. The configured application already reads its players, games, results and
seasons from Supabase; the cutover tests exercise database reads with workbook
loading unavailable. Update workbook-based tests to use dedicated fixtures or
the retained archive at that time. Run type checking, tests, and a production
build with the database configured before deploying that removal.

Before cutover, a failed import can be rolled back and spreadsheet use can
continue. After database-only games are entered, switching back to the old
workbooks would lose those new records from the application. Restore a database
backup or repair the connection instead of falling back to stale spreadsheets.
Removing files from the repository does not erase Git history or archived copies.
