-- Run once in the Supabase SQL editor to enable One Reactive Cycle cloud sync.
-- Single-row table, same pattern as mfg_triage. App-level MFG password gates
-- writes; reads use the publishable key + permissive RLS.

create table if not exists public.reactive_cycle (
  id text primary key,
  data jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table public.reactive_cycle enable row level security;

drop policy if exists "reactive_cycle select all" on public.reactive_cycle;
create policy "reactive_cycle select all" on public.reactive_cycle
  for select using (true);

drop policy if exists "reactive_cycle insert all" on public.reactive_cycle;
create policy "reactive_cycle insert all" on public.reactive_cycle
  for insert with check (true);

drop policy if exists "reactive_cycle update all" on public.reactive_cycle;
create policy "reactive_cycle update all" on public.reactive_cycle
  for update using (true) with check (true);

-- Seed the single row so the first edit doesn't have to insert.
insert into public.reactive_cycle (id, data) values (
  'default',
  '{"rows":[]}'::jsonb
) on conflict (id) do nothing;
