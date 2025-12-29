import { supabase } from './supabaseClient';
import type { DailyMetric } from '../types';
import { healthCalibrationService, type DemographicInfo } from './healthCalibrationService';

export const dailyMetricsService = {
  async getRecentMetrics(days: number = 7): Promise<DailyMetric[]> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('daily_metrics')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', startDateStr)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching daily metrics:', error);
      throw error;
    }

    return data || [];
  },

  async getMetricForDate(date: string): Promise<DailyMetric | null> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('daily_metrics')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', date)
      .maybeSingle();

    if (error) {
      console.error('Error fetching daily metric:', error);
      throw error;
    }

    return data;
  },

  async getMetricsForDateRange(startDate: Date, endDate: Date): Promise<DailyMetric[]> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('daily_metrics')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', startDateStr)
      .lte('date', endDateStr)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching daily metrics for date range:', error);
      throw error;
    }

    return data || [];
  },

  async getMostRecentMetric(): Promise<DailyMetric | null> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('daily_metrics')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching most recent metric:', error);
      throw error;
    }

    return data;
  },

  calculateIndividualScores(metric: DailyMetric, demographic?: DemographicInfo) {
    const scores: {
      sleepScore: number | null;
      hrvScore: number | null;
      rhrScore: number | null;
    } = {
      sleepScore: null,
      hrvScore: null,
      rhrScore: null,
    };

    if (metric.sleep_minutes > 0) {
      scores.sleepScore = Math.round(Math.min(100, (metric.sleep_minutes / 480) * 100));
    }

    if (metric.hrv > 0) {
      scores.hrvScore = healthCalibrationService.calibrateHRVScore(metric.hrv, demographic);
    }

    if (metric.resting_hr > 0) {
      scores.rhrScore = healthCalibrationService.calibrateRestingHRScore(metric.resting_hr, demographic);
    }

    return scores;
  },

  calculateRecoveryScore(metric: DailyMetric, demographic?: DemographicInfo): number {
    return healthCalibrationService.calibrateRecoveryScore(
      metric.sleep_minutes,
      metric.hrv,
      metric.resting_hr,
      demographic
    );
  },

  async getDemographicInfo(): Promise<DemographicInfo | undefined> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return undefined;

      const { data, error } = await supabase
        .from('user_profiles')
        .select('gender, age_bucket')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error || !data) return undefined;

      return {
        gender: data.gender || undefined,
        ageBucket: data.age_bucket || undefined,
      };
    } catch (error) {
      console.error('Error fetching demographic info:', error);
      return undefined;
    }
  }
};
