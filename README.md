# Poker Stats

**A multi-season poker analytics dashboard built from messy real-world spreadsheet data.**

Poker Stats turns our home game's historical Excel workbooks into a searchable analytics application with player profiles, game history, league-wide statistics, head-to-head comparisons, interactive charts, and data-driven player classifications.

The application includes a Supabase-backed league management portal at `/manage` for game and result CRUD. Sign up at `/auth/signup` and link your player pages from `/account`. New accounts default to `player`; a project administrator can promote `public.users.role` to `admin` to manage games across leagues. Once configured, Supabase is the source of truth for league analytics. Without database configuration, the committed workbooks remain available as a read-only archive.

See [Backend setup](docs/backend-setup.md) for the schema, authentication and roles, safe historical import, and database validation. All historical records migrate into **UNC Poker**; additional leagues have isolated games, players, and membership.

---

## Why I built it

Our poker group had been tracking every game in Excel for well over a year.

That worked fine for recording results, but it became increasingly difficult to answer questions like:

**Who has actually won the most money? How has someone performed over time? Who has the highest ROI? Who plays the most? How volatile are different players? How do two players compare? What does someone's playing style look like across dozens of nights?**

Instead of replacing the spreadsheets, I built an application around them.

The result is a read-only analytics layer that treats the existing workbooks as an ingestion format and converts them into a consistent domain model the rest of the application can use.

---

## Stack

| Area | Technology |
| --- | --- |
| Framework | Next.js |
| UI | React, TypeScript |
| Styling | Tailwind CSS |
| Charts | Recharts |
| Excel parsing | SheetJS / `xlsx` |
| Validation | Zod |
| Testing | Vitest |
| Data source | Multi-season Excel workbooks |
| Database and authentication | Supabase Postgres, RLS, Supabase Auth |

---

## Data pipeline

The core of the project is the normalization pipeline.

```text
data/*.xlsx
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
data/
├── fall-2025.xlsx
├── spring-2026.xlsx
├── summer-2026.xlsx
└── fall-2026.xlsx
```

The application discovers matching workbooks automatically, so adding another season does not require registering it in application code.

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

The `data/` directory intentionally contains the historical workbooks used by this instance of the project.

They provide a useful real-world example of the inconsistencies the ingestion layer was built to handle: changing worksheet structures, inconsistent player names, incomplete rows, new game formats, and several seasons of accumulated data.

If adapting this project for another poker group, replace the workbooks in `data/` with files following the same season naming convention and sheet structure.

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
data/
└── *.xlsx                         # Source workbooks

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

Because the workbooks are committed under `data/`, no external service is required to explore the read-only archive locally. To enable game entry and make the database authoritative, follow [Backend setup](docs/backend-setup.md). The earlier pipeline sections describe workbook ingestion used for that historical import.

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

That architecture lets the spreadsheets continue doing what they are good at—being easy to update—while the application handles the increasingly complicated analysis built on top of them.
