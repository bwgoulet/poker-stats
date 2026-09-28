# Poker Stats

A read-only Next.js dashboard that turns the league's season workbooks into player, game, and all-time statistics. Workbooks remain the source of truth: the application discovers and normalizes them at runtime and does not write back to them.

## Prerequisites

- Node.js 20.9 or newer
- npm (the lockfile is committed; use `npm ci` for reproducible installs)
- The season `.xlsx` files in `data/`

## Local development

Run commands from the repository root:

```bash
npm ci
npm run dev       # development server at http://localhost:3000
npm run lint      # TypeScript check (same check as npm run typecheck)
npm test          # Vitest suite, run once
npm run build     # production Next.js build
```

The dashboard reads the workbooks on the server. Restart the development server after replacing a workbook if cached data does not update.

## Workbook location and schema

Put source workbooks directly in `data/`. The importer automatically reads filenames that match `<season>-<year>.xlsx`; files in subdirectories or with other extensions are ignored. See the generated [data mapping](docs/data-mapping.md) for the sheet-by-sheet mapping and known source ambiguities.

Ingested worksheets must use one of these names:

- `Stats $10`, `Stats $20`, or `Stats $50` for standard nights
- A name beginning with `One-offs` for one-off nights

Each ingested sheet is organized as date-header rows followed by player-result rows. A date header has a date in column B or C and an empty column A (or `Player` in column A). Result rows use:

| Column | Expected value | Normalized field |
| --- | --- | --- |
| A | Player name | Player alias and ID |
| C | Non-negative buy-in | `buyIn` |
| D | Non-negative cash-out/end value | `cashOut` |
| E | Net result (optional if C and D are valid) | `profit` |

Totals and other worksheets are not ingested. If Net is absent or malformed, profit is calculated as cash-out minus buy-in. Placement is inferred by sorting a night's profit from highest to lowest; it is not read from the workbook.

## Season naming and filters

Use a lowercase season ID ending in a four-digit year, for example `fall-2026.xlsx` or `winter-league-2027.xlsx`. The complete filename rule is `[a-z][a-z0-9-]*-YYYY.xlsx` (case-insensitive on discovery and normalized to lowercase). The season ID becomes the filename without `.xlsx` and is used in URLs and filter values.

### Add a season

1. Copy the completed workbook to `data/<season>-<year>.xlsx` and preserve the worksheet/column layout above.
2. Run `npm test` and `npm run build` to exercise discovery, normalization, schema validation, and production rendering.
3. Start or restart `npm run dev`, open `http://localhost:3000`, and expand the **Season** filter.
4. Confirm the new season label is present, select it, and verify that its games and players appear. No season registry or application-code change is required.

## Player aliases

Player names are trimmed, lowercased, and converted to URL-safe slugs. All source spellings encountered for a canonical ID are retained as aliases, while the shortest spelling is used as the display name. Add deliberate merges or special cases to `PLAYER_ALIAS_OVERRIDES` in `src/lib/data/player-aliases.ts`; keys must be trimmed lowercase source names and values must be canonical player IDs. Review carefully before merging similarly named people—unlisted names are treated as distinct players. The source placeholder `Player` maps to `unknown-player`.

## Validation and data quality

Normalization validates players, nights, and results with Zod. Dates become `YYYY-MM-DD`; season IDs must follow the naming rule; night types are limited to `10`, `20`, `50`, `online`, and `one-off`; monetary values must be finite, and buy-ins/cash-outs cannot be negative.

Rows without a usable buy-in or cash-out are skipped and recorded as warnings. A missing/malformed Net value is derived from cash-out minus buy-in. Each night is reconciled after import, and a non-zero profit sum (outside one cent) produces a warning. Schema violations throw and fail the request/build/test rather than silently accepting invalid normalized data. Source workbooks are never modified. See the generated [data quality report](docs/data-quality-report.md) for the documented issues.

## Generated documentation

Run the documentation generator after changing the source workbook structure:

```bash
node scripts/generate-docs.mjs
```

It regenerates [the workbook data mapping](docs/data-mapping.md) and [the data quality report](docs/data-quality-report.md) for the workbook filenames configured in `scripts/generate-docs.mjs`. Add a new workbook to that script’s file list before generating, and review generated changes before committing them. The [player classification report](docs/player-classification-report.md) documents all-time classifications, eligibility, and the classification matrix; update it whenever workbook data or classification boundaries change.

## Testing

The Vitest suite covers workbook discovery and normalization, filtering, formatting, statistics, ranking, and player classification. Run both the tests and the production build before submitting data or code changes:

```bash
npm test
npm run lint
npm run build
```

When adding a workbook, also perform the season-filter check in [Add a season](#add-a-season); unit tests verify automatic discovery, but the browser check confirms the server loaded the file and exposed it in the UI.

## Deployment

Deploy as a Node.js Next.js application (for example, on Vercel):

1. Commit the required `data/*.xlsx` workbooks; they must be available to the build and server runtime.
2. Install with `npm ci` and use `npm run build` as the build command.
3. Deploy the generated Next.js application using the hosting provider's standard Next.js runtime.
4. After deployment, open the dashboard, check the season filters, and inspect the **Data quality** count on the Stats page.

There are no required environment variables. Workbook access uses the repository-relative `data/` directory, so a static-export-only host is not the intended deployment target.
