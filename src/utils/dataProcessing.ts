import type { StravaActivity, WeeklyStats } from '../types';
import { startOfWeek, endOfWeek } from 'date-fns';

export const calculateWeeklyStats = (activities: StravaActivity[]): WeeklyStats => {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  // Filter activities for current week
  const weekActivities = activities.filter(activity => {
    // Strip Z to force local time parsing
    const dateStr = activity.start_date_local.endsWith('Z')
      ? activity.start_date_local.slice(0, -1)
      : activity.start_date_local;
    const activityDate = new Date(dateStr);
    return activityDate >= weekStart && activityDate <= weekEnd;
  });

  // Calculate totals
  const totals = weekActivities.reduce(
    (acc, activity) => ({
      distance: acc.distance + activity.distance,
      time: acc.time + activity.moving_time,
      elevation: acc.elevation + (activity.total_elevation_gain || 0),
    }),
    { distance: 0, time: 0, elevation: 0 }
  );

  return {
    weekStart,
    totalDistance: totals.distance,
    totalTime: totals.time,
    totalElevation: totals.elevation,
    activityCount: weekActivities.length,
    activities: weekActivities,
  };
};

export const calculateTrainingLoad = (activities: StravaActivity[]): number => {
  // Simple training load calculation based on time and intensity
  return activities.reduce((load, activity) => {
    const timeHours = activity.moving_time / 3600;
    const intensityFactor = activity.average_heartrate ?
      Math.min(activity.average_heartrate / 150, 1.5) : 1.0;
    return load + (timeHours * intensityFactor);
  }, 0);
};

export const getActivityTypeBreakdown = (activities: StravaActivity[]) => {
  const breakdown = activities.reduce((acc, activity) => {
    const type = activity.type;
    if (!acc[type]) {
      acc[type] = { count: 0, distance: 0, time: 0 };
    }
    acc[type].count += 1;
    acc[type].distance += activity.distance;
    acc[type].time += activity.moving_time;
    return acc;
  }, {} as Record<string, { count: number; distance: number; time: number }>);

  return Object.entries(breakdown).map(([type, data]) => ({
    type,
    ...data,
  }));
};

export const getRecentPerformanceTrend = (activities: StravaActivity[], activityType?: string) => {
  let filteredActivities = activities;

  if (activityType) {
    filteredActivities = activities.filter(a => a.type === activityType);
  }

  // Sort by date (most recent first)
  const sortedActivities = filteredActivities
    .sort((a, b) => new Date(b.start_date_local).getTime() - new Date(a.start_date_local).getTime())
    .slice(0, 10); // Last 10 activities

  return sortedActivities.map(activity => ({
    date: activity.start_date_local,
    pace: activity.average_speed,
    distance: activity.distance,
    duration: activity.moving_time,
  }));
};