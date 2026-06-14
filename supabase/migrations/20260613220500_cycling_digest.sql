-- Cache table for Cycling News Digest
CREATE TABLE IF NOT EXISTS cycling_digest_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  generated_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL,
  expires_at timestamptz NOT NULL
);

-- User discipline filter preferences (add column to existing user_profiles)
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS cycling_digest_filters text[] DEFAULT ARRAY['road', 'gravel', 'womens', 'track', 'cyclocross', 'other'];

-- Add index on expires_at in cycling_digest_cache for efficient TTL cleanups and checks
CREATE INDEX IF NOT EXISTS idx_cycling_digest_cache_expires_at ON cycling_digest_cache(expires_at);
