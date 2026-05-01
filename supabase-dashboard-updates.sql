-- Run once in the Supabase SQL editor to enable Daily Update cloud sync.
-- Backs the "Daily Update" history list in mfg.html.

create table if not exists public.dashboard_updates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  news_raw text,
  social_raw text,
  generated_json text
);

create index if not exists dashboard_updates_created_at_idx
  on public.dashboard_updates (created_at desc);

alter table public.dashboard_updates enable row level security;

drop policy if exists "dashboard_updates select all" on public.dashboard_updates;
create policy "dashboard_updates select all" on public.dashboard_updates
  for select using (true);

drop policy if exists "dashboard_updates insert all" on public.dashboard_updates;
create policy "dashboard_updates insert all" on public.dashboard_updates
  for insert with check (true);

drop policy if exists "dashboard_updates delete all" on public.dashboard_updates;
create policy "dashboard_updates delete all" on public.dashboard_updates
  for delete using (true);
