import { supabase } from './supabaseClient';
import { stravaApi } from './stravaApi';
// import { tokenStorageService } from './tokenStorageService';
import type { StravaAthlete, StravaActivity, DetailedWorkoutMetrics } from '../types';

const CACHE_DURATION_MS = 15 * 60 * 1000;
const DETAILED_METRICS_SCHEMA_VERSION = 2;

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

    // Filter activities that are Rides or Runs (including variants like VirtualRide, EBikeRide,
    // GravelRide, TrailRun, VirtualRun), do not have detailed_metrics, and haven't been attempted yet
    const eligible = activities.filter(a => {
      const isEligibleType = isEnrichableActivityType(a.type);
      // Re-enrich activities with no metrics yet, or with an outdated schema (e.g. pre-segment-grade/power-curve data)
      const isUpToDate = !!a.detailed_metrics && (a.detailed_metrics.schema_version || 1) >= DETAILED_METRICS_SCHEMA_VERSION;
      const isAttempted = attemptedIds.has(a.id);
      return isEligibleType && !isUpToDate && !isAttempted;
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
      stravaApi.getActivityStreams(activity.id, ['watts', 'heartrate', 'grade_smooth'])
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

    // 1b. Segment Efforts
    let rawSegmentEfforts: any[] = [];
    if (detailedActivity && (detailedActivity as any).segment_efforts) {
      rawSegmentEfforts = (detailedActivity as any).segment_efforts;
      const allSegments = rawSegmentEfforts.map((se: any) => ({
        name: se.name || 'Unknown Segment',
        moving_time: se.moving_time,
        avg_power: se.average_watts,
        avg_hr: se.average_heartrate,
        max_hr: se.max_heartrate,
        distance: se.segment?.distance,
        average_grade: se.segment?.average_grade,
        maximum_grade: se.segment?.maximum_grade,
        elevation_high: se.segment?.elevation_high,
        elevation_low: se.segment?.elevation_low,
        climb_category: se.segment?.climb_category,
        start_index: se.start_index,
        end_index: se.end_index
      }));
      // Filter out segments under 60 seconds, sort by moving_time descending, keep top 8
      detailed_metrics.segment_efforts = allSegments
        .filter((se: any) => se.moving_time >= 60)
        .sort((a: any, b: any) => b.moving_time - a.moving_time)
        .slice(0, 8);
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

    // 3. Streams (Power Curve, Normalized Power, HR Efficiency, Elevation/Grade)
    let wattsData: number[] = [];
    let hrData: number[] = [];
    let gradeData: number[] = [];
    if (streams) {
      if (Array.isArray(streams)) {
        const wattsStream = streams.find((s: any) => s.type === 'watts');
        const hrStream = streams.find((s: any) => s.type === 'heartrate');
        const gradeStream = streams.find((s: any) => s.type === 'grade_smooth');
        if (wattsStream) wattsData = wattsStream.data || [];
        if (hrStream) hrData = hrStream.data || [];
        if (gradeStream) gradeData = gradeStream.data || [];
      } else if (typeof streams === 'object') {
        if (streams.watts) wattsData = streams.watts.data || [];
        if ((streams as any).heartrate) hrData = (streams as any).heartrate.data || [];
        if ((streams as any).grade_smooth) gradeData = (streams as any).grade_smooth.data || [];
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

      // 4. Heart Rate Efficiency and Cardiac Decoupling
      if (hrData.length > 0 && wattsData.length === hrData.length) {
        const bucketStats = calculateHeartRateEfficiencyBins(wattsData, hrData);
        const decoupling = calculateCardiacDecoupling(wattsData, hrData);

        if (decoupling) {
          detailed_metrics.heartrate_efficiency = {
            avg_hr_at_power_buckets: bucketStats,
            cardiac_decoupling: decoupling
          };
        } else if (bucketStats.length > 0) {
          detailed_metrics.heartrate_efficiency = {
            avg_hr_at_power_buckets: bucketStats
          };
        }
      }
    }

    // 5. Per-segment elevation/grade context (sliced from activity-level streams using start/end index)
    if (detailed_metrics.segment_efforts && detailed_metrics.segment_efforts.length > 0) {
      detailed_metrics.segment_efforts = detailed_metrics.segment_efforts.map((se: any) => {
        const { start_index, end_index, ...rest } = se;
        if (typeof start_index === 'number' && typeof end_index === 'number' && wattsData.length > end_index) {
          const segmentWatts = wattsData.slice(start_index, end_index);
          if (segmentWatts.length > 0) {
            const maxPower = Math.max(...segmentWatts);
            if (Number.isFinite(maxPower) && (rest.max_power === undefined || maxPower > 0)) {
              rest.max_power = Math.round(maxPower);
            }
          }
        }
        return rest;
      });
    }

    // 6. Whole-ride power-vs-elevation correlation
    if (wattsData.length > 0 && gradeData.length === wattsData.length) {
      const profile = calculateElevationPowerProfile(wattsData, gradeData, hrData);
      if (profile.length > 0) {
        detailed_metrics.elevation_power_profile = profile;
      }
    }

    detailed_metrics.schema_version = DETAILED_METRICS_SCHEMA_VERSION;

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

/**
 * Matches Strava's ride/run type family (Ride, VirtualRide, EBikeRide, GravelRide,
 * MountainBikeRide, Run, TrailRun, VirtualRun, etc.), not just the exact 'Ride'/'Run' strings.
 * VirtualRide in particular is the only activity type for many indoor-trainer users where
 * Strava provides a real per-second watts stream (device_watts: true), so excluding it
 * silently drops the one source of enrichable power data for those users.
 */
export function isEnrichableActivityType(type: string | undefined): boolean {
  const t = (type || '').toLowerCase();
  return t.includes('ride') || t.includes('run');
}

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
    '15s': 15,
    '30s': 30,
    '1m': 60,
    '2m': 120,
    '5m': 300,
    '10m': 600,
    '20m': 1200,
    '60m': 3600,
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

export function calculateHeartRateEfficiencyBins(
  wattsData: number[],
  hrData: number[]
): { bucket: string; avg_hr: number; seconds: number; efficiency_factor: number }[] {
  if (wattsData.length === 0 || hrData.length === 0 || wattsData.length !== hrData.length) {
    return [];
  }

  const buckets = [
    { name: '100-130W', min: 100, max: 130 },
    { name: '130-160W', min: 130, max: 160 },
    { name: '160-190W', min: 160, max: 190 },
    { name: '190-220W', min: 190, max: 220 },
    { name: '220W+', min: 220, max: 9999 }
  ];

  return buckets.map(b => {
    let sumPwr = 0;
    let sumHr = 0;
    let count = 0;

    for (let i = 0; i < wattsData.length; i++) {
      const w = wattsData[i];
      const hr = hrData[i];
      if (w >= b.min && w < b.max && hr > 0) {
        sumPwr += w;
        sumHr += hr;
        count++;
      }
    }

    if (count >= 30) {
      const avgPwr = sumPwr / count;
      const avgHr = sumHr / count;
      return {
        bucket: b.name,
        avg_hr: Math.round(avgHr),
        seconds: count,
        efficiency_factor: parseFloat((avgPwr / avgHr).toFixed(2))
      };
    }
    return null;
  }).filter((b): b is NonNullable<typeof b> => b !== null);
}

export function calculateElevationPowerProfile(
  wattsData: number[],
  gradeData: number[],
  hrData: number[] = []
): { grade_bucket: string; avg_power: number; avg_hr?: number; seconds: number }[] {
  if (wattsData.length === 0 || gradeData.length === 0 || wattsData.length !== gradeData.length) {
    return [];
  }

  const hasHr = hrData.length === wattsData.length;

  const buckets = [
    { name: 'Downhill', min: -Infinity, max: 0 },
    { name: 'Flat (0-2%)', min: 0, max: 2 },
    { name: 'Rolling (2-5%)', min: 2, max: 5 },
    { name: 'Climbing (5-8%)', min: 5, max: 8 },
    { name: 'Steep (8%+)', min: 8, max: Infinity },
  ];

  return buckets.map(b => {
    let sumPwr = 0;
    let sumHr = 0;
    let hrCount = 0;
    let count = 0;

    for (let i = 0; i < wattsData.length; i++) {
      const grade = gradeData[i];
      const watts = wattsData[i];
      if (grade >= b.min && grade < b.max) {
        sumPwr += watts;
        count++;
        if (hasHr && hrData[i] > 0) {
          sumHr += hrData[i];
          hrCount++;
        }
      }
    }

    if (count < 30) return null;

    const result: { grade_bucket: string; avg_power: number; avg_hr?: number; seconds: number } = {
      grade_bucket: b.name,
      avg_power: Math.round(sumPwr / count),
      seconds: count
    };
    if (hrCount >= 30) {
      result.avg_hr = Math.round(sumHr / hrCount);
    }
    return result;
  }).filter((b): b is NonNullable<typeof b> => b !== null);
}

export function calculateCardiacDecoupling(
  wattsData: number[],
  hrData: number[]
): {
  first_half_avg_hr: number;
  second_half_avg_hr: number;
  first_half_avg_power: number;
  second_half_avg_power: number;
  drift_percentage: number;
} | null {
  if (wattsData.length < 600 || hrData.length === 0 || wattsData.length !== hrData.length) {
    return null;
  }

  const mid = Math.floor(wattsData.length / 2);

  const firstHalfPwr = wattsData.slice(0, mid);
  const firstHalfHr = hrData.slice(0, mid).filter(h => h > 0);
  const secondHalfPwr = wattsData.slice(mid);
  const secondHalfHr = hrData.slice(mid).filter(h => h > 0);

  const avgP1 = firstHalfPwr.length > 0 ? firstHalfPwr.reduce((a, b) => a + b, 0) / firstHalfPwr.length : 0;
  const avgH1 = firstHalfHr.length > 0 ? firstHalfHr.reduce((a, b) => a + b, 0) / firstHalfHr.length : 0;

  const avgP2 = secondHalfPwr.length > 0 ? secondHalfPwr.reduce((a, b) => a + b, 0) / secondHalfPwr.length : 0;
  const avgH2 = secondHalfHr.length > 0 ? secondHalfHr.reduce((a, b) => a + b, 0) / secondHalfHr.length : 0;

  if (avgH1 > 0 && avgH2 > 0) {
    const ef1 = avgP1 / avgH1;
    const ef2 = avgP2 / avgH2;
    const drift = ef1 > 0 ? parseFloat((((ef1 - ef2) / ef1) * 100).toFixed(1)) : 0;

    return {
      first_half_avg_hr: Math.round(avgH1),
      second_half_avg_hr: Math.round(avgH2),
      first_half_avg_power: Math.round(avgP1),
      second_half_avg_power: Math.round(avgP2),
      drift_percentage: drift
    };
  }

  return null;
}

