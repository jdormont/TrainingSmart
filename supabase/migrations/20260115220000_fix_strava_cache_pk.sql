-- Fix RLS violations by allowing multiple users to cache the same Strava activity
-- Currently, 'id' is the PK, so if two users sync the same activity (e.g. dev testing), 
-- the second user fails to UPSERT due to RLS blocking the UPDATE of the first user's row.
-- Changing PK to (user_id, id) isolates each user's cache.

BEGIN;

-- Drop the existing primary key
ALTER TABLE strava_activities_cache DROP CONSTRAINT IF EXISTS strava_activities_cache_pkey;

-- Add new composite primary key
ALTER TABLE strava_activities_cache ADD PRIMARY KEY (user_id, id);

COMMIT;
