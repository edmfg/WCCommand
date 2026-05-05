-- Run once in the Supabase SQL editor to add the optional "bento" tag
-- to creative_assets. Used by the MFG Creative Uploads tab.

alter table public.creative_assets
  add column if not exists bento text;
