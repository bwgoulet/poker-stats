# Historical corrections and counting differences

Migration `202610090005_correct_historical_results.sql` applies owner-confirmed corrections after the frozen import. After it is applied, the original history has **49 players, 62 games and 697 results**, with no missing Drew payout or legacy Net overrides. These are expected snapshot counts, not a query of later database edits.

## Drew’s confirmed result

October 3, 2025 one-off (`fall-2025-one-off-2025-10-03`): Drew bought in for **$50.00** and cashed out **$36.10**, a **-$13.90 loss**. The original row had unknown cash-out and Net and was excluded from migration 004. Migration 005 adds the confirmed result. This balances that game’s previously recorded $13.90 surplus.

## Six corrected Net figures

The owner confirmed that cash-out minus buy-in is authoritative. Migration 005 clears only these six spreadsheet Net overrides; the existing buy-ins and cash-outs remain unchanged.

| Player | Game date | Previous Net | Corrected profit |
| --- | --- | ---: | ---: |
| Tim | 2025-10-10 | -$21.10 | -$20.10 |
| Chris | 2025-10-16 | -$15.60 | -$14.60 |
| Tim | 2025-10-27 | $0.00 | -$10.00 |
| Drew | 2026-02-04 | -$19.40 | -$17.40 |
| Tim | 2026-08-16 | -$31.10 | -$29.10 |
| Tim | 2026-09-03 | $56.60 | $51.60 |

Cash placements in the seven affected games are refreshed from corrected profit, retaining the existing tie order. Game versions advance to prevent stale editors overwriting these corrections. Before/after audit records and original import notes are retained. Exact migration reruns change no records, notes, versions or audit entries. Conflicting portal edits abort the whole transaction for review.

## Retained live-game counting differences

After the corrections, **34 games** retain nonzero buy-in/cash-out totals. The owner identified these as counting errors from the live games; they are recorded for transparency without inventing adjustments. They do not block viewing historical standings.

The game subheader reads **Buy-in/cash-out mismatch**. Expanding it shows total buy-ins, total cash-outs, and the exact difference with its direction. Import provenance and original notes remain inside the expansion. A pending payout is shown as pending rather than interpreted as a zero payout.

Positive differences below mean cash-outs exceed buy-ins; negative differences mean cash-outs fall short.

| Game ID | Cash-outs − buy-ins |
| --- | ---: |
| `fall-2025-10-2025-08-27` | -$0.25 |
| `fall-2025-10-2025-09-10` | -$0.05 |
| `fall-2025-10-2025-09-22` | $0.15 |
| `fall-2025-10-2025-10-23` | -$3.00 |
| `fall-2025-10-2025-11-13` | $0.50 |
| `fall-2025-10-2025-11-24` | $0.50 |
| `fall-2025-20-2025-09-03` | -$0.35 |
| `fall-2025-20-2025-09-17` | $1.50 |
| `fall-2025-20-2025-10-16` | -$0.40 |
| `fall-2025-20-2025-11-05` | -$2.00 |
| `fall-2025-20-2025-11-20` | -$5.00 |
| `fall-2025-one-off-2025-12-07` | $19.40 |
| `fall-2026-20-2026-08-19` | -$3.00 |
| `fall-2026-20-2026-08-26` | -$1.00 |
| `fall-2026-20-2026-09-02` | -$0.10 |
| `fall-2026-one-off-2026-08-20` | $0.25 |
| `fall-2026-one-off-2026-09-03` | $1.00 |
| `fall-2026-one-off-2026-09-30` | -$1.20 |
| `fall-2026-one-off-2026-10-05` | $5.20 |
| `spring-2026-10-2026-01-14` | $0.25 |
| `spring-2026-10-2026-01-28` | $9.00 |
| `spring-2026-10-2026-02-11` | -$0.45 |
| `spring-2026-10-2026-02-25` | $0.35 |
| `spring-2026-10-2026-04-01` | -$0.30 |
| `spring-2026-20-2026-01-07` | $1.00 |
| `spring-2026-20-2026-02-18` | $0.40 |
| `spring-2026-20-2026-03-26` | $5.00 |
| `spring-2026-20-2026-04-22` | $0.40 |
| `spring-2026-50-2026-05-03` | -$20.00 |
| `spring-2026-one-off-2026-01-31` | -$1.00 |
| `summer-2026-10-2026-06-05` | -$0.25 |
| `summer-2026-20-2026-06-30` | -$0.20 |
| `summer-2026-20-2026-07-14` | $0.10 |
| `summer-2026-20-2026-07-28` | -$0.40 |

## Applying and verifying the correction

Run the entire migration 005 in Supabase SQL Editor after migration 004, or apply it through the linked Supabase CLI migration workflow. Then run `supabase/imports/202610090005/verify.sql`: both counts must be 7 and `passed` must be true. The migration is scoped to UNC Poker and changes only the seven confirmed historical games. It does not balance or rewrite the other games.

The frozen migration 004 manifest and verification query describe the original spreadsheet import. They remain unchanged; their old counts and warnings are historical evidence. The original verification query will intentionally report changed rows after correction 005. Do not rerun the import to undo those corrections.

The regular game editor still requires balanced totals when saving completed games. These accepted historical counting differences are preserved in the database; this change does not relax validation for new completed games.
