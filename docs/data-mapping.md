# Data Mapping

## fall-2025.xlsx

Worksheets: `Stats $10`, `Stats $20`, `Totals $10`, `(UNFINISHED -> check combined) `, `Totals Combined`, `One-offs (not in totals)`.

### Stats $10

Range A1:E1000. Rows are grouped by date header rows, followed by player result rows. Columns map as: A `Player` -> source player alias; C `Buy-in` -> PlayerResult.buyIn; D `End` -> PlayerResult.cashOut; E `Net` -> PlayerResult.profit. Date headers in B or C create PokerNight records. Placement is inferred by profit order because no explicit placement column exists.

### Stats $20

Range A1:E1002. Rows are grouped by date header rows, followed by player result rows. Columns map as: A `Player` -> source player alias; C `Buy-in` -> PlayerResult.buyIn; D `End` -> PlayerResult.cashOut; E `Net` -> PlayerResult.profit. Date headers in B or C create PokerNight records. Placement is inferred by profit order because no explicit placement column exists.

### Totals $10

Range A1:M1000. Summary-only sheet used for verification and not ingested as individual results. Columns contain aggregate buy-in/end/net/rank blocks, including sorted duplicate blocks to the right.

### (UNFINISHED -> check combined) 

Range A1:D1000. Ambiguous/unfinished sheet; not ingested.

### Totals Combined

Range A1:Y3003. Summary-only sheet used for verification and not ingested as individual results. Columns contain aggregate buy-in/end/net/rank blocks, including sorted duplicate blocks to the right.

### One-offs (not in totals)

Range A1:E58. Rows are grouped by date header rows, followed by player result rows. Columns map as: A `Player` -> source player alias; C `Buy-in` -> PlayerResult.buyIn; D `End` -> PlayerResult.cashOut; E `Net` -> PlayerResult.profit. Date headers in B or C create PokerNight records. Placement is inferred by profit order because no explicit placement column exists.

## spring-2026.xlsx

Worksheets: `Stats $10`, `Stats $20`, `Stats $50`, `Totals $10`, `Totals $20`, `Totals $50`, `Totals Combined`, `Totals Combined (w$50)`, `One-offs (not in totals)`.

### Stats $10

Range A1:E898. Rows are grouped by date header rows, followed by player result rows. Columns map as: A `Player` -> source player alias; C `Buy-in` -> PlayerResult.buyIn; D `End` -> PlayerResult.cashOut; E `Net` -> PlayerResult.profit. Date headers in B or C create PokerNight records. Placement is inferred by profit order because no explicit placement column exists.

### Stats $20

Range A1:E929. Rows are grouped by date header rows, followed by player result rows. Columns map as: A `Player` -> source player alias; C `Buy-in` -> PlayerResult.buyIn; D `End` -> PlayerResult.cashOut; E `Net` -> PlayerResult.profit. Date headers in B or C create PokerNight records. Placement is inferred by profit order because no explicit placement column exists.

### Stats $50

Range A1:E929. Rows are grouped by date header rows, followed by player result rows. Columns map as: A `Player` -> source player alias; C `Buy-in` -> PlayerResult.buyIn; D `End` -> PlayerResult.cashOut; E `Net` -> PlayerResult.profit. Date headers in B or C create PokerNight records. Placement is inferred by profit order because no explicit placement column exists.

### Totals $10

Range A1:M1000. Summary-only sheet used for verification and not ingested as individual results. Columns contain aggregate buy-in/end/net/rank blocks, including sorted duplicate blocks to the right.

### Totals $20

Range A1:M1000. Summary-only sheet used for verification and not ingested as individual results. Columns contain aggregate buy-in/end/net/rank blocks, including sorted duplicate blocks to the right.

### Totals $50

Range A1:M1000. Summary-only sheet used for verification and not ingested as individual results. Columns contain aggregate buy-in/end/net/rank blocks, including sorted duplicate blocks to the right.

### Totals Combined

Range A1:Y3001. Summary-only sheet used for verification and not ingested as individual results. Columns contain aggregate buy-in/end/net/rank blocks, including sorted duplicate blocks to the right.

### Totals Combined (w$50)

Range A1:AE3003. Summary-only sheet used for verification and not ingested as individual results. Columns contain aggregate buy-in/end/net/rank blocks, including sorted duplicate blocks to the right.

### One-offs (not in totals)

Range A1:E53. Rows are grouped by date header rows, followed by player result rows. Columns map as: A `Player` -> source player alias; C `Buy-in` -> PlayerResult.buyIn; D `End` -> PlayerResult.cashOut; E `Net` -> PlayerResult.profit. Date headers in B or C create PokerNight records. Placement is inferred by profit order because no explicit placement column exists.

## Normalized model

Players are canonicalized by trimmed lowercase name slug with explicit overrides in `src/lib/data/player-aliases.ts`. Nights are keyed by season, night type, and date. One-offs are included with nightType `one-off` and notes indicating workbook totals exclude them. Profit defaults to workbook Net when valid; otherwise `cashOut - buyIn`. Malformed rows are skipped and reported.

## Ambiguities

The workbooks do not provide explicit placements, so placement is inferred from descending profit. The spring one-off date labels show 2025 inside the spring-2026 workbook; they are preserved as parsed dates and flagged by season context. Placeholder player name `Player` is retained as `unknown-player` rather than merged.
