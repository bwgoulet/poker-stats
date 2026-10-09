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
  for (const migration of migrations) {
    await db.exec(await readFile(new URL(`migrations/${migration}`, root), 'utf8'));
  }
  const results = await db.exec(await readFile(new URL('tests/assertions.sql', root), 'utf8'));
  const passed = results.flatMap(({ rows }) => rows).find((row) => 'passed_assertions' in row);
  if (!passed) throw new Error('SQL tests did not produce their assertion count.');
  console.log(`Postgres integration tests passed: ${passed.passed_assertions} assertions (JWT roles, RLS, tenant isolation, validation, atomic RPCs, optimistic locking, audit).`);
} finally {
  await db.close();
}
