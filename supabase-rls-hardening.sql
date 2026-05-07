-- RLS hardening — drops the permissive insert/update/delete policies that
-- shipped with the original migrations. After this runs:
--   • anon / publishable-key writes are denied at the database
--   • SELECT remains permissive so the dashboard renders without a server hop
--   • the service role (used by /api/sb-write) bypasses RLS as it always has
--
-- Apply once in the Supabase SQL editor. Idempotent; safe to re-run.

-- ── mfg_triage ──────────────────────────────────────────────────────────
drop policy if exists "mfg_triage insert all" on public.mfg_triage;
drop policy if exists "mfg_triage update all" on public.mfg_triage;
-- (kept) "mfg_triage select all"

-- ── mfg_triage_snapshots ───────────────────────────────────────────────
drop policy if exists "mfg_triage_snapshots insert all"
  on public.mfg_triage_snapshots;
drop policy if exists "mfg_triage_snapshots delete all"
  on public.mfg_triage_snapshots;
-- (kept) "mfg_triage_snapshots select all"

-- ── creative_assets ────────────────────────────────────────────────────
do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='creative_assets'
  ) then
    -- Drop any policy that allows mutations to anon. Names from prior
    -- migrations vary, so we drop by a known set of likely names.
    perform 1;
  end if;
end$$;

drop policy if exists "creative_assets insert all" on public.creative_assets;
drop policy if exists "creative_assets update all" on public.creative_assets;
drop policy if exists "creative_assets delete all" on public.creative_assets;
drop policy if exists "Allow all" on public.creative_assets;

-- Ensure RLS is on so the absence of a write policy denies anon writes.
alter table public.creative_assets enable row level security;

-- Re-create a permissive SELECT policy (idempotent).
drop policy if exists "creative_assets select all" on public.creative_assets;
create policy "creative_assets select all" on public.creative_assets
  for select using (true);

-- ── today_reactive ─────────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.today_reactive') is not null then
    execute 'alter table public.today_reactive enable row level security';
    execute 'drop policy if exists "today_reactive insert all" on public.today_reactive';
    execute 'drop policy if exists "today_reactive update all" on public.today_reactive';
    execute 'drop policy if exists "today_reactive delete all" on public.today_reactive';
    execute 'drop policy if exists "today_reactive select all" on public.today_reactive';
    execute 'create policy "today_reactive select all" on public.today_reactive for select using (true)';
  end if;
end$$;

-- ── dashboard_updates ──────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.dashboard_updates') is not null then
    execute 'alter table public.dashboard_updates enable row level security';
    execute 'drop policy if exists "dashboard_updates insert all" on public.dashboard_updates';
    execute 'drop policy if exists "dashboard_updates update all" on public.dashboard_updates';
    execute 'drop policy if exists "dashboard_updates delete all" on public.dashboard_updates';
    execute 'drop policy if exists "dashboard_updates select all" on public.dashboard_updates';
    execute 'create policy "dashboard_updates select all" on public.dashboard_updates for select using (true)';
  end if;
end$$;

-- ── dashboard_content ──────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.dashboard_content') is not null then
    execute 'alter table public.dashboard_content enable row level security';
    execute 'drop policy if exists "dashboard_content insert all" on public.dashboard_content';
    execute 'drop policy if exists "dashboard_content update all" on public.dashboard_content';
    execute 'drop policy if exists "dashboard_content delete all" on public.dashboard_content';
    execute 'drop policy if exists "dashboard_content select all" on public.dashboard_content';
    execute 'create policy "dashboard_content select all" on public.dashboard_content for select using (true)';
  end if;
end$$;

-- ── Storage bucket policies (run separately if applicable) ─────────────
-- The Creative Uploads flow may also write to a Storage bucket via the
-- publishable key. If a bucket named 'creative' (or whatever
-- CREATIVE_BUCKET resolves to in index.html) is in use, harden it via the
-- Supabase Storage policy editor:
--   • Insert: revoke from anon (only authenticated / service_role)
--   • Update / Delete: revoke from anon
--   • Select: keep permissive if assets are publicly previewed
-- The /api/sb-write proxy doesn't currently handle Storage uploads;
-- if you depend on that path, add a /api/sb-storage-upload endpoint.
