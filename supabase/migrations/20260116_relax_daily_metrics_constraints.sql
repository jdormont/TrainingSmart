-- Relax constraints on daily_metrics to allow partial data (e.g. Oura Readiness only)

-- 1. Make columns nullable
ALTER TABLE daily_metrics ALTER COLUMN sleep_minutes DROP NOT NULL;
ALTER TABLE daily_metrics ALTER COLUMN resting_hr DROP NOT NULL;
ALTER TABLE daily_metrics ALTER COLUMN hrv DROP NOT NULL;
ALTER TABLE daily_metrics ALTER COLUMN recovery_score DROP NOT NULL;

-- 2. Drop existing strict check constraints
ALTER TABLE daily_metrics DROP CONSTRAINT IF EXISTS daily_metrics_sleep_minutes_check;
ALTER TABLE daily_metrics DROP CONSTRAINT IF EXISTS daily_metrics_resting_hr_check;
ALTER TABLE daily_metrics DROP CONSTRAINT IF EXISTS daily_metrics_hrv_check;
ALTER TABLE daily_metrics DROP CONSTRAINT IF EXISTS daily_metrics_recovery_score_check;

-- 3. Add new check constraints that allow NULL but enforce ranges if value is present
ALTER TABLE daily_metrics ADD CONSTRAINT daily_metrics_sleep_minutes_check 
    CHECK (sleep_minutes IS NULL OR sleep_minutes >= 0);

ALTER TABLE daily_metrics ADD CONSTRAINT daily_metrics_resting_hr_check 
    CHECK (resting_hr IS NULL OR (resting_hr >= 20 AND resting_hr <= 200)); -- Lowered min to 20 for extreme athletes/errors

ALTER TABLE daily_metrics ADD CONSTRAINT daily_metrics_hrv_check 
    CHECK (hrv IS NULL OR (hrv >= 0 AND hrv <= 300));

ALTER TABLE daily_metrics ADD CONSTRAINT daily_metrics_recovery_score_check 
    CHECK (recovery_score IS NULL OR (recovery_score >= 0 AND recovery_score <= 100));
