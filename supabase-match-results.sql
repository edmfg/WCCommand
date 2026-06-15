-- match_results — cron-scraped 2026 World Cup scores.
--
-- The /api/refresh cron asks Gemini (Google Search grounding) for the final /
-- live score of every match that has kicked off, and upserts one row per match
-- here using the service-role key. The public dashboard reads this table with
-- the publishable (anon) key and stamps score/status onto the matching
-- DASHBOARD_DATA.matches fixture (by date + FIFA tricodes), so the Fixtures
-- Calendar + Standings show results without a redeploy.
--
-- Natural key is (match_date, home_code, away_code) so re-runs upsert in place
-- instead of piling up duplicate rows. Idempotent — safe to re-run.

create table if not exists match_results (
  id          bigint generated always as identity primary key,
  match_date  date not null,
  home_code   text not null,
  away_code   text not null,
  home_team   text,
  away_team   text,
  home_score  int,
  away_score  int,
  status      text not null default 'final',
  updated_at  timestamptz not null default now(),
  unique (match_date, home_code, away_code)
);

-- RLS on, public read only. Writes go through the service-role key, which
-- bypasses RLS — matching every other table in this project (the app-level
-- password gates are the real access control).
alter table match_results enable row level security;

drop policy if exists "match_results public read" on match_results;
create policy "match_results public read"
  on match_results for select
  using (true);

grant select on match_results to anon, authenticated;
