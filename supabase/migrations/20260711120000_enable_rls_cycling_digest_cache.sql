-- Enable RLS on cycling_digest_cache (Supabase linter: rls_disabled_in_public).
-- This table is a shared cache populated/read only by the cycling-news-digest
-- edge function via the service-role client, which bypasses RLS. No policies
-- are added, so PostgREST denies all access to anon/authenticated roles.
ALTER TABLE cycling_digest_cache ENABLE ROW LEVEL SECURITY;
