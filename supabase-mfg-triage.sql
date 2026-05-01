-- Run once in the Supabase SQL editor to enable Global Triage cloud sync.
-- Anyone with the project's publishable key can read and write this table.
-- Access is gated app-side by the MFG password.

create table if not exists public.mfg_triage (
  id text primary key,
  data jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table public.mfg_triage enable row level security;

-- Permissive policies: app-level password is the gate
drop policy if exists "mfg_triage select all" on public.mfg_triage;
create policy "mfg_triage select all" on public.mfg_triage
  for select using (true);

drop policy if exists "mfg_triage insert all" on public.mfg_triage;
create policy "mfg_triage insert all" on public.mfg_triage
  for insert with check (true);

drop policy if exists "mfg_triage update all" on public.mfg_triage;
create policy "mfg_triage update all" on public.mfg_triage
  for update using (true) with check (true);

-- Seed the single row so the first visitor doesn't have to
insert into public.mfg_triage (id, data) values (
  'global',
  '{"columns":[{"id":"t1","title":"Updates","items":[]},{"id":"t2","title":"What''s Next","items":[]}]}'::jsonb
) on conflict (id) do nothing;

-- Snapshots: one row per saved version (the user clicks "Save snapshot" each
-- week). The live state still lives in mfg_triage; this table is the archive.
create table if not exists public.mfg_triage_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null,
  data jsonb not null,
  note text,
  saved_at timestamptz not null default now(),
  saved_by text
);

create index if not exists mfg_triage_snapshots_saved_at_idx
  on public.mfg_triage_snapshots (saved_at desc);

alter table public.mfg_triage_snapshots enable row level security;

drop policy if exists "mfg_triage_snapshots select all" on public.mfg_triage_snapshots;
create policy "mfg_triage_snapshots select all" on public.mfg_triage_snapshots
  for select using (true);

drop policy if exists "mfg_triage_snapshots insert all" on public.mfg_triage_snapshots;
create policy "mfg_triage_snapshots insert all" on public.mfg_triage_snapshots
  for insert with check (true);

drop policy if exists "mfg_triage_snapshots delete all" on public.mfg_triage_snapshots;
create policy "mfg_triage_snapshots delete all" on public.mfg_triage_snapshots
  for delete using (true);
