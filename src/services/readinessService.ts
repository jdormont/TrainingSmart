import type { DailyMetric, OuraReadinessData, OuraSleepData } from '../types';
import { healthMetricsService } from './healthMetricsService';

export type ReadinessStatus = 'prime' | 'balanced' | 'rest_required';

export interface ReadinessVerdict {
  score: number;
  status: ReadinessStatus;
  statusLabel: 'Prime' | 'Balanced' | 'Rest Required';
  headline: string;
  isSick: boolean;
}

export const READINESS_THRESHOLDS = {
  prime: 80,
  restRequired: 50,
} as const;

interface GetReadinessVerdictInput {
  dailyMetric: DailyMetric | null;
  readinessData?: OuraReadinessData | null;
  sleepData?: OuraSleepData | null;
  sleepHistory?: OuraSleepData[];
}

export const readinessService = {
  getReadinessVerdict({
    dailyMetric,
    readinessData,
    sleepData,
    sleepHistory = [],
  }: GetReadinessVerdictInput): ReadinessVerdict {
    // PRIMARY SCORE LOGIC (same priority as the Recovery tab used to compute inline):
    // 1. Oura Readiness Score, if available (user expectation)
    // 2. Calculated Biological Readiness (custom HRV/RHR/temp/respiratory model)
    // 3. Fallback to the raw stored DailyMetric score
    let biologicalReadiness = null;
    if (sleepData) {
      biologicalReadiness = healthMetricsService.calculateBiologicalReadiness(sleepData, sleepHistory);
    }

    let score = dailyMetric?.recovery_score || 0;
    if (readinessData?.score && readinessData.score > 0) {
      score = readinessData.score;
    } else if (biologicalReadiness) {
      score = biologicalReadiness.score;
    }

    let status: ReadinessStatus =
      score >= READINESS_THRESHOLDS.prime
        ? 'prime'
        : score >= READINESS_THRESHOLDS.restRequired
          ? 'balanced'
          : 'rest_required';

    const isSick = !!biologicalReadiness?.details.temperature.isElevated;
    if (isSick) {
      // Respect the sickness tripwire even if the raw score is high
      status = 'rest_required';
    }

    const statusLabel: ReadinessVerdict['statusLabel'] =
      status === 'prime' ? 'Prime' : status === 'balanced' ? 'Balanced' : 'Rest Required';

    let headline: string;
    if (isSick) {
      headline = `Recovery at ${Math.round(score)} — elevated temperature detected. Prioritize rest.`;
    } else if (status === 'prime') {
      headline = `Recovery at ${Math.round(score)} — you're primed for more today if you want it.`;
    } else if (status === 'rest_required') {
      headline = `Recovery at ${Math.round(score)} — your body is asking for rest today.`;
    } else {
      headline = `Recovery at ${Math.round(score)} — steady and on track for a normal session.`;
    }

    return { score, status, statusLabel, headline, isSick };
  },
};
