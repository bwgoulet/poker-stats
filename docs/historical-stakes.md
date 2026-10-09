# Historical stakes and player big blinds

Apply `supabase/migrations/202610090007_classify_historical_stakes.sql` after the earlier migrations. It classifies all 17 imported UNC one-off/online games: 10 as $10, 7 as $20. A recorded $10 buy-in identifies a $10 game; games with no $10 entry are inferred as $20. Original import IDs and financial results are retained, and titles/notes preserve the original one-off/online context. Games now appear in the $10/$20 filters, including the default filter.

The migration increments game versions, audits changes, and is safe to rerun. It rejects unexpectedly edited source games and requires correction 005 first. No live database connection is configured in this workspace; apply the migration to the application's Supabase project to update live records.

Player pages show signed total and average BB for the selected filters. Per-game BB = recorded profit / big blind, with owner-confirmed blinds of $0.10 for $10 games and $0.20 for $20 games. Average BB is the mean per qualifying game (including breakeven games), not BB/100 hands. $50 games, unclassified online/one-off games and tournaments are excluded because their cash-game blind amounts are undefined. With no qualifying games the value is a dash.
