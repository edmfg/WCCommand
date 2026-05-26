-- Run once in the Supabase SQL editor to enable Vacation Schedule cloud sync.
-- Single-row table, same pattern as reactive_cycle and mfg_triage.

create table if not exists public.vacation_schedule (
  id text primary key,
  data jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table public.vacation_schedule enable row level security;

drop policy if exists "vacation_schedule select all" on public.vacation_schedule;
create policy "vacation_schedule select all" on public.vacation_schedule
  for select using (true);

drop policy if exists "vacation_schedule insert all" on public.vacation_schedule;
create policy "vacation_schedule insert all" on public.vacation_schedule
  for insert with check (true);

drop policy if exists "vacation_schedule update all" on public.vacation_schedule;
create policy "vacation_schedule update all" on public.vacation_schedule
  for update using (true) with check (true);

insert into public.vacation_schedule (id, data) values (
  'default',
  '{"rows":[]}'::jsonb
) on conflict (id) do nothing;
