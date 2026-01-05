
export interface HealthPayload {
    user_id: string;
    sleep_minutes: number;
    resting_hr: number;
    hrv: number;
    respiratory_rate?: number;
    date?: string;
}

export interface DailyMetric {
    user_id: string;
    date: string;
    sleep_minutes: number;
    resting_hr: number;
    hrv: number;
    respiratory_rate: number | null;
    recovery_score: number;
}

/**
 * Calculates the weighted recovery score based on daily metrics and historical baseline.
 * 
 * Algorithm:
 * 1. Fetch Baselines: Mean of last 30 days (excluding nulls).
 * 2. Cold Start: If < 3 days of valid history, return 50.
 * 3. HRV Score (50% Weight): 
 *    - If >= baseline, score 100.
 *    - If < baseline, decay: 10% drop = 20% score reduction.
 * 4. RHR Score (30% Weight): 
 *    - If <= baseline, score 100.
 *    - If > baseline, deduct points (higher is worse).
 * 5. Sleep Score (20% Weight): 
 *    - Target 450 mins (7.5 hrs). (Sleep / 450) * 100, capped at 100.
 * 6. Sickness Penalty:
 *    - If current respiratory_rate > baseline + 2, deduct 20 points.
 * 
 * @param current - The current day's metrics
 * @param history - Array of historical DailyMetric entries (last 30 days)
 * @returns integer score 0-100
 */
export function calculateWeightedRecoveryScore(
    current: { sleep_minutes: number; hrv: number; resting_hr: number; respiratory_rate?: number | null },
    history: DailyMetric[]
): number {
    // 1. Filter history for valid baselines (ignore nulls where appropriate)
    const validHistory = history.filter(d =>
        d.hrv !== null && d.resting_hr !== null && d.sleep_minutes !== null
    );

    // 2. Cold Start Handling
    // If we don't have enough data to form a reliable baseline, return neutral score
    if (validHistory.length < 3) {
        return 50;
    }

    // Calculate Baselines
    const baselineHRV = validHistory.reduce((acc, d) => acc + d.hrv, 0) / validHistory.length;
    const baselineRHR = validHistory.reduce((acc, d) => acc + d.resting_hr, 0) / validHistory.length;

    // Respiratory Rate Baseline (only use records that have it)
    const respHistory = history.filter(d => d.respiratory_rate !== null && d.respiratory_rate !== undefined);
    const baselineRespRate = respHistory.length > 0
        ? respHistory.reduce((acc, d) => acc + (d.respiratory_rate as number), 0) / respHistory.length
        : null;

    // --- Sub-score Calculation ---

    // 3. HRV Score (50% Weight)
    let hrvScore = 0;
    if (current.hrv >= baselineHRV) {
        hrvScore = 100;
    } else {
        // Decay: 10% drop below baseline = 20% score reduction.
        // Formula: percentage_drop = (baseline - current) / baseline
        // score_deduction = (percentage_drop / 0.10) * 20
        // Simplified: deduction = percentage_drop * 200
        if (baselineHRV > 0) {
            const dropPct = (baselineHRV - current.hrv) / baselineHRV;
            const deduction = dropPct * 200;
            hrvScore = Math.max(0, 100 - deduction);
        } else {
            hrvScore = 0; // Should not happen with valid baseline check
        }
    }

    // 4. RHR Score (30% Weight)
    let rhrScore = 0;
    if (current.resting_hr <= baselineRHR) {
        rhrScore = 100;
    } else {
        // Deduct points for higher RHR.
        // Heuristic: 10% increase = 20% score reduction? 
        // The prompt just says "If it is higher, deduct points."
        // Let's use a similar decay logic: 10% increase = 20 points off.
        if (baselineRHR > 0) {
            const increasePct = (current.resting_hr - baselineRHR) / baselineRHR;
            const deduction = increasePct * 200;
            rhrScore = Math.max(0, 100 - deduction);
        } else {
            rhrScore = 0;
        }
    }

    // 5. Sleep Score (20% Weight)
    // Target: 450 minutes
    const sleepTarget = 450;
    const sleepScoreRaw = (current.sleep_minutes / sleepTarget) * 100;
    const sleepScore = Math.min(100, Math.max(0, sleepScoreRaw));

    // Weighted Sum
    let totalScore = (hrvScore * 0.5) + (rhrScore * 0.3) + (sleepScore * 0.2);

    // 6. Sickness Penalty
    // Condition: If today's rate is > 2 breaths/min higher than baseline
    if (
        current.respiratory_rate !== undefined &&
        current.respiratory_rate !== null &&
        baselineRespRate !== null
    ) {
        if (current.respiratory_rate > baselineRespRate + 2) {
            totalScore -= 20;
        }
    }

    // Final Clamp 0-100
    return Math.round(Math.min(100, Math.max(0, totalScore)));
}
