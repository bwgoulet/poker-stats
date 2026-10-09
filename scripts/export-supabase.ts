import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { buildWorkbookImport } from '../src/lib/backend/import-workbooks';
import { buildWorkbookVerificationSql } from '../src/lib/backend/verify-workbooks';
import { discoverWorkbooks } from '../src/lib/data/load-workbooks';
import { normalizeWorkbooks } from '../src/lib/data/normalize-workbooks';

const { values } = parseArgs({ options: { 'input-dir': { type: 'string' }, 'output-dir': { type: 'string', default: 'work' }, help: { type: 'boolean', short: 'h' } } });
if (values.help) {
  console.log('Usage: npm run db:export -- --input-dir /path/to/archive [--output-dir work]\n\nExports archived workbook data to supabase-import.sql, supabase-import-manifest.json, and supabase-verify.sql.\nDoes not connect to Supabase or perform database writes.');
} else {
  if (!values['input-dir']) throw new Error('Provide --input-dir with the directory containing the archived workbooks.');
  const inputDir = resolve(values['input-dir']);
  const sources = discoverWorkbooks(inputDir).map((source) => ({
    ...source,
    sha256: createHash('sha256').update(readFileSync(resolve(inputDir, source.file))).digest('hex'),
  }));
  if (!sources.length) throw new Error('No season workbooks found in the archive directory. Nothing was exported.');
  const imported = buildWorkbookImport(normalizeWorkbooks(inputDir), { sources });
  const verificationSql = buildWorkbookVerificationSql(imported);
  for (const source of sources) {
    const currentHash = createHash('sha256').update(readFileSync(resolve(inputDir, source.file))).digest('hex');
    if (currentHash !== source.sha256) throw new Error(`Workbook ${source.file} changed during export. Run the export again.`);
  }
  const directory = resolve(values['output-dir']!);
  mkdirSync(directory, { recursive: true });
  const sqlPath = resolve(directory, 'supabase-import.sql');
  const manifestPath = resolve(directory, 'supabase-import-manifest.json');
  const verificationPath = resolve(directory, 'supabase-verify.sql');
  writeFileSync(sqlPath, imported.sql, 'utf8');
  writeFileSync(manifestPath, `${JSON.stringify(imported.manifest, null, 2)}\n`, 'utf8');
  writeFileSync(verificationPath, verificationSql, 'utf8');
  console.log(`Exported ${imported.manifest.counts.players} players, ${imported.manifest.counts.games} games, and ${imported.manifest.counts.results} results.`);
  console.log(`Preserved ${imported.manifest.counts.legacyProfitOverrides} source Net overrides and ${imported.manifest.counts.normalizerIssues} normalizer issues.`);
  console.log(`SQL: ${sqlPath}\nManifest: ${manifestPath}\nVerification: ${verificationPath}\nReview the manifest, apply the schema, then execute the complete SQL transaction manually.\nRun the complete verification file afterward; all three passed values must be true before cutover.`);
}
