-- Run once in the Supabase SQL editor to extend the creative_assets table
-- with fields needed for the MFG "Creative Uploads" tab (Drive-link uploads).

-- Drive link details (we extract the file id from the URL on the client and
-- store both so we can rebuild thumbnails without re-parsing).
alter table public.creative_assets
  add column if not exists drive_url text;

alter table public.creative_assets
  add column if not exists drive_file_id text;

-- A campaign can run across a window. The existing `deploy_date` column holds
-- the start; this is the optional end of the window.
alter table public.creative_assets
  add column if not exists live_end_date date;

-- Channel where the asset will run. Optional, default "IG".
alter table public.creative_assets
  add column if not exists channel text;
