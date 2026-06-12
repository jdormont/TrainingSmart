-- Add Oura-specific columns to daily_metrics table
-- Using IF NOT EXISTS to prevent errors if you already added some of them

ALTER TABLE daily_metrics 
ADD COLUMN IF NOT EXISTS deep_sleep_minutes integer,
ADD COLUMN IF NOT EXISTS rem_sleep_minutes integer,
ADD COLUMN IF NOT EXISTS light_sleep_minutes integer,
ADD COLUMN IF NOT EXISTS sleep_efficiency integer, -- percentage 0-100
ADD COLUMN IF NOT EXISTS temperature_deviation numeric,
ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual'; -- 'oura', 'manual', 'apple_health'

-- Update constraint to ensure sleep_efficiency is valid (optional)
ALTER TABLE daily_metrics 
DROP CONSTRAINT IF EXISTS daily_metrics_sleep_efficiency_check;

ALTER TABLE daily_metrics
ADD CONSTRAINT daily_metrics_sleep_efficiency_check 
CHECK (sleep_efficiency >= 0 AND sleep_efficiency <= 100);
