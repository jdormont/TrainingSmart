-- Add Apple Watch activity metrics to daily_metrics
ALTER TABLE daily_metrics 
ADD COLUMN IF NOT EXISTS active_calories integer,
ADD COLUMN IF NOT EXISTS stand_hours integer,
ADD COLUMN IF NOT EXISTS exercise_minutes integer,
ADD COLUMN IF NOT EXISTS daily_steps integer;

ALTER TABLE daily_metrics
ADD CONSTRAINT daily_metrics_active_calories_check CHECK (active_calories IS NULL OR active_calories >= 0),
ADD CONSTRAINT daily_metrics_stand_hours_check CHECK (stand_hours IS NULL OR stand_hours >= 0),
ADD CONSTRAINT daily_metrics_exercise_minutes_check CHECK (exercise_minutes IS NULL OR exercise_minutes >= 0),
ADD CONSTRAINT daily_metrics_daily_steps_check CHECK (daily_steps IS NULL OR daily_steps >= 0);