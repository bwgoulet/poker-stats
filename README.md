# Poker Stats

**A multi-season poker analytics dashboard built from messy real-world spreadsheet data.**

Poker Stats turns our home game's historical Excel workbooks into a searchable analytics application with player profiles, game history, league-wide statistics, head-to-head comparisons, interactive charts, and data-driven player classifications.

The application includes a Supabase-backed league management portal at `/manage` for game and result CRUD. Sign up at `/auth/signup` and link your player pages from `/account`. New accounts default to `player`; a project administrator can promote `public.users.role` to `admin` to manage games across leagues. Supabase is required and is the source of truth for league analytics. The original spreadsheets have been retired from the deployed source; missing database configuration or outages display an error rather than stale history.

See [Backend setup](docs/backend-setup.md) for the schema, authentication and roles, safe historical import, and database validation. All historical records migrate into **UNC Poker**; additional leagues have isolated games, players, and membership.

---

## Why I built it

Our poker group had been tracking every game in Excel for well over a year.

That worked fine for recording results, but it became increasingly difficult to answer questions like:

**Who has actually won the most money? How has someone performed over time? Who has the highest ROI? Who plays the most? How volatile are different players? How do two players compare? What does someone's playing style look like across dozens of nights?**

Instead of replacing the spreadsheets, I built an application around them.

It began as a read-only analytics layer over the workbooks. It now records games and reads league analytics from Supabase, while retaining the original importer for external archives.

---

## Stack

| Area | Technology |
| --- | --- |
| Framework | Next.js |
| UI | React, TypeScript |
| Styling | Tailwind CSS |
| Charts | Recharts |
| Offline archive import | SheetJS / `xlsx` (development tooling only) |
| Validation | Zod |
| Testing | Vitest |
| Data source | Supabase Postgres |
| Database and authentication | Supabase Postgres, RLS, Supabase Auth |

---

## Historical import pipeline

The historical spreadsheets were normalized once and imported by migration `202610090004`. Live pages read Supabase directly. The pipeline below describes the retained offline importer, which accepts an external archive directory with `npm run db:export -- --input-dir /path/to/archive`.

```text
/path/to/archive/*.xlsx
     │
     ▼
Workbook discovery
     │
     ▼
Sheet parsing
     │
     ▼
Date / money normalization
     │
     ▼
Player alias resolution
     │
     ▼
Game + result model
     │
     ▼
Zod validation
     │
     ├──────────► Data-quality warnings
     │
     ▼
Statistics engine
     │
     ▼
Next.js dashboards
```

Season files follow a simple naming convention:

```text
/path/to/archive/
├── fall-2025.xlsx
├── spring-2026.xlsx
├── summer-2026.xlsx
└── fall-2026.xlsx
```

The offline importer discovers matching archived workbooks automatically. Live seasons are derived from database games entered through Manage league.

```ts
const SEASON_WORKBOOK = /^([a-z][a-z0-9-]*-\d{4})\.xlsx$/i;
```

This keeps ingestion driven by the data itself rather than by a growing list of hard-coded seasons.

---

## Normalizing inconsistent spreadsheets

The original workbooks evolved along with the poker game.

Different seasons contain different combinations of:

```text
Stats $10
Stats $20
Stats $50
Online
One-offs
Totals
```

The importer only consumes the sheets containing individual game results and ignores aggregate sheets that would duplicate existing data.

Each game is normalized into a consistent structure containing its season, date, game type, players, buy-ins, cash-outs, profit, and inferred placement.

For each result:

```text
Workbook row
    ↓
Player name
Buy-in
Cash-out
Net
    ↓
Canonical player
Normalized currency
Calculated profit
Game relationship
    ↓
PlayerResult
```

When a workbook contains a valid `Net` value, that value is preserved. Otherwise profit is derived from:

```text
cashOut - buyIn
```

Malformed rows are skipped and surfaced as validation issues rather than silently contaminating the statistics.

---

## Player identity and aliases

Real spreadsheet data is rarely perfectly consistent.

A single player may appear under different spellings, abbreviations, or names across multiple seasons.

The ingestion layer canonicalizes names into stable player IDs and supports explicit alias overrides:

```ts
export function canonicalPlayerId(name: string) {
  const key = name.trim().toLowerCase();
  return PLAYER_ALIAS_OVERRIDES[key] ?? slugifyName(name);
}
```

This lets historical workbooks remain untouched while the application treats equivalent records as one player.

---

## Statistics engine

Once workbook data has been normalized, the statistics layer derives player-, game-, and league-level metrics.

Player statistics include total profit, total buy-in, cash-out, ROI, average and median profit, win rate, wins and losses, championships, volatility, biggest win and loss, streaks, attendance, first and most recent appearance, and recent form.

League statistics include total games, total money put into play, average and largest pots, active players, total entries, average attendance, and the most recent game date.

Game-level views derive each night's total pot, results, placement order, winner, largest loss, and average buy-in.

All statistics are calculated from the normalized source records rather than being stored separately.

---

## Player classification model

One of the more experimental parts of the project is a field-relative player classification system.

Instead of assigning a player type based on arbitrary dollar thresholds, the model compares each eligible player against the rest of the league using two normalized measurements:

| Measurement | Meaning |
| --- | --- |
| **Buy-in intensity** | Average number of nominal buy-ins committed per qualifying night |
| **Outcome swing** | Robust dispersion of profit measured in buy-in units |

Outcome swing uses median absolute deviation rather than ordinary standard deviation:

```text
Outcome Swing = 1.4826 × MAD(profit in buy-in units)
```

That makes the metric less sensitive to a single extreme poker result.

Players are assigned percentile ranks within the eligible field for both measurements. The bottom 25%, middle 50%, and top 25% create a 3×3 classification matrix:

| Buy-in intensity | Low swing | Typical swing | High swing |
| --- | --- | --- | --- |
| Low | NIT | One-Bullet | Gambler |
| Typical | Steady | Neutral | Chemical X |
| High | Whale | Action Player | Maniac |

A player needs at least **5 qualifying nights** to receive a classification.

Classifications between 5 and 14 games are marked **provisional**. At 15+ qualifying games they become **established**.

The labels are intentionally poker-flavored; the underlying measurements and percentiles remain visible so the classification can be interpreted rather than treated as a black box.

---

## Filtering and comparisons

The application supports filtering statistics by season and game type, including:

```text
$10 games
$20 games
$50 games
Online games
One-offs
```

The selected scope propagates through the statistics views so rankings, player metrics, charts, and comparisons are calculated against the same filtered dataset.

Player comparison pages make it possible to inspect two players side-by-side rather than relying only on an overall leaderboard.

---

## Data quality

Because the project operates on hand-maintained spreadsheets, validation is treated as part of the ingestion process rather than an afterthought.

Every normalized player, game, and result is checked with Zod.

Poker nights are also financially reconciled:

```ts
sum(player profits) === 0
```

If a night does not reconcile, the application records a warning rather than modifying the source workbook.

Other known ambiguities—such as malformed payouts, inconsistent historical dates, or unknown player placeholders—are documented under:

```text
docs/
├── data-mapping.md
├── data-quality-report.md
└── player-classification-report.md
```

The source workbooks are never rewritten by the application.

---

## Real-world data

The four source workbooks were removed after the verified database import. They remain recoverable from Git history; keep an organizer-controlled archive outside the application for historical review. No deployed page or build requires Excel files.

Historical parity tests use `test/fixtures/historical-data.json`, a frozen normalization snapshot. Small synthetic workbook tests exercise the offline parser. The SQL migration, manifest and verification query remain committed under `supabase/`.

See [Historical data review](docs/data-quality-report.md) for the missing payout, preserved Net discrepancies and game reconciliation checklist.

---

## Testing

The project includes Vitest coverage around the pieces where subtle data errors would matter most:

```text
test/
├── filter-data.test.ts
├── formatting.test.ts
├── normalize-workbooks.test.ts
├── player-classification.test.ts
├── player-ranking.test.ts
└── statistics.test.ts
```

The tests cover workbook discovery, spreadsheet normalization, online-game detection, filtering, rankings, financial statistics, streak calculations, player classifications, minimum sample sizes, tied values, and edge cases.

Run them with:

```bash
npm test
```

Type-check the application with:

```bash
npm run typecheck
```

And create a production build with:

```bash
npm run build
```

---

## Repository structure

```text
supabase/
├── migrations/                    # Schema and frozen historical import
└── imports/                       # Import manifest and verification SQL

docs/
├── data-mapping.md
├── data-quality-report.md
└── player-classification-report.md

src/
├── app/
│   ├── compare/                   # Player comparisons
│   ├── dashboard/                 # League dashboard
│   ├── games/                     # Game history + individual nights
│   ├── players/                   # Player directory + profiles
│   └── stats/                     # Statistics views
│
├── components/
│   ├── charts/
│   ├── filters/
│   ├── layout/
│   └── players/
│
├── lib/
│   ├── data/                      # Workbook ingestion + validation
│   ├── filters/
│   ├── formatting/
│   └── stats/                     # Statistics + classifications
│
└── types/

test/
```

---

## Running locally

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

Before starting, copy `.env.example` to `.env.local` and configure your Supabase project URL and publishable key. Follow [Backend setup](docs/backend-setup.md) for migrations and authentication. Supabase is required for local league pages as well as production. Tests use isolated fixtures and an in-memory PostgreSQL instance; they need no live project or spreadsheet archive.

---

## What I wanted to explore

This project started as a way to make our poker spreadsheets easier to use, but it turned into a useful exercise in designing software around imperfect data.

The interesting engineering problem wasn't rendering a leaderboard. It was building a trustworthy layer between several generations of human-maintained spreadsheets and the statistics shown to users:

```text
messy source data
        ↓
defensive ingestion
        ↓
consistent domain model
        ↓
validated analytics
        ↓
useful interface
```

New games are recorded through Manage league. The original normalization tools remain available for reviewing archived source data.
