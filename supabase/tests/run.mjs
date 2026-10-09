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
    await db.exec(await readFile(new URL(`migrations/${migration}`, root), 'utf8'));
  }
  await runSuite('assertions.sql');
  await runSuite('link-verification-assertions.sql');
  console.log(`Postgres integration tests passed: ${total} assertions (JWT roles, RLS, tenant isolation, atomic games, audit, user profiles, admin promotion, player claims).`);
} finally {
  await db.close();
}
