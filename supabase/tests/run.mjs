import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

// Postgres in WASM executes the actual migration, roles, RLS, FK constraints,
// PL/pgSQL RPCs, and transaction rollback. Supabase's auth helpers are the only
// platform-specific fixtures; no SQL implementation is mocked.
const db = new PGlite();
const root = new URL('../', import.meta.url);
try {
  await db.exec(await readFile(new URL('tests/bootstrap.sql', root), 'utf8'));
  const migrations = (await readdir(fileURLToPath(new URL('migrations/', root))))
    .filter((name) => name.endsWith('.sql')).sort();
  const versions = new Map();
  for (const migration of migrations) {
    const version = migration.match(/^(\d+)_/)?.[1];
    if (!version) throw new Error(`Invalid migration filename: ${migration}`);
    if (versions.has(version)) {
      throw new Error(`Duplicate migration version ${version}: ${versions.get(version)} and ${migration}`);
    }
    versions.set(version, migration);
  }
  let total = 0;
  async function runSuite(suite) {
    const results = await db.exec(await readFile(new URL(`tests/${suite}`, root), 'utf8'));
    const passed = results.flatMap(({ rows }) => rows).find((row) => 'passed_assertions' in row);
    if (!passed) throw new Error(`${suite} did not produce its assertion count.`);
    total += Number(passed.passed_assertions);
  }
  for (const migration of migrations) {
    // Test the old claim contract at its migration boundary, before claims
    // become requests. Each suite rolls back its fixtures.
    if (migration === '202610090003_discord_link_verification.sql') await runSuite('user-assertions.sql');
    // These suites use empty-league fixtures and roll them back. Run them at
    // the schema boundary before the production historical records are seeded.
    if (migration === '202610090004_import_historical_workbooks.sql') {
      // Exercise current game validation before seeding history. Migration 007
      // only replaces the RPC and is safe to apply again in filename order.
      await db.exec(await readFile(new URL('migrations/202610090007_allow_unbalanced_completed_games.sql', root), 'utf8'));
      // Apply current read policies before exercising public drafts and isolation.
      await db.exec(await readFile(new URL('migrations/202610090008_public_draft_games.sql', root), 'utf8'));
      await runSuite('assertions.sql');
      // Exercise the current link-review contract on empty-league fixtures.
      // Migration 006 only replaces the RPC and is safe to apply again below.
      await db.exec(await readFile(new URL('migrations/202610090006_admin_self_player_links.sql', root), 'utf8'));
      await runSuite('link-verification-assertions.sql');
    }
    await db.exec(await readFile(new URL(`migrations/${migration}`, root), 'utf8'));
  }
  console.log(`Postgres integration tests passed: ${total} assertions (JWT roles, RLS, tenant isolation, atomic games, audit, user profiles, admin promotion, player claims).`);
} finally {
  await db.close();
}
