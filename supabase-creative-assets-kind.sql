-- Run once in the Supabase SQL editor.
-- The original creative_assets table restricts `kind` to ('youtube','image').
-- The MFG Creative Uploads tab also writes kind='drive' for Drive-link assets,
-- so widen the check.

alter table public.creative_assets
  drop constraint if exists creative_assets_kind_check;

alter table public.creative_assets
  add constraint creative_assets_kind_check
  check (kind in ('youtube', 'image', 'drive'));
