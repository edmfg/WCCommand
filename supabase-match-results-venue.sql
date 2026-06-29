-- match_results: add a venue column so the client can bind cron-scraped
-- KNOCKOUT results to the right fixture slot.
--
-- Why: group-stage results bind to fixtures by FIFA tricode (home_code/away_code
-- match the DASHBOARD_DATA.matches codes). Knockout fixtures ship as bracket
-- PLACEHOLDERS ("A2", "B2", "E1", "3rd", "W73"…) with no real codes, so a scraped
-- result like RSA vs CAN has nothing to bind to and the fixture stays blank
-- (white flags). The (date, venue) pair is the stable identity of a knockout
-- fixture — FIFA assigns each match number to a fixed date + stadium before the
-- draw — so the cron now also records the stadium, and the client maps
-- (match_date, venue) → fixture id to fill in the real teams, then propagates
-- winners through the rest of the bracket.
--
-- Idempotent — safe to re-run.

alter table match_results
  add column if not exists venue text;
