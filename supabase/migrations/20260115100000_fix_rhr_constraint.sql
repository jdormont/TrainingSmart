-- Relax the resting_hr constraint to allow 0 (missing data)
-- The original constraint likely required RHR >= 30, which causes sync to fail on days with partial Oura data.

DO $$
BEGIN
    -- Try to drop the standard named constraint
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'daily_metrics_resting_hr_check') THEN
        ALTER TABLE daily_metrics DROP CONSTRAINT daily_metrics_resting_hr_check;
    END IF;

    -- Try to drop the potential typo'd constraint name from the error message
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dailt_metrics_resting_hr_check') THEN
        ALTER TABLE daily_metrics DROP CONSTRAINT "dailt_metrics_resting_hr_check";
    END IF;
END $$;

-- Add the new, relaxed constraint
ALTER TABLE daily_metrics
ADD CONSTRAINT daily_metrics_resting_hr_check 
CHECK (resting_hr >= 0 AND resting_hr <= 220);
