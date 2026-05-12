-- live_updates: AI-fetched news / social / ticker items written by the
-- MFG "Refresh Content" button. The public dashboard reads recent rows
-- on load and prepends them to DASHBOARD_DATA.news / .social / .ticker.
--
-- Run once in the Supabase SQL editor.

create table if not exists public.live_updates (
  id text primary key,
  kind text not null check (kind in ('news','social','ticker')),
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists live_updates_created_idx
  on public.live_updates (created_at desc);

create index if not exists live_updates_kind_created_idx
  on public.live_updates (kind, created_at desc);

alter table public.live_updates enable row level security;

drop policy if exists "live_updates_read"   on public.live_updates;
drop policy if exists "live_updates_insert" on public.live_updates;
drop policy if exists "live_updates_delete" on public.live_updates;

-- App-level gate is the actual access control (matches the rest of this schema).
create policy "live_updates_read"   on public.live_updates for select using (true);
create policy "live_updates_insert" on public.live_updates for insert with check (true);
create policy "live_updates_delete" on public.live_updates for delete using (true);
