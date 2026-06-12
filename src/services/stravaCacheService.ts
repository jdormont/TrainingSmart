import { supabase } from './supabaseClient';
import { stravaApi } from './stravaApi';
// import { tokenStorageService } from './tokenStorageService';
import type { StravaAthlete, StravaActivity, DetailedWorkoutMetrics } from '../types';

const CACHE_DURATION_MS = 15 * 60 * 1000;

class StravaCacheService {
  private async getCurrentUserId(): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    return user.id;
  }

  async getAthlete(forceRefresh = false): Promise<StravaAthlete> {
    const userId = await this.getCurrentUserId();

    if (!forceRefresh) {
      const cached = await this.getCachedAthlete(userId);
      if (cached) {
        console.log('Using cached athlete data');
        return cached;
      }
    }

    console.log('Fetching fresh athlete data from Strava API');
    const athleteData = await stravaApi.getAthlete();
    await this.cacheAthlete(userId, athleteData);
    return athleteData;
  }

  async getActivities(forceRefresh = false, limit = 20): Promise<StravaActivity[]> {
    const userId = await this.getCurrentUserId();

    if (!forceRefresh) {
      const cached = await this.getCachedActivities(userId, limit);
      if (cached && cached.length > 0) {
        const oldestCache = new Date(Math.min(...cached.map(a =>
          new Date((a as any).last_fetched || 0).getTime()
        )));
        const isFresh = Date.now() - oldestCache.getTime() < CACHE_DURATION_MS;

        if (isFresh) {
          console.log(`Using cached activities data (${cached.length} activities)`);
          return cached;
        }
      }
    }

    console.log('Fetching fresh activities from Strava API');
    const activities = await stravaApi.getActivities(1, limit);
    await this.cacheActivities(userId, activities);
    return activities;
  }

  private async getCachedAthlete(userId: string): Promise<StravaAthlete | null> {
    const { data, error } = await supabase
      .from('strava_athlete_cache')
      .select('athlete_data, last_fetched')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching cached athlete:', error);
      return null;
    }

    if (!data) {
      return null;
    }

    const lastFetched = new Date(data.last_fetched);
    const isFresh = Date.now() - lastFetched.getTime() < CACHE_DURATION_MS;

    if (!isFresh) {
      console.log('Cached athlete data is stale');
      return null;
    }

    return data.athlete_data as StravaAthlete;
  }

  private async cacheAthlete(userId: string, athleteData: StravaAthlete): Promise<void> {
    const { error } = await supabase
      .from('strava_athlete_cache')
      .upsert({
        user_id: userId,
        athlete_data: athleteData,
        last_fetched: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (error) {
      console.error('Error caching athlete data:', error);
    } else {
      console.log('Athlete data cached successfully');
    }
  }

  private async getCachedActivities(userId: string, limit: number): Promise<StravaActivity[]> {
    const { data, error } = await supabase
      .from('strava_activities_cache')
      .select('activity_data, last_fetched')
      .eq('user_id', userId)
      .order('start_date', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching cached activities:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    return data.map(row => row.activity_data as StravaActivity);
  }

  private async cacheActivities(userId: string, activities: StravaActivity[]): Promise<void> {
    const ids = activities.map(a => a.id);
    const existingMap = new Map<number, StravaActivity>();
    
    try {
      const { data: existing } = await supabase
        .from('strava_activities_cache')
        .select('id, activity_data')
        .eq('user_id', userId)
        .in('id', ids);

      if (existing) {
        existing.forEach((row: any) => {
          existingMap.set(Number(row.id), row.activity_data as StravaActivity);
        });
      }
    } catch (err) {
      console.warn('Could not fetch existing activities for cache merge:', err);
    }

    const rows = activities.map(activity => {
      const existingActivity = existingMap.get(activity.id);
      const detailed_metrics = existingActivity?.detailed_metrics;
      
      const activityData = {
        ...activity,
        ...(detailed_metrics ? { detailed_metrics } : {})
      };

      return {
        id: activity.id,
        user_id: userId,
        activity_data: activityData,
        start_date: activity.start_date_local,
        activity_type: activity.type,
        distance: activity.distance,
        moving_time: activity.moving_time,
        last_fetched: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    });

    const { error } = await supabase
      .from('strava_activities_cache')
      .upsert(rows, {
        onConflict: 'user_id,id'
      });

    if (error) {
      console.error('Error caching activities:', error);
    } else {
      console.log(`${activities.length} activities cached successfully`);
    }
  }

  async enrichRecentActivities(activities: StravaActivity[], limit = 3): Promise<boolean> {
    const userId = await this.getCurrentUserId();
    const attemptedKey = `strava-enrich-attempts-${userId}`;
    const attemptedStr = sessionStorage.getItem(attemptedKey) || '[]';
    const attemptedIds = new Set<number>(JSON.parse(attemptedStr));

    // Filter activities that are Rides or Runs, do not have detailed_metrics, and haven't been attempted yet
    const eligible = activities.filter(a => {
      const type = (a.type || '').toLowerCase();
      const isEligibleType = type === 'ride' || type === 'run';
      const isDetailed = !!a.detailed_metrics;
      const isAttempted = attemptedIds.has(a.id);
      return isEligibleType && !isDetailed && !isAttempted;
    });

    if (eligible.length === 0) return false;

    // Limit to prevent hitting rate limits
    const toEnrich = eligible.slice(0, limit);
    console.log(`Enriching ${toEnrich.length} recent activities in the background...`);

    // Add them to the attempted set immediately to prevent concurrent duplicate attempts
    toEnrich.forEach(a => attemptedIds.add(a.id));
    sessionStorage.setItem(attemptedKey, JSON.stringify(Array.from(attemptedIds)));

    let didEnrichAny = false;
    for (const activity of toEnrich) {
      try {
        await this.enrichSingleActivity(activity);
        didEnrichAny = true;
      } catch (err) {
        console.error(`Failed to enrich activity ${activity.id}:`, err);
      }
    }

    return didEnrichAny;
  }

  private async enrichSingleActivity(activity: StravaActivity): Promise<void> {
    const userId = await this.getCurrentUserId();

    console.log(`Enriching activity ${activity.id} ("${activity.name}")`);

    // Fetch details, zones, and streams
    const [detailResult, zonesResult, streamsResult] = await Promise.allSettled([
      stravaApi.getActivity(activity.id),
      stravaApi.getActivityZones(activity.id),
      stravaApi.getActivityStreams(activity.id, ['watts', 'heartrate'])
    ]);

    const detailedActivity = detailResult.status === 'fulfilled' ? detailResult.value : null;
    const zones = zonesResult.status === 'fulfilled' ? zonesResult.value : [];
    const streams = streamsResult.status === 'fulfilled' ? streamsResult.value : null;

    // Build detailed_metrics
    const detailed_metrics: DetailedWorkoutMetrics = {};

    // 1. Laps
    if (detailedActivity && (detailedActivity as any).laps) {
      detailed_metrics.laps = (detailedActivity as any).laps.map((l: any) => ({
        lap_index: l.lap_index,
        distance: l.distance,
        moving_time: l.moving_time,
        avg_power: l.average_watts,
        avg_hr: l.average_heartrate,
        elevation_gain: l.total_elevation_gain
      }));
    }

    // 2. Time in zones
    if (zones && zones.length > 0) {
      detailed_metrics.time_in_zones = {};
      const powerZone = zones.find((z: any) => z.type === 'power');
      if (powerZone && powerZone.distribution_buckets) {
        const totalPwrTime = powerZone.distribution_buckets.reduce((acc: number, b: any) => acc + (b.time || 0), 0);
        detailed_metrics.time_in_zones.power = powerZone.distribution_buckets.map((b: any, idx: number) => ({
          zone: idx + 1,
          min: b.min,
          max: b.max,
          seconds: b.time || 0,
          percentage: totalPwrTime > 0 ? parseFloat(((b.time || 0) / totalPwrTime * 100).toFixed(1)) : 0
        }));
      }

      const hrZone = zones.find((z: any) => z.type === 'heartrate');
      if (hrZone && hrZone.distribution_buckets) {
        const totalHrTime = hrZone.distribution_buckets.reduce((acc: number, b: any) => acc + (b.time || 0), 0);
        detailed_metrics.time_in_zones.heartrate = hrZone.distribution_buckets.map((b: any, idx: number) => ({
          zone: idx + 1,
          min: b.min,
          max: b.max,
          seconds: b.time || 0,
          percentage: totalHrTime > 0 ? parseFloat(((b.time || 0) / totalHrTime * 100).toFixed(1)) : 0
        }));
      }
    }

    // 3. Streams (Power Curve & Normalized Power)
    let wattsData: number[] = [];
    if (streams) {
      if (Array.isArray(streams)) {
        const wattsStream = streams.find((s: any) => s.type === 'watts');
        if (wattsStream) wattsData = wattsStream.data || [];
      } else if (typeof streams === 'object') {
        if (streams.watts) wattsData = streams.watts.data || [];
      }
    }

    if (wattsData.length > 0) {
      const np = calculateNormalizedPower(wattsData);
      if (np > 0) {
        detailed_metrics.normalized_power = np;
        const avgWatts = activity.average_watts || 0;
        if (avgWatts > 0) {
          detailed_metrics.variability_index = parseFloat((np / avgWatts).toFixed(2));
        }
      }
      detailed_metrics.power_curve = calculatePowerCurve(wattsData) as any;
    }

    // Merge into activity_data
    const updatedActivityData = {
      ...activity,
      detailed_metrics
    };

    // Update the database cache
    const { error } = await supabase
      .from('strava_activities_cache')
      .update({
        activity_data: updatedActivityData,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('id', activity.id);

    if (error) {
      console.error(`Error saving enriched activity ${activity.id}:`, error);
    } else {
      console.log(`Activity ${activity.id} enriched and saved successfully`);
    }
  }

  async clearCache(): Promise<void> {
    try {
      const userId = await this.getCurrentUserId();
      await Promise.all([
        supabase.from('strava_athlete_cache').delete().eq('user_id', userId),
        supabase.from('strava_activities_cache').delete().eq('user_id', userId)
      ]);
      console.log('Cache cleared');
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  async getCacheStatus(): Promise<{
    athleteCached: boolean;
    athleteAge?: number;
    activitiesCount: number;
    activitiesAge?: number;
  }> {
    try {
      const userId = await this.getCurrentUserId();

      const [athleteResult, activitiesResult] = await Promise.all([
        supabase
          .from('strava_athlete_cache')
          .select('last_fetched')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('strava_activities_cache')
          .select('last_fetched')
          .eq('user_id', userId)
      ]);

      const athleteCached = !!athleteResult.data;
      const athleteAge = athleteResult.data
        ? Date.now() - new Date(athleteResult.data.last_fetched).getTime()
        : undefined;

      const activitiesCount = activitiesResult.data?.length || 0;
      const activitiesAge = activitiesResult.data && activitiesResult.data.length > 0
        ? Date.now() - new Date(activitiesResult.data[0].last_fetched).getTime()
        : undefined;

      return {
        athleteCached,
        athleteAge,
        activitiesCount,
        activitiesAge
      };
    } catch (error) {
      console.error('Error getting cache status:', error);
      return { athleteCached: false, activitiesCount: 0 };
    }
  }
  async getActivitiesForStats(lookbackDays = 90): Promise<StravaActivity[]> {
    const userId = await this.getCurrentUserId();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - lookbackDays);

    const { data, error } = await supabase
      .from('strava_activities_cache')
      .select(`
        id,
        start_date,
        activity_type,
        distance,
        moving_time,
        activity_data->name,
        activity_data->total_elevation_gain,
        activity_data->average_speed,
        activity_data->average_heartrate,
        activity_data->max_heartrate,
        activity_data->average_watts,
        activity_data->weighted_average_watts,
        activity_data->max_watts,
        activity_data->kilojoules,
        activity_data->kudos_count,
        activity_data->detailed_metrics
      `)
      .eq('user_id', userId)
      .gte('start_date', startDate.toISOString())
      .order('start_date', { ascending: false });

    if (error) {
      console.error('Error fetching activity stats:', error);
      return [];
    }

    // Map to partial StravaActivity objects
    return (data || []).map((row: any) => ({
      id: row.id,
      name: row.name || 'Untitled Activity',
      type: row.activity_type,
      start_date_local: row.start_date,
      distance: row.distance,
      moving_time: row.moving_time,
      total_elevation_gain: row.total_elevation_gain || 0,
      average_speed: row.average_speed || 0,
      average_heartrate: row.average_heartrate,
      max_heartrate: row.max_heartrate,
      average_watts: row.average_watts,
      weighted_average_watts: row.weighted_average_watts,
      max_watts: row.max_watts,
      kilojoules: row.kilojoules,
      kudos_count: row.kudos_count || 0,
      detailed_metrics: row.detailed_metrics || null,
      // Minimal required fields to satisfy type, though they might be missing in 'lite' objects
      map: { id: '', summary_polyline: '', resource_state: 2 }, 
      athlete: { id: parseInt(userId) || 0, resource_state: 1 }
    } as unknown as StravaActivity));
  }
}

export const stravaCacheService = new StravaCacheService();

// === Helper mathematical algorithms for detailed metrics enrichment ===

export function calculateNormalizedPower(watts: number[]): number {
  if (!watts || watts.length < 30) return 0;
  
  const cleanWatts = watts.map(w => typeof w === 'number' && !isNaN(w) ? w : 0);
  const rollingAverages: number[] = [];
  let sum = 0;
  
  for (let i = 0; i < 30; i++) {
    sum += cleanWatts[i];
  }
  rollingAverages.push(sum / 30);
  
  for (let i = 30; i < cleanWatts.length; i++) {
    sum = sum - cleanWatts[i - 30] + cleanWatts[i];
    rollingAverages.push(sum / 30);
  }
  
  const fourthPowerSum = rollingAverages.reduce((acc, val) => acc + Math.pow(val, 4), 0);
  const avgFourthPower = fourthPowerSum / rollingAverages.length;
  
  return Math.round(Math.pow(avgFourthPower, 0.25));
}

export function calculatePowerCurve(watts: number[]): Record<string, number> {
  const durations = {
    '1s': 1,
    '5s': 5,
    '1m': 60,
    '5m': 300,
    '20m': 1200,
  };
  
  const curve: Record<string, number> = {};
  const cleanWatts = watts.map(w => typeof w === 'number' && !isNaN(w) ? w : 0);
  
  for (const [label, seconds] of Object.entries(durations)) {
    if (cleanWatts.length < seconds) {
      curve[label] = 0;
      continue;
    }
    
    let maxSum = 0;
    let currentSum = 0;
    
    for (let i = 0; i < seconds; i++) {
      currentSum += cleanWatts[i];
    }
    maxSum = currentSum;
    
    for (let i = seconds; i < cleanWatts.length; i++) {
      currentSum = currentSum - cleanWatts[i - seconds] + cleanWatts[i];
      if (currentSum > maxSum) {
        maxSum = currentSum;
      }
    }
    
    curve[label] = Math.round(maxSum / seconds);
  }
  
  return curve;
}

