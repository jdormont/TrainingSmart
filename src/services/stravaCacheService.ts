import { supabase } from './supabaseClient';
import { stravaApi } from './stravaApi';
// import { tokenStorageService } from './tokenStorageService';
import type { StravaAthlete, StravaActivity } from '../types';

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
    const rows = activities.map(activity => ({
      id: activity.id,
      user_id: userId,
      activity_data: activity,
      start_date: activity.start_date_local,
      activity_type: activity.type,
      distance: activity.distance,
      moving_time: activity.moving_time,
      last_fetched: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

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
        activity_data->kudos_count
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
      // Minimal required fields to satisfy type, though they might be missing in 'lite' objects
      map: { id: '', summary_polyline: '', resource_state: 2 }, 
      athlete: { id: parseInt(userId) || 0, resource_state: 1 }
    } as unknown as StravaActivity));
  }
}

export const stravaCacheService = new StravaCacheService();

