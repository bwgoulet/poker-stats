-- UNC Poker workbook import. Review the companion manifest before execution.
-- Apply the application schema first. Execute all statements together in Supabase SQL Editor.
-- Identical imports are skipped; conflicting or portal-edited records abort the entire transaction.
begin;
set local standard_conforming_strings = on;
lock table public.leagues, public.players, public.games, public.game_results in share row exclusive mode;

create temporary table _poker_import_players (
  id text primary key, display_name text not null, aliases text[] not null
) on commit drop;
create temporary table _poker_import_games (
  id text primary key, title text not null, date date not null, season_id text not null,
  night_type text not null, format text not null, status text not null, notes text not null, source_ref text not null
) on commit drop;
create temporary table _poker_import_results (
  game_id text not null, player_id text not null, buy_in_cents bigint not null,
  cash_out_cents bigint not null, placement integer, legacy_profit_cents bigint,
  primary key (game_id, player_id)
) on commit drop;

insert into _poker_import_players (id, display_name, aliases) values
  ('aidan-pirc', 'Aidan Pirc', array['Aidan Pirc']::text[]),
  ('aiden', 'Aiden', array['Aiden']::text[]),
  ('avery', 'Avery', array['Avery']::text[]),
  ('ben', 'Ben', array['Ben']::text[]),
  ('brett', 'Brett', array['Brett']::text[]),
  ('caleb', 'Caleb', array['Caleb']::text[]),
  ('calen', 'Calen', array['Calen']::text[]),
  ('cam', 'Cam', array['Cam']::text[]),
  ('charlie', 'Charlie', array['Charlie']::text[]),
  ('choliver', 'Choliver', array['Choliver']::text[]),
  ('chris', 'Chris', array['Chris']::text[]),
  ('chris-s', 'Chris S', array['Chris S']::text[]),
  ('connor', 'Connor', array['Connor']::text[]),
  ('donovan', 'Donovan', array['Donovan']::text[]),
  ('drew', 'Drew', array['Drew']::text[]),
  ('favor', 'Favor', array['Favor']::text[]),
  ('gage', 'Gage', array['Gage']::text[]),
  ('grace', 'Grace', array['Grace']::text[]),
  ('jack', 'Jack', array['Jack']::text[]),
  ('jackson', 'Jackson', array['Jackson']::text[]),
  ('jake', 'Jake', array['Jake']::text[]),
  ('james', 'James', array['James']::text[]),
  ('joey', 'Joey', array['Joey']::text[]),
  ('johnny', 'Johnny 😎', array['Johnny 😎']::text[]),
  ('josh', 'Josh', array['Josh']::text[]),
  ('jp', 'JP', array['JP']::text[]),
  ('killian', 'Killian', array['Killian']::text[]),
  ('liv', 'Liv', array['Liv']::text[]),
  ('louis', 'Louis', array['Louis']::text[]),
  ('lucas', 'Lucas', array['Lucas']::text[]),
  ('maggie', 'Maggie', array['Maggie']::text[]),
  ('maria', 'Maria', array['Maria']::text[]),
  ('mason', 'Mason', array['Mason']::text[]),
  ('matthew', 'Matthew', array['Matthew']::text[]),
  ('max', 'Max', array['Max']::text[]),
  ('michael', 'Michael', array['Michael']::text[]),
  ('nathan', 'Nathan', array['Nathan']::text[]),
  ('owen', 'Owen', array['Owen']::text[]),
  ('parag', 'Parag', array['Parag']::text[]),
  ('raghav', 'Raghav', array['Raghav']::text[]),
  ('ryan', 'Ryan', array['Ryan']::text[]),
  ('sam', 'Sam', array['Sam']::text[]),
  ('stone', 'Stone', array['Stone']::text[]),
  ('tim', 'Tim', array['Tim']::text[]),
  ('tyler', 'Tyler', array['Tyler']::text[]),
  ('william', 'William', array['William']::text[]),
  ('zach', 'Zach', array['Zach']::text[]),
  ('zack', 'Zack', array['Zack']::text[]),
  ('zimmy', 'Zimmy', array['Zimmy']::text[]);

insert into _poker_import_games (id, title, date, season_id, night_type, format, status, notes, source_ref) values
  ('fall-2025-10-2025-08-27', '$10 night · 2025-08-27', '2025-08-27', 'fall-2025', '10', 'cash', 'completed', 'Imported from fall-2025.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.
Historical source Net does not reconcile (-25 cents); preserved without adjustment.
Historical cash flow does not reconcile (-25 cents); preserved without adjustment.', 'workbook:v1:fall-2025.xlsx#fall-2025-10-2025-08-27'),
  ('fall-2025-10-2025-09-10', '$10 night · 2025-09-10', '2025-09-10', 'fall-2025', '10', 'cash', 'completed', 'Imported from fall-2025.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.
Historical source Net does not reconcile (-5 cents); preserved without adjustment.
Historical cash flow does not reconcile (-5 cents); preserved without adjustment.', 'workbook:v1:fall-2025.xlsx#fall-2025-10-2025-09-10'),
  ('fall-2025-10-2025-09-22', '$10 night · 2025-09-22', '2025-09-22', 'fall-2025', '10', 'cash', 'completed', 'Imported from fall-2025.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.
Historical source Net does not reconcile (15 cents); preserved without adjustment.
Historical cash flow does not reconcile (15 cents); preserved without adjustment.', 'workbook:v1:fall-2025.xlsx#fall-2025-10-2025-09-22'),
  ('fall-2025-10-2025-10-07', '$10 night · 2025-10-07', '2025-10-07', 'fall-2025', '10', 'cash', 'completed', 'Imported from fall-2025.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.', 'workbook:v1:fall-2025.xlsx#fall-2025-10-2025-10-07'),
  ('fall-2025-10-2025-10-23', '$10 night · 2025-10-23', '2025-10-23', 'fall-2025', '10', 'cash', 'completed', 'Imported from fall-2025.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.
Historical source Net does not reconcile (-300 cents); preserved without adjustment.
Historical cash flow does not reconcile (-300 cents); preserved without adjustment.', 'workbook:v1:fall-2025.xlsx#fall-2025-10-2025-10-23'),
  ('fall-2025-10-2025-11-13', '$10 night · 2025-11-13', '2025-11-13', 'fall-2025', '10', 'cash', 'completed', 'Imported from fall-2025.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.
Historical source Net does not reconcile (50 cents); preserved without adjustment.
Historical cash flow does not reconcile (50 cents); preserved without adjustment.', 'workbook:v1:fall-2025.xlsx#fall-2025-10-2025-11-13'),
  ('fall-2025-10-2025-11-24', '$10 night · 2025-11-24', '2025-11-24', 'fall-2025', '10', 'cash', 'completed', 'Imported from fall-2025.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.
Historical source Net does not reconcile (50 cents); preserved without adjustment.
Historical cash flow does not reconcile (50 cents); preserved without adjustment.', 'workbook:v1:fall-2025.xlsx#fall-2025-10-2025-11-24'),
  ('fall-2025-20-2025-09-03', '$20 night · 2025-09-03', '2025-09-03', 'fall-2025', '20', 'cash', 'completed', 'Imported from fall-2025.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.
Historical source Net does not reconcile (-35 cents); preserved without adjustment.
Historical cash flow does not reconcile (-35 cents); preserved without adjustment.', 'workbook:v1:fall-2025.xlsx#fall-2025-20-2025-09-03'),
  ('fall-2025-20-2025-09-17', '$20 night · 2025-09-17', '2025-09-17', 'fall-2025', '20', 'cash', 'completed', 'Imported from fall-2025.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.
Historical source Net does not reconcile (150 cents); preserved without adjustment.
Historical cash flow does not reconcile (150 cents); preserved without adjustment.', 'workbook:v1:fall-2025.xlsx#fall-2025-20-2025-09-17'),
  ('fall-2025-20-2025-10-01', '$20 night · 2025-10-01', '2025-10-01', 'fall-2025', '20', 'cash', 'completed', 'Imported from fall-2025.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.', 'workbook:v1:fall-2025.xlsx#fall-2025-20-2025-10-01'),
  ('fall-2025-20-2025-10-16', '$20 night · 2025-10-16', '2025-10-16', 'fall-2025', '20', 'cash', 'completed', 'Imported from fall-2025.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.
Historical source Net does not reconcile (-140 cents); preserved without adjustment.
Historical cash flow does not reconcile (-40 cents); preserved without adjustment.
1 source Net value(s) differ from cash-out minus buy-in and are preserved as legacy_profit_cents.', 'workbook:v1:fall-2025.xlsx#fall-2025-20-2025-10-16'),
  ('fall-2025-20-2025-11-05', '$20 night · 2025-11-05', '2025-11-05', 'fall-2025', '20', 'cash', 'completed', 'Imported from fall-2025.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.
Historical source Net does not reconcile (-200 cents); preserved without adjustment.
Historical cash flow does not reconcile (-200 cents); preserved without adjustment.', 'workbook:v1:fall-2025.xlsx#fall-2025-20-2025-11-05'),
  ('fall-2025-20-2025-11-20', '$20 night · 2025-11-20', '2025-11-20', 'fall-2025', '20', 'cash', 'completed', 'Imported from fall-2025.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.
Historical source Net does not reconcile (-500 cents); preserved without adjustment.
Historical cash flow does not reconcile (-500 cents); preserved without adjustment.', 'workbook:v1:fall-2025.xlsx#fall-2025-20-2025-11-20'),
  ('fall-2025-one-off-2025-10-03', 'One-off · 2025-10-03', '2025-10-03', 'fall-2025', 'one-off', 'cash', 'completed', 'Excluded from workbook totals
Imported from fall-2025.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.
Historical source Net does not reconcile (1390 cents); preserved without adjustment.
Historical cash flow does not reconcile (1390 cents); preserved without adjustment.', 'workbook:v1:fall-2025.xlsx#fall-2025-one-off-2025-10-03'),
  ('fall-2025-one-off-2025-10-10', 'One-off · 2025-10-10', '2025-10-10', 'fall-2025', 'one-off', 'cash', 'completed', 'Excluded from workbook totals
Imported from fall-2025.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.
Historical source Net does not reconcile (-100 cents); preserved without adjustment.
1 source Net value(s) differ from cash-out minus buy-in and are preserved as legacy_profit_cents.', 'workbook:v1:fall-2025.xlsx#fall-2025-one-off-2025-10-10'),
  ('fall-2025-one-off-2025-10-27', 'One-off · 2025-10-27', '2025-10-27', 'fall-2025', 'one-off', 'cash', 'completed', 'Excluded from workbook totals
Imported from fall-2025.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.
Historical source Net does not reconcile (1000 cents); preserved without adjustment.
1 source Net value(s) differ from cash-out minus buy-in and are preserved as legacy_profit_cents.', 'workbook:v1:fall-2025.xlsx#fall-2025-one-off-2025-10-27'),
  ('fall-2025-one-off-2025-12-07', 'One-off · 2025-12-07', '2025-12-07', 'fall-2025', 'one-off', 'cash', 'completed', 'Excluded from workbook totals
Imported from fall-2025.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.
Historical source Net does not reconcile (1940 cents); preserved without adjustment.
Historical cash flow does not reconcile (1940 cents); preserved without adjustment.', 'workbook:v1:fall-2025.xlsx#fall-2025-one-off-2025-12-07'),
  ('fall-2025-one-off-2025-12-12', 'One-off · 2025-12-12', '2025-12-12', 'fall-2025', 'one-off', 'cash', 'completed', 'Excluded from workbook totals
Imported from fall-2025.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.', 'workbook:v1:fall-2025.xlsx#fall-2025-one-off-2025-12-12'),
  ('fall-2026-20-2026-08-19', '$20 night · 2026-08-19', '2026-08-19', 'fall-2026', '20', 'cash', 'completed', 'Imported from fall-2026.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.
Historical source Net does not reconcile (-300 cents); preserved without adjustment.
Historical cash flow does not reconcile (-300 cents); preserved without adjustment.', 'workbook:v1:fall-2026.xlsx#fall-2026-20-2026-08-19'),
  ('fall-2026-20-2026-08-26', '$20 night · 2026-08-26', '2026-08-26', 'fall-2026', '20', 'cash', 'completed', 'Imported from fall-2026.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.
Historical source Net does not reconcile (-100 cents); preserved without adjustment.
Historical cash flow does not reconcile (-100 cents); preserved without adjustment.', 'workbook:v1:fall-2026.xlsx#fall-2026-20-2026-08-26'),
  ('fall-2026-20-2026-09-02', '$20 night · 2026-09-02', '2026-09-02', 'fall-2026', '20', 'cash', 'completed', 'Imported from fall-2026.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.
Historical source Net does not reconcile (-10 cents); preserved without adjustment.
Historical cash flow does not reconcile (-10 cents); preserved without adjustment.', 'workbook:v1:fall-2026.xlsx#fall-2026-20-2026-09-02'),
  ('fall-2026-20-2026-09-09', '$20 night · 2026-09-09', '2026-09-09', 'fall-2026', '20', 'cash', 'completed', 'Imported from fall-2026.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.', 'workbook:v1:fall-2026.xlsx#fall-2026-20-2026-09-09'),
  ('fall-2026-20-2026-09-16', '$20 night · 2026-09-16', '2026-09-16', 'fall-2026', '20', 'cash', 'completed', 'Imported from fall-2026.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.', 'workbook:v1:fall-2026.xlsx#fall-2026-20-2026-09-16'),
  ('fall-2026-20-2026-09-23', '$20 night · 2026-09-23', '2026-09-23', 'fall-2026', '20', 'cash', 'completed', 'Imported from fall-2026.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.', 'workbook:v1:fall-2026.xlsx#fall-2026-20-2026-09-23'),
  ('fall-2026-20-2026-10-06', '$20 night · 2026-10-06', '2026-10-06', 'fall-2026', '20', 'cash', 'completed', 'Imported from fall-2026.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.', 'workbook:v1:fall-2026.xlsx#fall-2026-20-2026-10-06'),
  ('fall-2026-50-2026-10-04', '$50 night · 2026-10-04', '2026-10-04', 'fall-2026', '50', 'cash', 'completed', 'Imported from fall-2026.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.', 'workbook:v1:fall-2026.xlsx#fall-2026-50-2026-10-04'),
  ('fall-2026-one-off-2026-08-20', 'One-off · 2026-08-20', '2026-08-20', 'fall-2026', 'one-off', 'cash', 'completed', 'Excluded from workbook totals
Imported from fall-2026.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.
Historical source Net does not reconcile (25 cents); preserved without adjustment.
Historical cash flow does not reconcile (25 cents); preserved without adjustment.', 'workbook:v1:fall-2026.xlsx#fall-2026-one-off-2026-08-20'),
  ('fall-2026-one-off-2026-08-30', 'One-off · 2026-08-30', '2026-08-30', 'fall-2026', 'one-off', 'cash', 'completed', 'Excluded from workbook totals
Imported from fall-2026.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.', 'workbook:v1:fall-2026.xlsx#fall-2026-one-off-2026-08-30'),
  ('fall-2026-one-off-2026-09-03', 'One-off · 2026-09-03', '2026-09-03', 'fall-2026', 'one-off', 'cash', 'completed', 'Excluded from workbook totals
Imported from fall-2026.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.
Historical source Net does not reconcile (600 cents); preserved without adjustment.
Historical cash flow does not reconcile (100 cents); preserved without adjustment.
1 source Net value(s) differ from cash-out minus buy-in and are preserved as legacy_profit_cents.', 'workbook:v1:fall-2026.xlsx#fall-2026-one-off-2026-09-03'),
  ('fall-2026-one-off-2026-09-20', 'One-off · 2026-09-20', '2026-09-20', 'fall-2026', 'one-off', 'cash', 'completed', 'Excluded from workbook totals
Imported from fall-2026.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.', 'workbook:v1:fall-2026.xlsx#fall-2026-one-off-2026-09-20'),
  ('fall-2026-one-off-2026-09-26', 'One-off · 2026-09-26', '2026-09-26', 'fall-2026', 'one-off', 'cash', 'completed', 'Excluded from workbook totals
Imported from fall-2026.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.', 'workbook:v1:fall-2026.xlsx#fall-2026-one-off-2026-09-26'),
  ('fall-2026-one-off-2026-09-27', 'One-off · 2026-09-27', '2026-09-27', 'fall-2026', 'one-off', 'cash', 'completed', 'Excluded from workbook totals
Imported from fall-2026.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.', 'workbook:v1:fall-2026.xlsx#fall-2026-one-off-2026-09-27'),
  ('fall-2026-one-off-2026-09-30', 'One-off · 2026-09-30', '2026-09-30', 'fall-2026', 'one-off', 'cash', 'completed', 'Excluded from workbook totals
Imported from fall-2026.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.
Historical source Net does not reconcile (-120 cents); preserved without adjustment.
Historical cash flow does not reconcile (-120 cents); preserved without adjustment.', 'workbook:v1:fall-2026.xlsx#fall-2026-one-off-2026-09-30'),
  ('fall-2026-one-off-2026-10-05', 'One-off · 2026-10-05', '2026-10-05', 'fall-2026', 'one-off', 'cash', 'completed', 'Excluded from workbook totals
Imported from fall-2026.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.
Historical source Net does not reconcile (520 cents); preserved without adjustment.
Historical cash flow does not reconcile (520 cents); preserved without adjustment.', 'workbook:v1:fall-2026.xlsx#fall-2026-one-off-2026-10-05'),
  ('fall-2026-online-2026-09-27', 'Online · 2026-09-27', '2026-09-27', 'fall-2026', 'online', 'cash', 'completed', 'Imported from fall-2026.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.', 'workbook:v1:fall-2026.xlsx#fall-2026-online-2026-09-27'),
  ('spring-2026-10-2026-01-14', '$10 night · 2026-01-14', '2026-01-14', 'spring-2026', '10', 'cash', 'completed', 'Imported from spring-2026.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.
Historical source Net does not reconcile (25 cents); preserved without adjustment.
Historical cash flow does not reconcile (25 cents); preserved without adjustment.', 'workbook:v1:spring-2026.xlsx#spring-2026-10-2026-01-14'),
  ('spring-2026-10-2026-01-28', '$10 night · 2026-01-28', '2026-01-28', 'spring-2026', '10', 'cash', 'completed', 'Imported from spring-2026.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.
Historical source Net does not reconcile (900 cents); preserved without adjustment.
Historical cash flow does not reconcile (900 cents); preserved without adjustment.', 'workbook:v1:spring-2026.xlsx#spring-2026-10-2026-01-28'),
  ('spring-2026-10-2026-02-11', '$10 night · 2026-02-11', '2026-02-11', 'spring-2026', '10', 'cash', 'completed', 'Imported from spring-2026.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.
Historical source Net does not reconcile (-45 cents); preserved without adjustment.
Historical cash flow does not reconcile (-45 cents); preserved without adjustment.', 'workbook:v1:spring-2026.xlsx#spring-2026-10-2026-02-11'),
  ('spring-2026-10-2026-02-25', '$10 night · 2026-02-25', '2026-02-25', 'spring-2026', '10', 'cash', 'completed', 'Imported from spring-2026.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.
Historical source Net does not reconcile (35 cents); preserved without adjustment.
Historical cash flow does not reconcile (35 cents); preserved without adjustment.', 'workbook:v1:spring-2026.xlsx#spring-2026-10-2026-02-25'),
  ('spring-2026-10-2026-03-12', '$10 night · 2026-03-12', '2026-03-12', 'spring-2026', '10', 'cash', 'completed', 'Imported from spring-2026.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.', 'workbook:v1:spring-2026.xlsx#spring-2026-10-2026-03-12'),
  ('spring-2026-10-2026-04-01', '$10 night · 2026-04-01', '2026-04-01', 'spring-2026', '10', 'cash', 'completed', 'Imported from spring-2026.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.
Historical source Net does not reconcile (-30 cents); preserved without adjustment.
Historical cash flow does not reconcile (-30 cents); preserved without adjustment.', 'workbook:v1:spring-2026.xlsx#spring-2026-10-2026-04-01'),
  ('spring-2026-10-2026-04-15', '$10 night · 2026-04-15', '2026-04-15', 'spring-2026', '10', 'cash', 'completed', 'Imported from spring-2026.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.', 'workbook:v1:spring-2026.xlsx#spring-2026-10-2026-04-15'),
  ('spring-2026-20-2026-01-07', '$20 night · 2026-01-07', '2026-01-07', 'spring-2026', '20', 'cash', 'completed', 'Imported from spring-2026.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.
Historical source Net does not reconcile (100 cents); preserved without adjustment.
Historical cash flow does not reconcile (100 cents); preserved without adjustment.', 'workbook:v1:spring-2026.xlsx#spring-2026-20-2026-01-07'),
  ('spring-2026-20-2026-02-04', '$20 night · 2026-02-04', '2026-02-04', 'spring-2026', '20', 'cash', 'completed', 'Imported from spring-2026.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.
Historical source Net does not reconcile (-200 cents); preserved without adjustment.
1 source Net value(s) differ from cash-out minus buy-in and are preserved as legacy_profit_cents.', 'workbook:v1:spring-2026.xlsx#spring-2026-20-2026-02-04'),
  ('spring-2026-20-2026-02-18', '$20 night · 2026-02-18', '2026-02-18', 'spring-2026', '20', 'cash', 'completed', 'Imported from spring-2026.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.
Historical source Net does not reconcile (40 cents); preserved without adjustment.
Historical cash flow does not reconcile (40 cents); preserved without adjustment.', 'workbook:v1:spring-2026.xlsx#spring-2026-20-2026-02-18'),
  ('spring-2026-20-2026-03-05', '$20 night · 2026-03-05', '2026-03-05', 'spring-2026', '20', 'cash', 'completed', 'Imported from spring-2026.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.', 'workbook:v1:spring-2026.xlsx#spring-2026-20-2026-03-05'),
  ('spring-2026-20-2026-03-26', '$20 night · 2026-03-26', '2026-03-26', 'spring-2026', '20', 'cash', 'completed', 'Imported from spring-2026.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.
Historical source Net does not reconcile (500 cents); preserved without adjustment.
Historical cash flow does not reconcile (500 cents); preserved without adjustment.', 'workbook:v1:spring-2026.xlsx#spring-2026-20-2026-03-26'),
  ('spring-2026-20-2026-04-08', '$20 night · 2026-04-08', '2026-04-08', 'spring-2026', '20', 'cash', 'completed', 'Imported from spring-2026.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.', 'workbook:v1:spring-2026.xlsx#spring-2026-20-2026-04-08'),
  ('spring-2026-20-2026-04-22', '$20 night · 2026-04-22', '2026-04-22', 'spring-2026', '20', 'cash', 'completed', 'Imported from spring-2026.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.
Historical source Net does not reconcile (40 cents); preserved without adjustment.
Historical cash flow does not reconcile (40 cents); preserved without adjustment.', 'workbook:v1:spring-2026.xlsx#spring-2026-20-2026-04-22'),
  ('spring-2026-50-2026-01-21', '$50 night · 2026-01-21', '2026-01-21', 'spring-2026', '50', 'cash', 'completed', 'Imported from spring-2026.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.', 'workbook:v1:spring-2026.xlsx#spring-2026-50-2026-01-21'),
  ('spring-2026-50-2026-02-13', '$50 night · 2026-02-13', '2026-02-13', 'spring-2026', '50', 'cash', 'completed', 'Imported from spring-2026.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.', 'workbook:v1:spring-2026.xlsx#spring-2026-50-2026-02-13'),
  ('spring-2026-50-2026-05-03', '$50 night · 2026-05-03', '2026-05-03', 'spring-2026', '50', 'cash', 'completed', 'Imported from spring-2026.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.
Historical source Net does not reconcile (-2000 cents); preserved without adjustment.
Historical cash flow does not reconcile (-2000 cents); preserved without adjustment.', 'workbook:v1:spring-2026.xlsx#spring-2026-50-2026-05-03'),
  ('spring-2026-one-off-2026-01-16', 'One-off · 2026-01-16', '2026-01-16', 'spring-2026', 'one-off', 'cash', 'completed', 'Excluded from workbook totals
Imported from spring-2026.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.', 'workbook:v1:spring-2026.xlsx#spring-2026-one-off-2026-01-16'),
  ('spring-2026-one-off-2026-01-31', 'One-off · 2026-01-31', '2026-01-31', 'spring-2026', 'one-off', 'cash', 'completed', 'Excluded from workbook totals
Imported from spring-2026.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.
Historical source Net does not reconcile (-100 cents); preserved without adjustment.
Historical cash flow does not reconcile (-100 cents); preserved without adjustment.', 'workbook:v1:spring-2026.xlsx#spring-2026-one-off-2026-01-31'),
  ('spring-2026-one-off-2026-04-28', 'One-off · 2026-04-28', '2026-04-28', 'spring-2026', 'one-off', 'cash', 'completed', 'Excluded from workbook totals
Imported from spring-2026.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.', 'workbook:v1:spring-2026.xlsx#spring-2026-one-off-2026-04-28'),
  ('summer-2026-10-2026-06-05', '$10 night · 2026-06-05', '2026-06-05', 'summer-2026', '10', 'cash', 'completed', 'Imported from summer-2026.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.
Historical source Net does not reconcile (-25 cents); preserved without adjustment.
Historical cash flow does not reconcile (-25 cents); preserved without adjustment.', 'workbook:v1:summer-2026.xlsx#summer-2026-10-2026-06-05'),
  ('summer-2026-20-2026-06-30', '$20 night · 2026-06-30', '2026-06-30', 'summer-2026', '20', 'cash', 'completed', 'Imported from summer-2026.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.
Historical source Net does not reconcile (-20 cents); preserved without adjustment.
Historical cash flow does not reconcile (-20 cents); preserved without adjustment.', 'workbook:v1:summer-2026.xlsx#summer-2026-20-2026-06-30'),
  ('summer-2026-20-2026-07-14', '$20 night · 2026-07-14', '2026-07-14', 'summer-2026', '20', 'cash', 'completed', 'Imported from summer-2026.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.
Historical source Net does not reconcile (10 cents); preserved without adjustment.
Historical cash flow does not reconcile (10 cents); preserved without adjustment.', 'workbook:v1:summer-2026.xlsx#summer-2026-20-2026-07-14'),
  ('summer-2026-20-2026-07-18', '$20 night · 2026-07-18', '2026-07-18', 'summer-2026', '20', 'cash', 'completed', 'Imported from summer-2026.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.', 'workbook:v1:summer-2026.xlsx#summer-2026-20-2026-07-18'),
  ('summer-2026-20-2026-07-28', '$20 night · 2026-07-28', '2026-07-28', 'summer-2026', '20', 'cash', 'completed', 'Imported from summer-2026.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.
Historical source Net does not reconcile (-40 cents); preserved without adjustment.
Historical cash flow does not reconcile (-40 cents); preserved without adjustment.', 'workbook:v1:summer-2026.xlsx#summer-2026-20-2026-07-28'),
  ('summer-2026-20-2026-08-11', '$20 night · 2026-08-11', '2026-08-11', 'summer-2026', '20', 'cash', 'completed', 'Imported from summer-2026.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.', 'workbook:v1:summer-2026.xlsx#summer-2026-20-2026-08-11'),
  ('summer-2026-20-2026-08-16', '$20 night · 2026-08-16', '2026-08-16', 'summer-2026', '20', 'cash', 'completed', 'Imported from summer-2026.xlsx. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.
Historical source Net does not reconcile (-200 cents); preserved without adjustment.
1 source Net value(s) differ from cash-out minus buy-in and are preserved as legacy_profit_cents.', 'workbook:v1:summer-2026.xlsx#summer-2026-20-2026-08-16');

insert into _poker_import_results (game_id, player_id, buy_in_cents, cash_out_cents, placement, legacy_profit_cents) values
  ('fall-2025-10-2025-08-27', 'aiden', 2000, 2610, 3, null),
  ('fall-2025-10-2025-08-27', 'avery', 2000, 0, 9, null),
  ('fall-2025-10-2025-08-27', 'drew', 2000, 0, 8, null),
  ('fall-2025-10-2025-08-27', 'favor', 4000, 4210, 4, null),
  ('fall-2025-10-2025-08-27', 'jack', 2000, 0, 10, null),
  ('fall-2025-10-2025-08-27', 'jake', 1000, 5060, 2, null),
  ('fall-2025-10-2025-08-27', 'matthew', 1000, 0, 6, null),
  ('fall-2025-10-2025-08-27', 'max', 1000, 7610, 1, null),
  ('fall-2025-10-2025-08-27', 'raghav', 1000, 0, 7, null),
  ('fall-2025-10-2025-08-27', 'stone', 3500, 0, 11, null),
  ('fall-2025-10-2025-08-27', 'william', 1000, 985, 5, null),
  ('fall-2025-10-2025-09-10', 'aiden', 1000, 2420, 3, null),
  ('fall-2025-10-2025-09-10', 'ben', 2000, 1545, 6, null),
  ('fall-2025-10-2025-09-10', 'cam', 1000, 5390, 1, null),
  ('fall-2025-10-2025-09-10', 'drew', 3000, 0, 9, null),
  ('fall-2025-10-2025-09-10', 'jake', 2000, 2830, 4, null),
  ('fall-2025-10-2025-09-10', 'matthew', 1000, 210, 7, null),
  ('fall-2025-10-2025-09-10', 'max', 1000, 0, 8, null),
  ('fall-2025-10-2025-09-10', 'owen', 2000, 3600, 2, null),
  ('fall-2025-10-2025-09-10', 'raghav', 3000, 0, 10, null),
  ('fall-2025-10-2025-09-10', 'stone', 2000, 2000, 5, null),
  ('fall-2025-10-2025-09-22', 'aidan-pirc', 3000, 0, 11, null),
  ('fall-2025-10-2025-09-22', 'aiden', 2000, 0, 8, null),
  ('fall-2025-10-2025-09-22', 'ben', 1000, 9830, 1, null),
  ('fall-2025-10-2025-09-22', 'cam', 2000, 890, 7, null),
  ('fall-2025-10-2025-09-22', 'drew', 3000, 0, 10, null),
  ('fall-2025-10-2025-09-22', 'jack', 1000, 0, 6, null),
  ('fall-2025-10-2025-09-22', 'jake', 2000, 2425, 4, null),
  ('fall-2025-10-2025-09-22', 'max', 1000, 1300, 5, null),
  ('fall-2025-10-2025-09-22', 'raghav', 3000, 0, 12, null),
  ('fall-2025-10-2025-09-22', 'stone', 2000, 0, 9, null),
  ('fall-2025-10-2025-09-22', 'tim', 1000, 5500, 2, null),
  ('fall-2025-10-2025-09-22', 'william', 2000, 3070, 3, null),
  ('fall-2025-10-2025-10-07', 'aiden', 1000, 1755, 5, null),
  ('fall-2025-10-2025-10-07', 'ben', 3000, 2470, 8, null),
  ('fall-2025-10-2025-10-07', 'chris', 1000, 2600, 3, null),
  ('fall-2025-10-2025-10-07', 'drew', 1000, 1860, 4, null),
  ('fall-2025-10-2025-10-07', 'favor', 3000, 0, 11, null),
  ('fall-2025-10-2025-10-07', 'jake', 1000, 7055, 1, null),
  ('fall-2025-10-2025-10-07', 'max', 1000, 1005, 7, null),
  ('fall-2025-10-2025-10-07', 'owen', 3000, 1900, 9, null),
  ('fall-2025-10-2025-10-07', 'raghav', 1000, 3650, 2, null),
  ('fall-2025-10-2025-10-07', 'stone', 2000, 0, 10, null),
  ('fall-2025-10-2025-10-07', 'tim', 6000, 0, 12, null),
  ('fall-2025-10-2025-10-07', 'william', 1000, 1705, 6, null),
  ('fall-2025-10-2025-10-23', 'aiden', 1000, 1760, 4, null),
  ('fall-2025-10-2025-10-23', 'ben', 2000, 2350, 7, null),
  ('fall-2025-10-2025-10-23', 'cam', 1000, 755, 8, null),
  ('fall-2025-10-2025-10-23', 'chris', 2000, 0, 12, null),
  ('fall-2025-10-2025-10-23', 'drew', 6000, 0, 13, null),
  ('fall-2025-10-2025-10-23', 'jack', 1000, 0, 11, null),
  ('fall-2025-10-2025-10-23', 'jake', 1000, 1420, 5, null),
  ('fall-2025-10-2025-10-23', 'matthew', 1000, 0, 10, null),
  ('fall-2025-10-2025-10-23', 'max', 2000, 1485, 9, null),
  ('fall-2025-10-2025-10-23', 'michael', 1000, 1400, 6, null),
  ('fall-2025-10-2025-10-23', 'stone', 1000, 2790, 3, null),
  ('fall-2025-10-2025-10-23', 'tim', 1000, 3675, 2, null),
  ('fall-2025-10-2025-10-23', 'william', 1000, 5065, 1, null),
  ('fall-2025-10-2025-11-13', 'aiden', 1000, 0, 8, null),
  ('fall-2025-10-2025-11-13', 'ben', 2000, 4620, 2, null),
  ('fall-2025-10-2025-11-13', 'cam', 1000, 1295, 5, null),
  ('fall-2025-10-2025-11-13', 'chris', 1000, 2870, 4, null),
  ('fall-2025-10-2025-11-13', 'drew', 3000, 995, 12, null),
  ('fall-2025-10-2025-11-13', 'jack', 2000, 1830, 6, null),
  ('fall-2025-10-2025-11-13', 'jake', 1000, 3060, 3, null),
  ('fall-2025-10-2025-11-13', 'matthew', 1000, 0, 10, null),
  ('fall-2025-10-2025-11-13', 'max', 1000, 0, 9, null),
  ('fall-2025-10-2025-11-13', 'owen', 4000, 3100, 7, null),
  ('fall-2025-10-2025-11-13', 'raghav', 2000, 6280, 1, null),
  ('fall-2025-10-2025-11-13', 'stone', 2000, 0, 11, null),
  ('fall-2025-10-2025-11-13', 'tim', 3000, 0, 13, null),
  ('fall-2025-10-2025-11-24', 'aidan-pirc', 2500, 0, 12, null),
  ('fall-2025-10-2025-11-24', 'drew', 2000, 1025, 9, null),
  ('fall-2025-10-2025-11-24', 'favor', 1000, 1270, 7, null),
  ('fall-2025-10-2025-11-24', 'jack', 2000, 1750, 8, null),
  ('fall-2025-10-2025-11-24', 'jake', 2000, 2650, 6, null),
  ('fall-2025-10-2025-11-24', 'matthew', 2000, 0, 11, null),
  ('fall-2025-10-2025-11-24', 'max', 1000, 2780, 2, null),
  ('fall-2025-10-2025-11-24', 'owen', 1000, 2000, 4, null),
  ('fall-2025-10-2025-11-24', 'raghav', 1000, 1795, 5, null),
  ('fall-2025-10-2025-11-24', 'stone', 2000, 0, 10, null),
  ('fall-2025-10-2025-11-24', 'tim', 2000, 3080, 3, null),
  ('fall-2025-10-2025-11-24', 'william', 1000, 3200, 1, null),
  ('fall-2025-20-2025-09-03', 'aiden', 2000, 9020, 1, null),
  ('fall-2025-20-2025-09-03', 'ben', 4000, 7205, 2, null),
  ('fall-2025-20-2025-09-03', 'chris', 2000, 3795, 3, null),
  ('fall-2025-20-2025-09-03', 'drew', 2000, 0, 5, null),
  ('fall-2025-20-2025-09-03', 'jack', 2000, 0, 6, null),
  ('fall-2025-20-2025-09-03', 'jake', 4000, 2640, 4, null),
  ('fall-2025-20-2025-09-03', 'max', 4000, 0, 8, null),
  ('fall-2025-20-2025-09-03', 'stone', 4000, 1305, 7, null),
  ('fall-2025-20-2025-09-17', 'aidan-pirc', 3400, 3695, 5, null),
  ('fall-2025-20-2025-09-17', 'aiden', 2000, 2815, 4, null),
  ('fall-2025-20-2025-09-17', 'ben', 2000, 9560, 1, null),
  ('fall-2025-20-2025-09-17', 'cam', 3000, 1895, 8, null),
  ('fall-2025-20-2025-09-17', 'charlie', 2000, 0, 9, null),
  ('fall-2025-20-2025-09-17', 'chris', 4000, 0, 10, null),
  ('fall-2025-20-2025-09-17', 'drew', 2000, 2200, 6, null),
  ('fall-2025-20-2025-09-17', 'favor', 5000, 0, 11, null),
  ('fall-2025-20-2025-09-17', 'raghav', 2000, 1570, 7, null),
  ('fall-2025-20-2025-09-17', 'stone', 2000, 3525, 3, null),
  ('fall-2025-20-2025-09-17', 'tim', 6000, 8290, 2, null),
  ('fall-2025-20-2025-10-01', 'ben', 2000, 4370, 5, null),
  ('fall-2025-20-2025-10-01', 'cam', 2000, 2600, 6, null),
  ('fall-2025-20-2025-10-01', 'chris', 2000, 0, 9, null),
  ('fall-2025-20-2025-10-01', 'drew', 4000, 7090, 3, null),
  ('fall-2025-20-2025-10-01', 'favor', 4000, 0, 11, null),
  ('fall-2025-20-2025-10-01', 'jack', 2000, 0, 10, null),
  ('fall-2025-20-2025-10-01', 'jake', 2000, 5200, 2, null),
  ('fall-2025-20-2025-10-01', 'max', 2000, 0, 7, null),
  ('fall-2025-20-2025-10-01', 'owen', 2000, 0, 8, null),
  ('fall-2025-20-2025-10-01', 'raghav', 2000, 5720, 1, null),
  ('fall-2025-20-2025-10-01', 'stone', 4000, 0, 12, null),
  ('fall-2025-20-2025-10-01', 'tim', 4000, 7020, 4, null),
  ('fall-2025-20-2025-10-16', 'aidan-pirc', 2000, 4120, 4, null),
  ('fall-2025-20-2025-10-16', 'ben', 4000, 0, 7, null),
  ('fall-2025-20-2025-10-16', 'cam', 4000, 7440, 3, null),
  ('fall-2025-20-2025-10-16', 'chris', 3000, 1540, 6, -1560),
  ('fall-2025-20-2025-10-16', 'drew', 8000, 3940, 8, null),
  ('fall-2025-20-2025-10-16', 'louis', 2000, 3490, 5, null),
  ('fall-2025-20-2025-10-16', 'max', 2000, 8550, 2, null),
  ('fall-2025-20-2025-10-16', 'raghav', 5000, 0, 9, null),
  ('fall-2025-20-2025-10-16', 'stone', 4000, 10880, 1, null),
  ('fall-2025-20-2025-10-16', 'tim', 6000, 0, 10, null),
  ('fall-2025-20-2025-11-05', 'aidan-pirc', 2000, 0, 9, null),
  ('fall-2025-20-2025-11-05', 'aiden', 2000, 2070, 6, null),
  ('fall-2025-20-2025-11-05', 'ben', 4000, 4790, 5, null),
  ('fall-2025-20-2025-11-05', 'choliver', 2000, 4090, 4, null),
  ('fall-2025-20-2025-11-05', 'chris', 3000, 0, 10, null),
  ('fall-2025-20-2025-11-05', 'drew', 2000, 7530, 1, null),
  ('fall-2025-20-2025-11-05', 'jake', 2000, 5710, 2, null),
  ('fall-2025-20-2025-11-05', 'max', 4000, 0, 11, null),
  ('fall-2025-20-2025-11-05', 'stone', 4000, 0, 12, null),
  ('fall-2025-20-2025-11-05', 'tim', 4000, 6600, 3, null),
  ('fall-2025-20-2025-11-05', 'william', 6000, 4540, 8, null),
  ('fall-2025-20-2025-11-05', 'zack', 2000, 1470, 7, null),
  ('fall-2025-20-2025-11-20', 'aidan-pirc', 2000, 0, 8, null),
  ('fall-2025-20-2025-11-20', 'ben', 4000, 0, 11, null),
  ('fall-2025-20-2025-11-20', 'cam', 2000, 3850, 4, null),
  ('fall-2025-20-2025-11-20', 'choliver', 4000, 1890, 10, null),
  ('fall-2025-20-2025-11-20', 'chris', 2000, 2600, 6, null),
  ('fall-2025-20-2025-11-20', 'drew', 3000, 7820, 3, null),
  ('fall-2025-20-2025-11-20', 'jack', 2000, 0, 9, null),
  ('fall-2025-20-2025-11-20', 'jake', 2000, 2870, 5, null),
  ('fall-2025-20-2025-11-20', 'max', 4000, 0, 12, null),
  ('fall-2025-20-2025-11-20', 'owen', 6000, 18930, 1, null),
  ('fall-2025-20-2025-11-20', 'stone', 2000, 7040, 2, null),
  ('fall-2025-20-2025-11-20', 'tim', 8000, 0, 14, null),
  ('fall-2025-20-2025-11-20', 'william', 4000, 0, 13, null),
  ('fall-2025-20-2025-11-20', 'zack', 2000, 1500, 7, null),
  ('fall-2025-one-off-2025-10-03', 'aiden', 2000, 2700, 4, null),
  ('fall-2025-one-off-2025-10-03', 'avery', 1000, 0, 5, null),
  ('fall-2025-one-off-2025-10-03', 'ben', 2000, 3900, 2, null),
  ('fall-2025-one-off-2025-10-03', 'jack', 2000, 0, 6, null),
  ('fall-2025-one-off-2025-10-03', 'jake', 3000, 0, 7, null),
  ('fall-2025-one-off-2025-10-03', 'parag', 2000, 3150, 3, null),
  ('fall-2025-one-off-2025-10-03', 'raghav', 2000, 5640, 1, null),
  ('fall-2025-one-off-2025-10-10', 'aidan-pirc', 2000, 2540, 5, null),
  ('fall-2025-one-off-2025-10-10', 'aiden', 2000, 2760, 4, null),
  ('fall-2025-one-off-2025-10-10', 'ben', 6000, 0, 11, null),
  ('fall-2025-one-off-2025-10-10', 'drew', 6000, 4850, 7, null),
  ('fall-2025-one-off-2025-10-10', 'favor', 4000, 3900, 6, null),
  ('fall-2025-one-off-2025-10-10', 'jack', 2000, 0, 8, null),
  ('fall-2025-one-off-2025-10-10', 'jake', 2000, 5060, 3, null),
  ('fall-2025-one-off-2025-10-10', 'parag', 2000, 0, 9, null),
  ('fall-2025-one-off-2025-10-10', 'raghav', 2000, 6700, 1, null),
  ('fall-2025-one-off-2025-10-10', 'stone', 2000, 6200, 2, null),
  ('fall-2025-one-off-2025-10-10', 'tim', 4000, 1990, 10, -2110),
  ('fall-2025-one-off-2025-10-27', 'aidan-pirc', 1000, 4635, 1, null),
  ('fall-2025-one-off-2025-10-27', 'ben', 4000, 4140, 4, null),
  ('fall-2025-one-off-2025-10-27', 'cam', 1500, 0, 9, null),
  ('fall-2025-one-off-2025-10-27', 'chris', 1000, 2785, 2, null),
  ('fall-2025-one-off-2025-10-27', 'donovan', 1000, 0, 8, null),
  ('fall-2025-one-off-2025-10-27', 'drew', 1000, 0, 7, null),
  ('fall-2025-one-off-2025-10-27', 'jake', 2000, 0, 10, null),
  ('fall-2025-one-off-2025-10-27', 'michael', 1000, 925, 6, null),
  ('fall-2025-one-off-2025-10-27', 'stone', 1000, 2015, 3, null),
  ('fall-2025-one-off-2025-10-27', 'tim', 1000, 0, 5, 0),
  ('fall-2025-one-off-2025-12-07', 'aidan-pirc', 6000, 0, 11, null),
  ('fall-2025-one-off-2025-12-07', 'ben', 4000, 0, 10, null),
  ('fall-2025-one-off-2025-12-07', 'chris', 2000, 5200, 4, null),
  ('fall-2025-one-off-2025-12-07', 'drew', 4000, 3790, 7, null),
  ('fall-2025-one-off-2025-12-07', 'jack', 2000, 0, 9, null),
  ('fall-2025-one-off-2025-12-07', 'jake', 4000, 7800, 2, null),
  ('fall-2025-one-off-2025-12-07', 'max', 2000, 4700, 5, null),
  ('fall-2025-one-off-2025-12-07', 'raghav', 4000, 7400, 3, null),
  ('fall-2025-one-off-2025-12-07', 'stone', 5000, 3950, 8, null),
  ('fall-2025-one-off-2025-12-07', 'tim', 6000, 0, 12, null),
  ('fall-2025-one-off-2025-12-07', 'william', 2000, 3200, 6, null),
  ('fall-2025-one-off-2025-12-07', 'zimmy', 2000, 8900, 1, null),
  ('fall-2025-one-off-2025-12-12', 'ben', 2000, 9600, 1, null),
  ('fall-2025-one-off-2025-12-12', 'drew', 4000, 0, 6, null),
  ('fall-2025-one-off-2025-12-12', 'max', 3000, 0, 5, null),
  ('fall-2025-one-off-2025-12-12', 'nathan', 2500, 0, 4, null),
  ('fall-2025-one-off-2025-12-12', 'raghav', 2000, 6400, 2, null),
  ('fall-2025-one-off-2025-12-12', 'stone', 2500, 0, 3, null),
  ('fall-2026-20-2026-08-19', 'aiden', 4000, 6080, 7, null),
  ('fall-2026-20-2026-08-19', 'ben', 2000, 8480, 1, null),
  ('fall-2026-20-2026-08-19', 'calen', 2000, 5490, 2, null),
  ('fall-2026-20-2026-08-19', 'cam', 4000, 3230, 11, null),
  ('fall-2026-20-2026-08-19', 'chris', 4000, 2900, 12, null),
  ('fall-2026-20-2026-08-19', 'chris-s', 2000, 4360, 6, null),
  ('fall-2026-20-2026-08-19', 'drew', 8000, 0, 20, null),
  ('fall-2026-20-2026-08-19', 'favor', 2000, 0, 14, null),
  ('fall-2026-20-2026-08-19', 'jack', 2000, 0, 15, null),
  ('fall-2026-20-2026-08-19', 'jake', 6000, 6940, 8, null),
  ('fall-2026-20-2026-08-19', 'jp', 4000, 7120, 5, null),
  ('fall-2026-20-2026-08-19', 'maria', 2000, 5420, 3, null),
  ('fall-2026-20-2026-08-19', 'mason', 6000, 2760, 18, null),
  ('fall-2026-20-2026-08-19', 'max', 2000, 0, 16, null),
  ('fall-2026-20-2026-08-19', 'raghav', 2000, 2840, 9, null),
  ('fall-2026-20-2026-08-19', 'ryan', 2000, 660, 13, null),
  ('fall-2026-20-2026-08-19', 'stone', 3000, 0, 17, null),
  ('fall-2026-20-2026-08-19', 'tim', 8000, 8360, 10, null),
  ('fall-2026-20-2026-08-19', 'william', 2000, 5300, 4, null),
  ('fall-2026-20-2026-08-19', 'zimmy', 6000, 2760, 19, null),
  ('fall-2026-20-2026-08-26', 'aiden', 4000, 8270, 2, null),
  ('fall-2026-20-2026-08-26', 'ben', 4000, 8000, 4, null),
  ('fall-2026-20-2026-08-26', 'calen', 8000, 0, 20, null),
  ('fall-2026-20-2026-08-26', 'chris', 2000, 3460, 7, null),
  ('fall-2026-20-2026-08-26', 'chris-s', 2000, 430, 13, null),
  ('fall-2026-20-2026-08-26', 'drew', 4000, 8040, 3, null),
  ('fall-2026-20-2026-08-26', 'favor', 4000, 0, 16, null),
  ('fall-2026-20-2026-08-26', 'jake', 2000, 0, 14, null),
  ('fall-2026-20-2026-08-26', 'johnny', 2000, 4810, 6, null),
  ('fall-2026-20-2026-08-26', 'killian', 2000, 4890, 5, null),
  ('fall-2026-20-2026-08-26', 'maria', 2000, 830, 12, null),
  ('fall-2026-20-2026-08-26', 'mason', 4000, 3020, 11, null),
  ('fall-2026-20-2026-08-26', 'max', 4000, 4670, 9, null),
  ('fall-2026-20-2026-08-26', 'raghav', 4000, 0, 17, null),
  ('fall-2026-20-2026-08-26', 'ryan', 4000, 0, 18, null),
  ('fall-2026-20-2026-08-26', 'stone', 2000, 0, 15, null),
  ('fall-2026-20-2026-08-26', 'tim', 2000, 11780, 1, null),
  ('fall-2026-20-2026-08-26', 'william', 4000, 0, 19, null),
  ('fall-2026-20-2026-08-26', 'zack', 2000, 3370, 8, null),
  ('fall-2026-20-2026-08-26', 'zimmy', 4000, 4330, 10, null),
  ('fall-2026-20-2026-09-02', 'aiden', 2000, 6780, 3, null),
  ('fall-2026-20-2026-09-02', 'ben', 2000, 4140, 6, null),
  ('fall-2026-20-2026-09-02', 'calen', 4000, 6250, 5, null),
  ('fall-2026-20-2026-09-02', 'cam', 4000, 0, 14, null),
  ('fall-2026-20-2026-09-02', 'chris-s', 8500, 1050, 19, null),
  ('fall-2026-20-2026-09-02', 'drew', 2000, 14990, 1, null),
  ('fall-2026-20-2026-09-02', 'jack', 4000, 0, 15, null),
  ('fall-2026-20-2026-09-02', 'jake', 2000, 6410, 4, null),
  ('fall-2026-20-2026-09-02', 'johnny', 6000, 0, 18, null),
  ('fall-2026-20-2026-09-02', 'jp', 2000, 0, 11, null),
  ('fall-2026-20-2026-09-02', 'killian', 4000, 1500, 13, null),
  ('fall-2026-20-2026-09-02', 'lucas', 4000, 0, 16, null),
  ('fall-2026-20-2026-09-02', 'mason', 4000, 1800, 12, null),
  ('fall-2026-20-2026-09-02', 'max', 5000, 4270, 9, null),
  ('fall-2026-20-2026-09-02', 'raghav', 4000, 4170, 8, null),
  ('fall-2026-20-2026-09-02', 'stone', 5000, 0, 17, null),
  ('fall-2026-20-2026-09-02', 'tim', 4000, 2090, 10, null),
  ('fall-2026-20-2026-09-02', 'william', 2000, 4000, 7, null),
  ('fall-2026-20-2026-09-02', 'zimmy', 2000, 13040, 2, null),
  ('fall-2026-20-2026-09-09', 'aiden', 4000, 7470, 4, null),
  ('fall-2026-20-2026-09-09', 'ben', 6000, 13580, 2, null),
  ('fall-2026-20-2026-09-09', 'calen', 6000, 0, 15, null),
  ('fall-2026-20-2026-09-09', 'cam', 4000, 0, 11, null),
  ('fall-2026-20-2026-09-09', 'chris', 2000, 11960, 1, null),
  ('fall-2026-20-2026-09-09', 'drew', 4000, 0, 12, null),
  ('fall-2026-20-2026-09-09', 'jake', 4000, 5550, 6, null),
  ('fall-2026-20-2026-09-09', 'johnny', 6000, 5260, 9, null),
  ('fall-2026-20-2026-09-09', 'jp', 2000, 0, 10, null),
  ('fall-2026-20-2026-09-09', 'lucas', 2000, 2870, 7, null),
  ('fall-2026-20-2026-09-09', 'mason', 2000, 2820, 8, null),
  ('fall-2026-20-2026-09-09', 'max', 4000, 6360, 5, null),
  ('fall-2026-20-2026-09-09', 'raghav', 3000, 7130, 3, null),
  ('fall-2026-20-2026-09-09', 'tim', 4000, 0, 13, null),
  ('fall-2026-20-2026-09-09', 'william', 4000, 0, 14, null),
  ('fall-2026-20-2026-09-09', 'zimmy', 6000, 0, 16, null),
  ('fall-2026-20-2026-09-16', 'ben', 2000, 11250, 1, null),
  ('fall-2026-20-2026-09-16', 'calen', 4000, 7300, 4, null),
  ('fall-2026-20-2026-09-16', 'cam', 6000, 6000, 9, null),
  ('fall-2026-20-2026-09-16', 'chris-s', 2000, 2340, 8, null),
  ('fall-2026-20-2026-09-16', 'drew', 6000, 8370, 5, null),
  ('fall-2026-20-2026-09-16', 'favor', 4000, 0, 12, null),
  ('fall-2026-20-2026-09-16', 'jake', 2000, 7600, 2, null),
  ('fall-2026-20-2026-09-16', 'josh', 2000, 500, 11, null),
  ('fall-2026-20-2026-09-16', 'lucas', 6000, 0, 15, null),
  ('fall-2026-20-2026-09-16', 'mason', 4000, 2630, 10, null),
  ('fall-2026-20-2026-09-16', 'max', 2000, 2980, 7, null),
  ('fall-2026-20-2026-09-16', 'raghav', 6000, 0, 16, null),
  ('fall-2026-20-2026-09-16', 'ryan', 4000, 0, 13, null),
  ('fall-2026-20-2026-09-16', 'stone', 2000, 3480, 6, null),
  ('fall-2026-20-2026-09-16', 'tim', 2000, 5550, 3, null),
  ('fall-2026-20-2026-09-16', 'william', 4000, 0, 14, null),
  ('fall-2026-20-2026-09-23', 'aiden', 8000, 2250, 18, null),
  ('fall-2026-20-2026-09-23', 'ben', 4000, 4030, 11, null),
  ('fall-2026-20-2026-09-23', 'calen', 2000, 3000, 7, null),
  ('fall-2026-20-2026-09-23', 'cam', 2000, 2790, 8, null),
  ('fall-2026-20-2026-09-23', 'chris', 4000, 4090, 10, null),
  ('fall-2026-20-2026-09-23', 'chris-s', 2000, 5510, 2, null),
  ('fall-2026-20-2026-09-23', 'drew', 6000, 3590, 16, null),
  ('fall-2026-20-2026-09-23', 'gage', 2000, 5700, 1, null),
  ('fall-2026-20-2026-09-23', 'jake', 6000, 4100, 14, null),
  ('fall-2026-20-2026-09-23', 'johnny', 10000, 4670, 17, null),
  ('fall-2026-20-2026-09-23', 'killian', 2000, 2000, 12, null),
  ('fall-2026-20-2026-09-23', 'lucas', 2000, 4990, 3, null),
  ('fall-2026-20-2026-09-23', 'mason', 2000, 4500, 5, null),
  ('fall-2026-20-2026-09-23', 'max', 4000, 2470, 13, null),
  ('fall-2026-20-2026-09-23', 'raghav', 2000, 2570, 9, null),
  ('fall-2026-20-2026-09-23', 'stone', 2000, 0, 15, null),
  ('fall-2026-20-2026-09-23', 'tim', 2000, 4540, 4, null),
  ('fall-2026-20-2026-09-23', 'zimmy', 8000, 9200, 6, null),
  ('fall-2026-20-2026-10-06', 'aiden', 2000, 7640, 1, null),
  ('fall-2026-20-2026-10-06', 'ben', 6000, 9860, 5, null),
  ('fall-2026-20-2026-10-06', 'calen', 4000, 0, 16, null),
  ('fall-2026-20-2026-10-06', 'cam', 2000, 4860, 7, null),
  ('fall-2026-20-2026-10-06', 'chris', 2000, 7270, 2, null),
  ('fall-2026-20-2026-10-06', 'chris-s', 3000, 4780, 9, null),
  ('fall-2026-20-2026-10-06', 'drew', 6000, 4060, 13, null),
  ('fall-2026-20-2026-10-06', 'favor', 4000, 0, 17, null),
  ('fall-2026-20-2026-10-06', 'gage', 4000, 220, 15, null),
  ('fall-2026-20-2026-10-06', 'jake', 4500, 0, 18, null),
  ('fall-2026-20-2026-10-06', 'johnny', 6000, 4350, 12, null),
  ('fall-2026-20-2026-10-06', 'jp', 2000, 2250, 10, null),
  ('fall-2026-20-2026-10-06', 'lucas', 2000, 0, 14, null),
  ('fall-2026-20-2026-10-06', 'mason', 4000, 6500, 8, null),
  ('fall-2026-20-2026-10-06', 'max', 2000, 2200, 11, null),
  ('fall-2026-20-2026-10-06', 'raghav', 3000, 7600, 3, null),
  ('fall-2026-20-2026-10-06', 'stone', 2000, 4910, 6, null),
  ('fall-2026-20-2026-10-06', 'tim', 12000, 0, 19, null),
  ('fall-2026-20-2026-10-06', 'william', 2000, 6000, 4, null),
  ('fall-2026-50-2026-10-04', 'aiden', 5000, 23925, 1, null),
  ('fall-2026-50-2026-10-04', 'cam', 5000, 2800, 5, null),
  ('fall-2026-50-2026-10-04', 'connor', 5000, 0, 7, null),
  ('fall-2026-50-2026-10-04', 'drew', 5000, 12675, 2, null),
  ('fall-2026-50-2026-10-04', 'johnny', 15000, 6850, 8, null),
  ('fall-2026-50-2026-10-04', 'raghav', 5000, 8725, 3, null),
  ('fall-2026-50-2026-10-04', 'stone', 12000, 0, 9, null),
  ('fall-2026-50-2026-10-04', 'tim', 10000, 10625, 4, null),
  ('fall-2026-50-2026-10-04', 'zimmy', 5000, 1400, 6, null),
  ('fall-2026-one-off-2026-08-20', 'ben', 3000, 5560, 1, null),
  ('fall-2026-one-off-2026-08-20', 'chris-s', 1000, 1500, 2, null),
  ('fall-2026-one-off-2026-08-20', 'mason', 4000, 965, 3, null),
  ('fall-2026-one-off-2026-08-30', 'ben', 2000, 4300, 1, null),
  ('fall-2026-one-off-2026-08-30', 'calen', 2000, 0, 3, null),
  ('fall-2026-one-off-2026-08-30', 'chris-s', 1000, 2700, 2, null),
  ('fall-2026-one-off-2026-08-30', 'mason', 2000, 0, 4, null),
  ('fall-2026-one-off-2026-09-03', 'ben', 4000, 1240, 7, null),
  ('fall-2026-one-off-2026-09-03', 'calen', 6000, 0, 9, null),
  ('fall-2026-one-off-2026-09-03', 'chris-s', 2000, 6770, 3, null),
  ('fall-2026-one-off-2026-09-03', 'jake', 4000, 3790, 4, null),
  ('fall-2026-one-off-2026-09-03', 'lucas', 2000, 0, 5, null),
  ('fall-2026-one-off-2026-09-03', 'mason', 4000, 0, 8, null),
  ('fall-2026-one-off-2026-09-03', 'raghav', 2000, 0, 6, null),
  ('fall-2026-one-off-2026-09-03', 'tim', 6000, 11160, 2, 5660),
  ('fall-2026-one-off-2026-09-03', 'zimmy', 2000, 9140, 1, null),
  ('fall-2026-one-off-2026-09-20', 'calen', 2000, 3200, 1, null),
  ('fall-2026-one-off-2026-09-20', 'chris-s', 2000, 0, 3, null),
  ('fall-2026-one-off-2026-09-20', 'mason', 1000, 1800, 2, null),
  ('fall-2026-one-off-2026-09-26', 'aidan-pirc', 4000, 0, 12, null),
  ('fall-2026-one-off-2026-09-26', 'aiden', 2000, 1810, 8, null),
  ('fall-2026-one-off-2026-09-26', 'ben', 6000, 7520, 5, null),
  ('fall-2026-one-off-2026-09-26', 'cam', 4000, 4560, 7, null),
  ('fall-2026-one-off-2026-09-26', 'drew', 2000, 0, 11, null),
  ('fall-2026-one-off-2026-09-26', 'favor', 2000, 1530, 9, null),
  ('fall-2026-one-off-2026-09-26', 'gage', 2000, 9840, 1, null),
  ('fall-2026-one-off-2026-09-26', 'jack', 4000, 0, 13, null),
  ('fall-2026-one-off-2026-09-26', 'jake', 2000, 3450, 6, null),
  ('fall-2026-one-off-2026-09-26', 'lucas', 4000, 0, 14, null),
  ('fall-2026-one-off-2026-09-26', 'mason', 2000, 6040, 2, null),
  ('fall-2026-one-off-2026-09-26', 'raghav', 4100, 0, 15, null),
  ('fall-2026-one-off-2026-09-26', 'tim', 2000, 3770, 4, null),
  ('fall-2026-one-off-2026-09-26', 'william', 2000, 5300, 3, null),
  ('fall-2026-one-off-2026-09-26', 'zimmy', 4000, 2280, 10, null),
  ('fall-2026-one-off-2026-09-27', 'ben', 1000, 5000, 1, null),
  ('fall-2026-one-off-2026-09-27', 'calen', 3000, 0, 3, null),
  ('fall-2026-one-off-2026-09-27', 'mason', 1000, 0, 2, null),
  ('fall-2026-one-off-2026-09-30', 'aiden', 2000, 2600, 5, null),
  ('fall-2026-one-off-2026-09-30', 'ben', 6000, 2830, 8, null),
  ('fall-2026-one-off-2026-09-30', 'calen', 11000, 660, 10, null),
  ('fall-2026-one-off-2026-09-30', 'chris-s', 6000, 520, 9, null),
  ('fall-2026-one-off-2026-09-30', 'jake', 2000, 6720, 3, null),
  ('fall-2026-one-off-2026-09-30', 'johnny', 2000, 10500, 1, null),
  ('fall-2026-one-off-2026-09-30', 'lucas', 4000, 2430, 6, null),
  ('fall-2026-one-off-2026-09-30', 'raghav', 2000, 0, 7, null),
  ('fall-2026-one-off-2026-09-30', 'stone', 2000, 9350, 2, null),
  ('fall-2026-one-off-2026-09-30', 'tim', 2000, 3270, 4, null),
  ('fall-2026-one-off-2026-10-05', 'ben', 2000, 4650, 1, null),
  ('fall-2026-one-off-2026-10-05', 'calen', 4000, 2380, 4, null),
  ('fall-2026-one-off-2026-10-05', 'chris-s', 2000, 2040, 3, null),
  ('fall-2026-one-off-2026-10-05', 'jake', 3000, 0, 5, null),
  ('fall-2026-one-off-2026-10-05', 'mason', 1000, 3450, 2, null),
  ('fall-2026-online-2026-09-27', 'aiden', 4000, 0, 7, null),
  ('fall-2026-online-2026-09-27', 'ben', 2000, 0, 6, null),
  ('fall-2026-online-2026-09-27', 'favor', 2000, 4081, 3, null),
  ('fall-2026-online-2026-09-27', 'gage', 4000, 0, 8, null),
  ('fall-2026-online-2026-09-27', 'liv', 2000, 4007, 4, null),
  ('fall-2026-online-2026-09-27', 'raghav', 2000, 8088, 1, null),
  ('fall-2026-online-2026-09-27', 'stone', 4000, 0, 9, null),
  ('fall-2026-online-2026-09-27', 'tim', 2000, 4274, 2, null),
  ('fall-2026-online-2026-09-27', 'zimmy', 4000, 5550, 5, null),
  ('spring-2026-10-2026-01-14', 'aiden', 1000, 0, 7, null),
  ('spring-2026-10-2026-01-14', 'ben', 1000, 3280, 3, null),
  ('spring-2026-10-2026-01-14', 'calen', 4000, 0, 13, null),
  ('spring-2026-10-2026-01-14', 'chris', 1000, 0, 8, null),
  ('spring-2026-10-2026-01-14', 'drew', 1000, 965, 6, null),
  ('spring-2026-10-2026-01-14', 'jack', 1000, 6270, 1, null),
  ('spring-2026-10-2026-01-14', 'jackson', 1000, 0, 9, null),
  ('spring-2026-10-2026-01-14', 'jake', 2000, 2200, 5, null),
  ('spring-2026-10-2026-01-14', 'max', 1000, 1370, 4, null),
  ('spring-2026-10-2026-01-14', 'raghav', 3000, 5830, 2, null),
  ('spring-2026-10-2026-01-14', 'tim', 3000, 1110, 12, null),
  ('spring-2026-10-2026-01-14', 'william', 1000, 0, 10, null),
  ('spring-2026-10-2026-01-14', 'zimmy', 1000, 0, 11, null),
  ('spring-2026-10-2026-01-28', 'ben', 1000, 5670, 2, null),
  ('spring-2026-10-2026-01-28', 'calen', 5000, 2650, 13, null),
  ('spring-2026-10-2026-01-28', 'chris', 2000, 0, 10, null),
  ('spring-2026-10-2026-01-28', 'drew', 8000, 8000, 6, null),
  ('spring-2026-10-2026-01-28', 'jack', 1000, 0, 8, null),
  ('spring-2026-10-2026-01-28', 'jackson', 1000, 0, 9, null),
  ('spring-2026-10-2026-01-28', 'jake', 2000, 1555, 7, null),
  ('spring-2026-10-2026-01-28', 'matthew', 2000, 0, 11, null),
  ('spring-2026-10-2026-01-28', 'max', 2000, 0, 12, null),
  ('spring-2026-10-2026-01-28', 'owen', 1000, 7570, 1, null),
  ('spring-2026-10-2026-01-28', 'raghav', 1000, 1840, 5, null),
  ('spring-2026-10-2026-01-28', 'tim', 6500, 7900, 3, null),
  ('spring-2026-10-2026-01-28', 'william', 1000, 2215, 4, null),
  ('spring-2026-10-2026-01-28', 'zimmy', 3000, 0, 14, null),
  ('spring-2026-10-2026-02-11', 'aiden', 2000, 6895, 2, null),
  ('spring-2026-10-2026-02-11', 'ben', 2000, 8500, 1, null),
  ('spring-2026-10-2026-02-11', 'calen', 4000, 0, 11, null),
  ('spring-2026-10-2026-02-11', 'chris', 3000, 2000, 9, null),
  ('spring-2026-10-2026-02-11', 'drew', 4000, 0, 12, null),
  ('spring-2026-10-2026-02-11', 'jake', 2000, 2000, 6, null),
  ('spring-2026-10-2026-02-11', 'max', 1350, 2120, 5, null),
  ('spring-2026-10-2026-02-11', 'owen', 1500, 4000, 3, null),
  ('spring-2026-10-2026-02-11', 'raghav', 1000, 2290, 4, null),
  ('spring-2026-10-2026-02-11', 'stone', 2000, 0, 10, null),
  ('spring-2026-10-2026-02-11', 'tim', 5000, 0, 13, null),
  ('spring-2026-10-2026-02-11', 'william', 1600, 1600, 7, null),
  ('spring-2026-10-2026-02-11', 'zimmy', 3000, 3000, 8, null),
  ('spring-2026-10-2026-02-25', 'aiden', 1000, 3270, 3, null),
  ('spring-2026-10-2026-02-25', 'ben', 2000, 1735, 7, null),
  ('spring-2026-10-2026-02-25', 'caleb', 2000, 0, 13, null),
  ('spring-2026-10-2026-02-25', 'calen', 4000, 1270, 15, null),
  ('spring-2026-10-2026-02-25', 'gage', 2000, 1310, 9, null),
  ('spring-2026-10-2026-02-25', 'jack', 3000, 0, 16, null),
  ('spring-2026-10-2026-02-25', 'maria', 2000, 0, 14, null),
  ('spring-2026-10-2026-02-25', 'mason', 2000, 1730, 8, null),
  ('spring-2026-10-2026-02-25', 'max', 1000, 2100, 5, null),
  ('spring-2026-10-2026-02-25', 'owen', 1000, 5820, 2, null),
  ('spring-2026-10-2026-02-25', 'raghav', 3000, 1565, 12, null),
  ('spring-2026-10-2026-02-25', 'sam', 1000, 0, 10, null),
  ('spring-2026-10-2026-02-25', 'stone', 3000, 3355, 6, null),
  ('spring-2026-10-2026-02-25', 'tim', 4000, 2620, 11, null),
  ('spring-2026-10-2026-02-25', 'william', 1000, 6130, 1, null),
  ('spring-2026-10-2026-02-25', 'zimmy', 1000, 2130, 4, null),
  ('spring-2026-10-2026-03-12', 'aidan-pirc', 2500, 1250, 10, null),
  ('spring-2026-10-2026-03-12', 'aiden', 1000, 0, 8, null),
  ('spring-2026-10-2026-03-12', 'ben', 2500, 2535, 7, null),
  ('spring-2026-10-2026-03-12', 'calen', 1000, 3835, 2, null),
  ('spring-2026-10-2026-03-12', 'drew', 1000, 1530, 5, null),
  ('spring-2026-10-2026-03-12', 'favor', 2000, 2125, 6, null),
  ('spring-2026-10-2026-03-12', 'jake', 1000, 5350, 1, null),
  ('spring-2026-10-2026-03-12', 'mason', 3000, 0, 13, null),
  ('spring-2026-10-2026-03-12', 'max', 2000, 0, 12, null),
  ('spring-2026-10-2026-03-12', 'raghav', 1500, 0, 11, null),
  ('spring-2026-10-2026-03-12', 'ryan', 1000, 0, 9, null),
  ('spring-2026-10-2026-03-12', 'stone', 2000, 3140, 3, null),
  ('spring-2026-10-2026-03-12', 'tim', 2000, 2735, 4, null),
  ('spring-2026-10-2026-04-01', 'aidan-pirc', 2500, 0, 12, null),
  ('spring-2026-10-2026-04-01', 'aiden', 1000, 3930, 5, null),
  ('spring-2026-10-2026-04-01', 'ben', 1500, 7040, 2, null),
  ('spring-2026-10-2026-04-01', 'calen', 3500, 7515, 4, null),
  ('spring-2026-10-2026-04-01', 'chris', 1000, 0, 9, null),
  ('spring-2026-10-2026-04-01', 'drew', 9000, 2485, 14, null),
  ('spring-2026-10-2026-04-01', 'jack', 2000, 1450, 8, null),
  ('spring-2026-10-2026-04-01', 'jake', 2000, 2220, 7, null),
  ('spring-2026-10-2026-04-01', 'james', 2000, 0, 10, null),
  ('spring-2026-10-2026-04-01', 'mason', 2000, 0, 11, null),
  ('spring-2026-10-2026-04-01', 'matthew', 3000, 0, 13, null),
  ('spring-2026-10-2026-04-01', 'max', 1000, 5130, 3, null),
  ('spring-2026-10-2026-04-01', 'raghav', 1000, 7440, 1, null),
  ('spring-2026-10-2026-04-01', 'tim', 7000, 0, 15, null),
  ('spring-2026-10-2026-04-01', 'zimmy', 1000, 2260, 6, null),
  ('spring-2026-10-2026-04-15', 'aiden', 1000, 3780, 4, null),
  ('spring-2026-10-2026-04-15', 'ben', 2000, 6515, 1, null),
  ('spring-2026-10-2026-04-15', 'calen', 1000, 0, 7, null),
  ('spring-2026-10-2026-04-15', 'chris', 1000, 2530, 5, null),
  ('spring-2026-10-2026-04-15', 'drew', 4000, 775, 12, null),
  ('spring-2026-10-2026-04-15', 'jack', 1000, 0, 8, null),
  ('spring-2026-10-2026-04-15', 'jake', 2000, 2625, 6, null),
  ('spring-2026-10-2026-04-15', 'mason', 1500, 5645, 2, null),
  ('spring-2026-10-2026-04-15', 'matthew', 2000, 0, 11, null),
  ('spring-2026-10-2026-04-15', 'max', 1000, 4630, 3, null),
  ('spring-2026-10-2026-04-15', 'raghav', 1500, 0, 10, null),
  ('spring-2026-10-2026-04-15', 'stone', 3500, 0, 13, null),
  ('spring-2026-10-2026-04-15', 'tim', 4000, 0, 14, null),
  ('spring-2026-10-2026-04-15', 'zimmy', 1000, 0, 9, null),
  ('spring-2026-20-2026-01-07', 'aidan-pirc', 4000, 3100, 7, null),
  ('spring-2026-20-2026-01-07', 'ben', 4000, 10700, 2, null),
  ('spring-2026-20-2026-01-07', 'calen', 6000, 0, 13, null),
  ('spring-2026-20-2026-01-07', 'cam', 2000, 3970, 3, null),
  ('spring-2026-20-2026-01-07', 'chris', 2000, 3240, 4, null),
  ('spring-2026-20-2026-01-07', 'drew', 4000, 13830, 1, null),
  ('spring-2026-20-2026-01-07', 'jack', 2000, 1000, 8, null),
  ('spring-2026-20-2026-01-07', 'jake', 6000, 3960, 10, null),
  ('spring-2026-20-2026-01-07', 'max', 2000, 0, 9, null),
  ('spring-2026-20-2026-01-07', 'raghav', 4000, 3150, 6, null),
  ('spring-2026-20-2026-01-07', 'stone', 4000, 0, 12, null),
  ('spring-2026-20-2026-01-07', 'tim', 2000, 3150, 5, null),
  ('spring-2026-20-2026-01-07', 'zimmy', 4000, 0, 11, null),
  ('spring-2026-20-2026-02-04', 'aidan-pirc', 3000, 0, 6, null),
  ('spring-2026-20-2026-02-04', 'aiden', 4000, 0, 9, null),
  ('spring-2026-20-2026-02-04', 'brett', 6000, 0, 12, null),
  ('spring-2026-20-2026-02-04', 'calen', 8000, 8000, 4, null),
  ('spring-2026-20-2026-02-04', 'drew', 4300, 2560, 5, -1940),
  ('spring-2026-20-2026-02-04', 'jake', 4000, 0, 10, null),
  ('spring-2026-20-2026-02-04', 'max', 4000, 0, 11, null),
  ('spring-2026-20-2026-02-04', 'owen', 2000, 25500, 1, null),
  ('spring-2026-20-2026-02-04', 'raghav', 3000, 0, 7, null),
  ('spring-2026-20-2026-02-04', 'stone', 4000, 7630, 2, null),
  ('spring-2026-20-2026-02-04', 'tim', 3000, 0, 8, null),
  ('spring-2026-20-2026-02-04', 'zimmy', 4000, 5610, 3, null),
  ('spring-2026-20-2026-02-18', 'aiden', 2000, 8000, 1, null),
  ('spring-2026-20-2026-02-18', 'calen', 4000, 0, 11, null),
  ('spring-2026-20-2026-02-18', 'cam', 2000, 4180, 5, null),
  ('spring-2026-20-2026-02-18', 'chris', 2000, 5140, 3, null),
  ('spring-2026-20-2026-02-18', 'drew', 8000, 0, 13, null),
  ('spring-2026-20-2026-02-18', 'jake', 2000, 2400, 6, null),
  ('spring-2026-20-2026-02-18', 'maria', 2000, 1660, 8, null),
  ('spring-2026-20-2026-02-18', 'max', 4000, 3430, 9, null),
  ('spring-2026-20-2026-02-18', 'owen', 2000, 7850, 2, null),
  ('spring-2026-20-2026-02-18', 'raghav', 4000, 4400, 7, null),
  ('spring-2026-20-2026-02-18', 'stone', 3000, 5650, 4, null),
  ('spring-2026-20-2026-02-18', 'tim', 4000, 330, 10, null),
  ('spring-2026-20-2026-02-18', 'zimmy', 4000, 0, 12, null),
  ('spring-2026-20-2026-03-05', 'aiden', 2000, 0, 8, null),
  ('spring-2026-20-2026-03-05', 'ben', 3000, 4400, 4, null),
  ('spring-2026-20-2026-03-05', 'calen', 2000, 0, 9, null),
  ('spring-2026-20-2026-03-05', 'cam', 2000, 1900, 7, null),
  ('spring-2026-20-2026-03-05', 'chris', 2000, 0, 10, null),
  ('spring-2026-20-2026-03-05', 'drew', 4000, 100, 12, null),
  ('spring-2026-20-2026-03-05', 'jack', 4000, 0, 13, null),
  ('spring-2026-20-2026-03-05', 'max', 3000, 4400, 5, null),
  ('spring-2026-20-2026-03-05', 'raghav', 2000, 5870, 2, null),
  ('spring-2026-20-2026-03-05', 'stone', 2000, 7680, 1, null),
  ('spring-2026-20-2026-03-05', 'tim', 4000, 7730, 3, null),
  ('spring-2026-20-2026-03-05', 'zack', 2000, 1920, 6, null),
  ('spring-2026-20-2026-03-05', 'zimmy', 2000, 0, 11, null),
  ('spring-2026-20-2026-03-26', 'aidan-pirc', 5000, 0, 14, null),
  ('spring-2026-20-2026-03-26', 'aiden', 2000, 6250, 2, null),
  ('spring-2026-20-2026-03-26', 'ben', 2000, 3020, 5, null),
  ('spring-2026-20-2026-03-26', 'calen', 3500, 2640, 7, null),
  ('spring-2026-20-2026-03-26', 'cam', 2000, 0, 9, null),
  ('spring-2026-20-2026-03-26', 'chris', 2000, 4660, 3, null),
  ('spring-2026-20-2026-03-26', 'drew', 8000, 6660, 8, null),
  ('spring-2026-20-2026-03-26', 'favor', 2000, 13240, 1, null),
  ('spring-2026-20-2026-03-26', 'jack', 4000, 1070, 11, null),
  ('spring-2026-20-2026-03-26', 'max', 4000, 0, 13, null),
  ('spring-2026-20-2026-03-26', 'raghav', 2000, 3890, 4, null),
  ('spring-2026-20-2026-03-26', 'stone', 5000, 5570, 6, null),
  ('spring-2026-20-2026-03-26', 'tim', 2000, 0, 10, null),
  ('spring-2026-20-2026-03-26', 'zimmy', 3000, 0, 12, null),
  ('spring-2026-20-2026-04-08', 'aidan-pirc', 5000, 1610, 12, null),
  ('spring-2026-20-2026-04-08', 'aiden', 2000, 4340, 3, null),
  ('spring-2026-20-2026-04-08', 'ben', 3000, 0, 10, null),
  ('spring-2026-20-2026-04-08', 'calen', 2000, 7340, 2, null),
  ('spring-2026-20-2026-04-08', 'cam', 2000, 0, 7, null),
  ('spring-2026-20-2026-04-08', 'drew', 2000, 400, 5, null),
  ('spring-2026-20-2026-04-08', 'jake', 2000, 0, 8, null),
  ('spring-2026-20-2026-04-08', 'mason', 2000, 11060, 1, null),
  ('spring-2026-20-2026-04-08', 'max', 2000, 0, 9, null),
  ('spring-2026-20-2026-04-08', 'raghav', 3000, 0, 11, null),
  ('spring-2026-20-2026-04-08', 'stone', 3000, 5180, 4, null),
  ('spring-2026-20-2026-04-08', 'tim', 3000, 1070, 6, null),
  ('spring-2026-20-2026-04-22', 'ben', 4000, 5330, 4, null),
  ('spring-2026-20-2026-04-22', 'calen', 4000, 0, 11, null),
  ('spring-2026-20-2026-04-22', 'chris', 2000, 0, 8, null),
  ('spring-2026-20-2026-04-22', 'chris-s', 2000, 5890, 3, null),
  ('spring-2026-20-2026-04-22', 'favor', 2000, 9530, 1, null),
  ('spring-2026-20-2026-04-22', 'gage', 2000, 2440, 5, null),
  ('spring-2026-20-2026-04-22', 'jack', 4000, 0, 12, null),
  ('spring-2026-20-2026-04-22', 'max', 4000, 0, 13, null),
  ('spring-2026-20-2026-04-22', 'raghav', 6000, 4530, 7, null),
  ('spring-2026-20-2026-04-22', 'stone', 2000, 7950, 2, null),
  ('spring-2026-20-2026-04-22', 'tim', 2000, 2370, 6, null),
  ('spring-2026-20-2026-04-22', 'tyler', 2000, 0, 9, null),
  ('spring-2026-20-2026-04-22', 'zimmy', 2000, 0, 10, null),
  ('spring-2026-50-2026-01-21', 'aidan-pirc', 10000, 16450, 4, null),
  ('spring-2026-50-2026-01-21', 'aiden', 5000, 20475, 1, null),
  ('spring-2026-50-2026-01-21', 'ben', 15000, 12100, 6, null),
  ('spring-2026-50-2026-01-21', 'brett', 5000, 0, 10, null),
  ('spring-2026-50-2026-01-21', 'calen', 10000, 18200, 3, null),
  ('spring-2026-50-2026-01-21', 'drew', 10000, 5825, 8, null),
  ('spring-2026-50-2026-01-21', 'jake', 0, 1250, 5, null),
  ('spring-2026-50-2026-01-21', 'max', 5000, 0, 11, null),
  ('spring-2026-50-2026-01-21', 'owen', 5000, 19000, 2, null),
  ('spring-2026-50-2026-01-21', 'raghav', 10000, 5700, 9, null),
  ('spring-2026-50-2026-01-21', 'stone', 10000, 6000, 7, null),
  ('spring-2026-50-2026-01-21', 'tim', 10000, 0, 12, null),
  ('spring-2026-50-2026-01-21', 'zimmy', 10000, 0, 13, null),
  ('spring-2026-50-2026-02-13', 'aidan-pirc', 10000, 0, 8, null),
  ('spring-2026-50-2026-02-13', 'ben', 15000, 14550, 3, null),
  ('spring-2026-50-2026-02-13', 'cam', 5000, 0, 6, null),
  ('spring-2026-50-2026-02-13', 'drew', 15000, 11325, 4, null),
  ('spring-2026-50-2026-02-13', 'max', 5000, 19250, 2, null),
  ('spring-2026-50-2026-02-13', 'raghav', 5000, 35025, 1, null),
  ('spring-2026-50-2026-02-13', 'stone', 5000, 0, 7, null),
  ('spring-2026-50-2026-02-13', 'tim', 10000, 5100, 5, null),
  ('spring-2026-50-2026-02-13', 'zimmy', 20000, 4750, 9, null),
  ('spring-2026-50-2026-05-03', 'aiden', 5000, 5575, 6, null),
  ('spring-2026-50-2026-05-03', 'ben', 5000, 0, 8, null),
  ('spring-2026-50-2026-05-03', 'cam', 10000, 11600, 4, null),
  ('spring-2026-50-2026-05-03', 'drew', 10000, 13075, 2, null),
  ('spring-2026-50-2026-05-03', 'jack', 5000, 0, 9, null),
  ('spring-2026-50-2026-05-03', 'jake', 5000, 6575, 5, null),
  ('spring-2026-50-2026-05-03', 'max', 5000, 10600, 1, null),
  ('spring-2026-50-2026-05-03', 'raghav', 5000, 5575, 7, null),
  ('spring-2026-50-2026-05-03', 'stone', 7000, 0, 10, null),
  ('spring-2026-50-2026-05-03', 'tim', 10000, 12000, 3, null),
  ('spring-2026-one-off-2026-01-16', 'aidan-pirc', 1000, 850, 3, null),
  ('spring-2026-one-off-2026-01-16', 'ben', 1000, 0, 5, null),
  ('spring-2026-one-off-2026-01-16', 'chris', 1000, 0, 6, null),
  ('spring-2026-one-off-2026-01-16', 'drew', 3500, 0, 9, null),
  ('spring-2026-one-off-2026-01-16', 'jack', 2000, 0, 7, null),
  ('spring-2026-one-off-2026-01-16', 'jake', 1000, 2400, 2, null),
  ('spring-2026-one-off-2026-01-16', 'matthew', 2000, 0, 8, null),
  ('spring-2026-one-off-2026-01-16', 'max', 2000, 1050, 4, null),
  ('spring-2026-one-off-2026-01-16', 'tim', 2000, 11200, 1, null),
  ('spring-2026-one-off-2026-01-31', 'drew', 1000, 0, 5, null),
  ('spring-2026-one-off-2026-01-31', 'jack', 1000, 6110, 1, null),
  ('spring-2026-one-off-2026-01-31', 'jake', 1000, 835, 4, null),
  ('spring-2026-one-off-2026-01-31', 'matthew', 3000, 0, 7, null),
  ('spring-2026-one-off-2026-01-31', 'max', 1000, 2505, 2, null),
  ('spring-2026-one-off-2026-01-31', 'tim', 6000, 3300, 6, null),
  ('spring-2026-one-off-2026-01-31', 'william', 2000, 2150, 3, null),
  ('spring-2026-one-off-2026-04-28', 'aidan-pirc', 3000, 6590, 2, null),
  ('spring-2026-one-off-2026-04-28', 'ben', 1000, 7410, 1, null),
  ('spring-2026-one-off-2026-04-28', 'calen', 6000, 0, 5, null),
  ('spring-2026-one-off-2026-04-28', 'grace', 1000, 0, 3, null),
  ('spring-2026-one-off-2026-04-28', 'mason', 3000, 0, 4, null),
  ('summer-2026-10-2026-06-05', 'aidan-pirc', 2000, 0, 6, null),
  ('summer-2026-10-2026-06-05', 'aiden', 1000, 3589, 2, null),
  ('summer-2026-10-2026-06-05', 'ben', 1000, 3043, 3, null),
  ('summer-2026-10-2026-06-05', 'gage', 2000, 0, 7, null),
  ('summer-2026-10-2026-06-05', 'raghav', 4000, 0, 8, null),
  ('summer-2026-10-2026-06-05', 'tim', 2000, 5128, 1, null),
  ('summer-2026-10-2026-06-05', 'zach', 1000, 0, 5, null),
  ('summer-2026-10-2026-06-05', 'zimmy', 1000, 2215, 4, null),
  ('summer-2026-20-2026-06-30', 'ben', 2000, 7560, 2, null),
  ('summer-2026-20-2026-06-30', 'calen', 8000, 8000, 3, null),
  ('summer-2026-20-2026-06-30', 'cam', 2000, 0, 8, null),
  ('summer-2026-20-2026-06-30', 'chris-s', 4000, 3210, 5, null),
  ('summer-2026-20-2026-06-30', 'drew', 2000, 8430, 1, null),
  ('summer-2026-20-2026-06-30', 'gage', 2000, 0, 9, null),
  ('summer-2026-20-2026-06-30', 'jake', 4000, 3730, 4, null),
  ('summer-2026-20-2026-06-30', 'mason', 3000, 1250, 7, null),
  ('summer-2026-20-2026-06-30', 'stone', 2000, 800, 6, null),
  ('summer-2026-20-2026-06-30', 'zimmy', 4000, 0, 10, null),
  ('summer-2026-20-2026-07-14', 'aidan-pirc', 6000, 6670, 4, null),
  ('summer-2026-20-2026-07-14', 'ben', 2000, 5780, 2, null),
  ('summer-2026-20-2026-07-14', 'calen', 10000, 1140, 7, null),
  ('summer-2026-20-2026-07-14', 'cam', 2000, 4900, 3, null),
  ('summer-2026-20-2026-07-14', 'mason', 2000, 0, 5, null),
  ('summer-2026-20-2026-07-14', 'tim', 2000, 0, 6, null),
  ('summer-2026-20-2026-07-14', 'zimmy', 2000, 7520, 1, null),
  ('summer-2026-20-2026-07-18', 'ben', 6000, 1660, 9, null),
  ('summer-2026-20-2026-07-18', 'calen', 2000, 0, 6, null),
  ('summer-2026-20-2026-07-18', 'chris-s', 2000, 6110, 3, null),
  ('summer-2026-20-2026-07-18', 'drew', 5000, 10290, 1, null),
  ('summer-2026-20-2026-07-18', 'jake', 2000, 5110, 4, null),
  ('summer-2026-20-2026-07-18', 'maggie', 2000, 0, 7, null),
  ('summer-2026-20-2026-07-18', 'mason', 2000, 1000, 5, null),
  ('summer-2026-20-2026-07-18', 'raghav', 2000, 0, 8, null),
  ('summer-2026-20-2026-07-18', 'tim', 2000, 6830, 2, null),
  ('summer-2026-20-2026-07-18', 'zimmy', 6000, 0, 10, null),
  ('summer-2026-20-2026-07-28', 'ben', 6000, 6020, 3, null),
  ('summer-2026-20-2026-07-28', 'calen', 4000, 1560, 10, null),
  ('summer-2026-20-2026-07-28', 'cam', 2000, 6320, 2, null),
  ('summer-2026-20-2026-07-28', 'chris', 2000, 0, 6, null),
  ('summer-2026-20-2026-07-28', 'drew', 4000, 4000, 4, null),
  ('summer-2026-20-2026-07-28', 'jake', 2000, 8200, 1, null),
  ('summer-2026-20-2026-07-28', 'lucas', 3000, 2860, 5, null),
  ('summer-2026-20-2026-07-28', 'mason', 2000, 0, 7, null),
  ('summer-2026-20-2026-07-28', 'owen', 4000, 2000, 8, null),
  ('summer-2026-20-2026-07-28', 'raghav', 2000, 0, 9, null),
  ('summer-2026-20-2026-08-11', 'ben', 2000, 2000, 2, null),
  ('summer-2026-20-2026-08-11', 'jake', 4000, 3140, 4, null),
  ('summer-2026-20-2026-08-11', 'joey', 2000, 1500, 3, null),
  ('summer-2026-20-2026-08-11', 'lucas', 2000, 0, 5, null),
  ('summer-2026-20-2026-08-11', 'mason', 2000, 5360, 1, null),
  ('summer-2026-20-2026-08-16', 'aidan-pirc', 6000, 2000, 11, null),
  ('summer-2026-20-2026-08-16', 'aiden', 2000, 2070, 4, null),
  ('summer-2026-20-2026-08-16', 'ben', 4000, 1270, 8, null),
  ('summer-2026-20-2026-08-16', 'calen', 4000, 12600, 1, null),
  ('summer-2026-20-2026-08-16', 'chris-s', 6000, 2280, 10, null),
  ('summer-2026-20-2026-08-16', 'drew', 2000, 0, 6, null),
  ('summer-2026-20-2026-08-16', 'mason', 2000, 3350, 3, null),
  ('summer-2026-20-2026-08-16', 'max', 2000, 1040, 5, null),
  ('summer-2026-20-2026-08-16', 'raghav', 2000, 0, 7, null),
  ('summer-2026-20-2026-08-16', 'tim', 4000, 1090, 9, -3110),
  ('summer-2026-20-2026-08-16', 'zimmy', 2000, 10300, 2, null);

do $poker_import$
declare conflict_id text;
begin
  if exists (select 1 from public.leagues where id = '00000000-0000-4000-8000-000000000001'::uuid and slug <> 'unc-poker') then
    raise exception 'Workbook import league ID belongs to a different league. No changes were applied.';
  end if;

  select s.id into conflict_id
  from _poker_import_games s
  where not exists (select 1 from public.games g where g.league_id = '00000000-0000-4000-8000-000000000001'::uuid and g.id = s.id)
    and exists (select 1 from public.game_audit_log a where a.league_id = '00000000-0000-4000-8000-000000000001'::uuid and a.game_id = s.id and a.action = 'delete')
  limit 1;
  if conflict_id is not null then
    raise exception 'Workbook import includes previously deleted game %. Portal deletions will not be restored. No changes were applied.', conflict_id;
  end if;

  select p.id into conflict_id
  from public.players p join _poker_import_players s on p.id = s.id
  where p.league_id = '00000000-0000-4000-8000-000000000001'::uuid
    and (p.display_name is distinct from s.display_name
      or array(select unnest(p.aliases) order by 1) is distinct from array(select unnest(s.aliases) order by 1))
  limit 1;
  if conflict_id is not null then
    raise exception 'Workbook import conflicts with existing player %. No changes were applied.', conflict_id;
  end if;

  select g.id into conflict_id
  from public.games g join _poker_import_games s on g.id = s.id
  where g.league_id = '00000000-0000-4000-8000-000000000001'::uuid
    and (g.source_ref is distinct from s.source_ref or g.title is distinct from s.title
      or g.date is distinct from s.date or g.season_id is distinct from s.season_id
      or g.night_type is distinct from s.night_type or g.format is distinct from s.format
      or g.status is distinct from s.status or g.notes is distinct from s.notes)
  limit 1;
  if conflict_id is not null then
    raise exception 'Workbook import conflicts with existing game %. Review its source or portal edits. No changes were applied.', conflict_id;
  end if;

  select g.id into conflict_id
  from public.games g join _poker_import_games s on g.id = s.id
  where g.league_id = '00000000-0000-4000-8000-000000000001'::uuid and (
    exists (
      (select r.player_id, r.buy_in_cents, r.cash_out_cents, r.placement, r.legacy_profit_cents
       from public.game_results r where r.league_id = g.league_id and r.game_id = g.id)
      except
      (select r.player_id, r.buy_in_cents, r.cash_out_cents, r.placement, r.legacy_profit_cents
       from _poker_import_results r where r.game_id = g.id)
    ) or exists (
      (select r.player_id, r.buy_in_cents, r.cash_out_cents, r.placement, r.legacy_profit_cents
       from _poker_import_results r where r.game_id = g.id)
      except
      (select r.player_id, r.buy_in_cents, r.cash_out_cents, r.placement, r.legacy_profit_cents
       from public.game_results r where r.league_id = g.league_id and r.game_id = g.id)
    )
  ) limit 1;
  if conflict_id is not null then
    raise exception 'Workbook import conflicts with existing results for game %. Portal results will not be restored or overwritten. No changes were applied.', conflict_id;
  end if;
end;
$poker_import$;

insert into public.leagues (id, slug, name)
values ('00000000-0000-4000-8000-000000000001'::uuid, 'unc-poker', 'UNC Poker')
on conflict (id) do nothing;

insert into public.players (league_id, id, display_name, aliases)
select '00000000-0000-4000-8000-000000000001'::uuid, id, display_name, aliases from _poker_import_players
on conflict (league_id, id) do nothing;

-- Only the games inserted in this statement may receive results.
-- A rerun cannot recreate removed players/results on an existing game.
with inserted_games as (
  insert into public.games (league_id, id, title, date, season_id, night_type, format, status, notes, source_ref)
  select '00000000-0000-4000-8000-000000000001'::uuid, id, title, date, season_id, night_type, format, status, notes, source_ref
  from _poker_import_games
  on conflict (league_id, id) do nothing
  returning league_id, id
)
insert into public.game_results (league_id, game_id, player_id, buy_in_cents, cash_out_cents, placement, legacy_profit_cents)
select g.league_id, r.game_id, r.player_id, r.buy_in_cents, r.cash_out_cents, r.placement, r.legacy_profit_cents
from _poker_import_results r join inserted_games g on g.id = r.game_id;

commit;
