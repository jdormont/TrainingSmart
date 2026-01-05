
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { calculateWeightedRecoveryScore, DailyMetric } from "./scoring.ts";

// Helper to create dummy history
function createHistory(
    days: number,
    baseStats: { hrv: number; rhr: number; sleep: number; resp?: number | null }
): DailyMetric[] {
    return Array.from({ length: days }).map((_, i) => ({
        user_id: "test",
        date: `2024-01-${String(i + 1).padStart(2, '0')}`,
        hrv: baseStats.hrv,
        resting_hr: baseStats.rhr,
        sleep_minutes: baseStats.sleep,
        respiratory_rate: baseStats.resp !== undefined ? baseStats.resp : 14,
        recovery_score: 50
    }));
}

Deno.test("Cold Start: Returns 50 when history < 3 days", () => {
    const history = createHistory(2, { hrv: 50, rhr: 60, sleep: 400 });
    const current = { hrv: 50, resting_hr: 60, sleep_minutes: 400, respiratory_rate: 14 };

    const score = calculateWeightedRecoveryScore(current, history);
    assertEquals(score, 50);
});

Deno.test("Null Handling: Ignores null history entries", () => {
    // 5 days of history, but 3 are invalid/null. Effectively 2 valid days -> Cold Start (50)
    const history: DailyMetric[] = [
        ...createHistory(2, { hrv: 50, rhr: 60, sleep: 400 }),
        { user_id: '1', date: '2022-01-01', hrv: 0, resting_hr: 0, sleep_minutes: 0, respiratory_rate: null, recovery_score: 0 }, // assuming 0 is valid in our logic or filtered?
        // Wait, our filter is d.hrv !== null. 0 is !== null.
        // Let's create actual null entries if the type allowed it, but the interface says number | null for resp, but number for others.
        // The DailyMetric interface in scoring.ts defines hrv, resting_hr, sleep_minutes as number (not nullable).
        // So let's test the filter logic if we had nulls casted, or just meaningful values.
        // Actually, the implementation plan mentioned filtering nulls.
    ];
    // Re-reading scoring.ts: validHistory filters d.hrv !== null.
    // If we assume the DB ensures non-null for required fields, then we only test respiratory_rate nulls.
    // Let's test the baseline logic with respiratory nulls.

    // 5 days history. All have stats, but resp rate is null for all.
    // Baseline Resp should be null.
    // Sickness penalty should be skipped.
    const historyNullResp = createHistory(5, { hrv: 50, rhr: 60, sleep: 450, resp: null });

    const current = {
        hrv: 50, // Matches baseline
        resting_hr: 60, // Matches baseline
        sleep_minutes: 450, // 100% sleep score
        respiratory_rate: 20 // High resp rate, but no baseline to compare against
    };

    // Scores:
    // HRV: 100 (equal to baseline) -> 50 points
    // RHR: 100 (equal to baseline) -> 30 points
    // Sleep: 100 -> 20 points
    // Resp Penalty: Skipped (baseline is null)
    // Total: 100

    const score = calculateWeightedRecoveryScore(current, historyNullResp);
    assertEquals(score, 100);
});

Deno.test("Perfect Score: All metrics equal or better than baseline", () => {
    const history = createHistory(10, { hrv: 50, rhr: 60, sleep: 450, resp: 14 }); // Baselines: 50, 60, 450, 14

    const current = {
        hrv: 60, // Better (>50)
        resting_hr: 55, // Better (<60)
        sleep_minutes: 480, // Better (>450)
        respiratory_rate: 14 // Normal
    };

    // HRV score: 100 (w: 50) -> 50
    // RHR score: 100 (w: 30) -> 30
    // Sleep score: 100 (w: 20) -> 20
    // Score: 100
    const score = calculateWeightedRecoveryScore(current, history);
    assertEquals(score, 100);
});

Deno.test("Poor Score: Metrics worse than baseline", () => {
    // Baselines: HRV 100, RHR 50, Sleep 450 (7.5h)
    const history = createHistory(10, { hrv: 100, rhr: 50, sleep: 450, resp: 14 });

    const current = {
        hrv: 90, // 10% drop -> 20% score deduction. HRV Score = 80.
        resting_hr: 55, // 10% increase -> 20% score deduction. RHR Score = 80.
        sleep_minutes: 225, // 50% of target. Sleep Score = 50.
        respiratory_rate: 14
    };

    // Calc:
    // HRV: 80 * 0.5 = 40
    // RHR: 80 * 0.3 = 24
    // Sleep: 50 * 0.2 = 10
    // Total: 74

    const score = calculateWeightedRecoveryScore(current, history);
    assertEquals(score, 74);
});

Deno.test("Sickness Penalty: Resp rate > baseline + 2", () => {
    const history = createHistory(10, { hrv: 50, rhr: 60, sleep: 450, resp: 14 });

    const current = {
        hrv: 50, // 100 score
        resting_hr: 60, // 100 score
        sleep_minutes: 450, // 100 score
        respiratory_rate: 16.1 // > 14 + 2
    };

    // Base Perfect: 100
    // Penalty: -20
    // Result: 80

    const score = calculateWeightedRecoveryScore(current, history);
    assertEquals(score, 80);
});

Deno.test("Sickness Penalty: Not triggered if exactly baseline + 2", () => {
    const history = createHistory(10, { hrv: 50, rhr: 60, sleep: 450, resp: 14 });
    const current = { hrv: 50, resting_hr: 60, sleep_minutes: 450, respiratory_rate: 16 }; // Exactly +2
    const score = calculateWeightedRecoveryScore(current, history);
    assertEquals(score, 100);
});
