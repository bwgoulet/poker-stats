# Historical data review

This is a review of the frozen spreadsheet import, not a query of later live database edits. The import contains 49 players, 62 completed games and 696 valid results. Source discrepancies were preserved rather than adjusted. The migration manifest and verification SQL remain the comparison baseline.

## One missing result

Drew, October 3, 2025, fall 2025 one-off: the source has a **$50 buy-in**, but cash-out and Net are both `?`. This row was excluded from game results because the payout cannot be determined. It is recorded in the manifest at `fall-2025.xlsx` → `One-offs (not in totals)` → row 6. Drew’s other results and player profile remain imported.

Find the actual cash-out from the organizer, player, or payment records. Once confirmed, add Drew’s $50 buy-in and real payout to `fall-2025-one-off-2025-10-03`, and review every other result in that game. Do not enter zero solely to fill the blank or infer a payout from an already inconsistent total.

## Six preserved Net discrepancies

These rows have known buy-ins and cash-outs, but the spreadsheet Net differs from cash-out minus buy-in. Historical standings currently use the recorded Net via `legacy_profit_cents`. Confirm which original figure is wrong before correcting it.

| Season / date / game | Player | Buy-in | Cash-out | Recorded Net | Cash-out − buy-in |
| --- | --- | ---: | ---: | ---: | ---: |
| fall-2025 / 2025-10-10 / one-off | Tim | $40.00 | $19.90 | -$21.10 | -$20.10 |
| fall-2025 / 2025-10-16 / 20 | Chris | $30.00 | $15.40 | -$15.60 | -$14.60 |
| fall-2025 / 2025-10-27 / one-off | Tim | $10.00 | $0.00 | $0.00 | -$10.00 |
| spring-2026 / 2026-02-04 / 20 | Drew | $43.00 | $25.60 | -$19.40 | -$17.40 |
| summer-2026 / 2026-08-16 / 20 | Tim | $40.00 | $10.90 | -$31.10 | -$29.10 |
| fall-2026 / 2026-09-03 / one-off | Tim | $60.00 | $111.60 | $56.60 | $51.60 |

## Games needing reconciliation

The management portal’s **Imported · needs reconciliation** label applies to 39 imported games: total cash-outs differ from total buy-ins, or a result has a Net override. Separately, 39 games have nonzero recorded Net totals. These sets overlap. The manifest’s 40 normalizer warnings are one excluded row plus 39 nonzero-Net games; they are not 40 missing results.

Positive values below mean payouts/profits exceed buy-ins; negative values mean they fall short. Review the source records, missing entries, rounding, fees, and transfers rather than forcing totals to zero.

| Game ID | Cash-outs − buy-ins | Sum of recorded Net | Net overrides |
| --- | ---: | ---: | ---: |
| `fall-2025-10-2025-08-27` | -$0.25 | -$0.25 | 0 |
| `fall-2025-20-2025-09-03` | -$0.35 | -$0.35 | 0 |
| `fall-2025-10-2025-09-10` | -$0.05 | -$0.05 | 0 |
| `fall-2025-20-2025-09-17` | $1.50 | $1.50 | 0 |
| `fall-2025-10-2025-09-22` | $0.15 | $0.15 | 0 |
| `fall-2025-one-off-2025-10-03` | $13.90 | $13.90 | 0 |
| `fall-2025-one-off-2025-10-10` | $0.00 | -$1.00 | 1 |
| `fall-2025-20-2025-10-16` | -$0.40 | -$1.40 | 1 |
| `fall-2025-10-2025-10-23` | -$3.00 | -$3.00 | 0 |
| `fall-2025-one-off-2025-10-27` | $0.00 | $10.00 | 1 |
| `fall-2025-20-2025-11-05` | -$2.00 | -$2.00 | 0 |
| `fall-2025-10-2025-11-13` | $0.50 | $0.50 | 0 |
| `fall-2025-20-2025-11-20` | -$5.00 | -$5.00 | 0 |
| `fall-2025-10-2025-11-24` | $0.50 | $0.50 | 0 |
| `fall-2025-one-off-2025-12-07` | $19.40 | $19.40 | 0 |
| `spring-2026-20-2026-01-07` | $1.00 | $1.00 | 0 |
| `spring-2026-10-2026-01-14` | $0.25 | $0.25 | 0 |
| `spring-2026-10-2026-01-28` | $9.00 | $9.00 | 0 |
| `spring-2026-one-off-2026-01-31` | -$1.00 | -$1.00 | 0 |
| `spring-2026-20-2026-02-04` | $0.00 | -$2.00 | 1 |
| `spring-2026-10-2026-02-11` | -$0.45 | -$0.45 | 0 |
| `spring-2026-20-2026-02-18` | $0.40 | $0.40 | 0 |
| `spring-2026-10-2026-02-25` | $0.35 | $0.35 | 0 |
| `spring-2026-20-2026-03-26` | $5.00 | $5.00 | 0 |
| `spring-2026-10-2026-04-01` | -$0.30 | -$0.30 | 0 |
| `spring-2026-20-2026-04-22` | $0.40 | $0.40 | 0 |
| `spring-2026-50-2026-05-03` | -$20.00 | -$20.00 | 0 |
| `summer-2026-10-2026-06-05` | -$0.25 | -$0.25 | 0 |
| `summer-2026-20-2026-06-30` | -$0.20 | -$0.20 | 0 |
| `summer-2026-20-2026-07-14` | $0.10 | $0.10 | 0 |
| `summer-2026-20-2026-07-28` | -$0.40 | -$0.40 | 0 |
| `summer-2026-20-2026-08-16` | $0.00 | -$2.00 | 1 |
| `fall-2026-20-2026-08-19` | -$3.00 | -$3.00 | 0 |
| `fall-2026-one-off-2026-08-20` | $0.25 | $0.25 | 0 |
| `fall-2026-20-2026-08-26` | -$1.00 | -$1.00 | 0 |
| `fall-2026-20-2026-09-02` | -$0.10 | -$0.10 | 0 |
| `fall-2026-one-off-2026-09-03` | $1.00 | $6.00 | 1 |
| `fall-2026-one-off-2026-09-30` | -$1.20 | -$1.20 | 0 |
| `fall-2026-one-off-2026-10-05` | $5.20 | $5.20 | 0 |

## Other source assumptions

Imported games use cash format because the sheets do not establish whether a game was a tournament. Placements were inferred from profit order, not recorded tournament finishes. Review these only where an organizer can confirm a different format or placement.


## Correcting an imported game

Use **Manage league** with an admin or scorekeeper account. Expand a flagged game to inspect its notes and results, confirm the source amounts, then edit the whole game. Completed games require all cash-outs and balanced total buy-ins/cash-outs. Saving an imported game replaces its result set and removes legacy Net overrides for every player in that game, recalculating profits from the submitted amounts. This can change historical rankings; do not use Save for a cosmetic edit until those amounts have been reviewed.

Keep a database backup and record the reason for each correction. The cleanup PR itself changes no live results. After intentional corrections, the frozen verification query will report changed rows; that is expected and should not be treated as a reason to rerun the import.
