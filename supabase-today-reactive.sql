-- Today's Reactive payloads keyed by market.
-- Each row is one published reactive briefing; the most recent row per
-- market is what social.html renders. Older rows stay around as audit history.

create extension if not exists "pgcrypto";

create table if not exists today_reactive (
  id uuid primary key default gen_random_uuid(),
  market text not null,
  payload jsonb not null,
  raw_input text,
  uploaded_by text,
  live_date date default current_date,
  created_at timestamptz default now()
);

create index if not exists today_reactive_market_idx
  on today_reactive (market, created_at desc);

alter table today_reactive enable row level security;

drop policy if exists "today_reactive read" on today_reactive;
create policy "today_reactive read"
  on today_reactive for select
  using (true);

drop policy if exists "today_reactive write" on today_reactive;
create policy "today_reactive write"
  on today_reactive for insert
  with check (true);
