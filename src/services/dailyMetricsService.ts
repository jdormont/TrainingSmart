import { supabase } from './supabaseClient';
import type { DailyMetric } from '../types';

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

  calculateIndividualScores(metric: DailyMetric) {
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
      scores.hrvScore = Math.round(Math.min(100, (metric.hrv / 80) * 100));
    }

    if (metric.resting_hr > 0) {
      scores.rhrScore = Math.round(Math.max(0, 100 - ((metric.resting_hr - 40) * 2)));
    }

    return scores;
  }
};
