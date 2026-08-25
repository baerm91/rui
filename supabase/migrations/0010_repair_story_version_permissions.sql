-- The version dialog reads version metadata directly under RLS. Keep writes
-- behind the trigger and restore RPC, but restore the authenticated read grant.
revoke insert, update, delete, truncate, references, trigger
  on table public.story_versions from authenticated;
grant select on table public.story_versions to authenticated;

