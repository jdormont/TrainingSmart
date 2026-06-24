-- Enable RLS on cycling_digest_cache. This table is only read/written by the
-- cycling-news-digest Edge Function via the service role key (which bypasses RLS),
-- so no client-facing policies are needed.
ALTER TABLE cycling_digest_cache ENABLE ROW LEVEL SECURITY;
