import React, { useState, useMemo, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { StravaActivity, StravaAthlete, DailyMetric, OuraReadinessData } from '../../types';
import { startOfWeek, format, addWeeks, subDays, isSameWeek } from 'date-fns';
import { trainingMetricsService } from '../../services/trainingMetricsService';
import { dailyMetricsService } from '../../services/dailyMetricsService';
import type { HealthMetrics } from '../../services/weeklyInsightService';

interface TrainingTrendsChartProps {
  activities: StravaActivity[];
  athlete?: StravaAthlete | null;
  healthMetrics?: HealthMetrics | null;
  todayReadiness?: OuraReadinessData | null;
}

interface WeeklyTrend {
  week: string;
  allActivities: number;
  allDistance: number;
  allTrainingLoad: number;
  allAvgSpeed: number;
  allAvgHeartRate: number;
  runs: number;
  runDistance: number;
  runTrainingLoad: number;
  runAvgSpeed: number;
  runAvgHeartRate: number;
  outdoorRides: number;
  outdoorRideDistance: number;
  outdoorRideTrainingLoad: number;
  outdoorRideAvgSpeed: number;
  outdoorRideAvgHeartRate: number;
  virtualRides: number;
  virtualRideDistance: number;
  virtualRideTrainingLoad: number;
  virtualRideAvgSpeed: number;
  virtualRideAvgHeartRate: number;
  overallPerformance: number;
  recoveryCalculated: number;
}



export const TrainingTrendsChart: React.FC<TrainingTrendsChartProps> = ({ activities, todayReadiness }) => {
  const [weeklyMetrics, setWeeklyMetrics] = useState<Map<string, DailyMetric[]>>(new Map());
  const [selectedMetrics, setSelectedMetrics] = useState<Set<string>>(new Set(['performance', 'recovery']));

  useEffect(() => {
    const fetchWeeklyMetrics = async () => {
      try {
        const metrics = await dailyMetricsService.getMetricsForDateRange(
          new Date(Date.now() - 4 * 7 * 24 * 60 * 60 * 1000),
          new Date()
        );

        const metricsByWeek = new Map<string, DailyMetric[]>();
        metrics.forEach(metric => {
          const weekStart = format(startOfWeek(new Date(metric.date), { weekStartsOn: 1 }), 'MMM d');
          if (!metricsByWeek.has(weekStart)) {
            metricsByWeek.set(weekStart, []);
          }
          metricsByWeek.get(weekStart)!.push(metric);
        });

        setWeeklyMetrics(metricsByWeek);
      } catch (error) {
        console.error('Failed to fetch weekly metrics:', error);
      }
    };

    fetchWeeklyMetrics();
  }, []);

  // Calculate weekly trends with activity type breakdown
  const weeklyTrends = useMemo((): WeeklyTrend[] => {
    const now = new Date();
    const weeks: WeeklyTrend[] = [];

    for (let i = 3; i >= 0; i--) {
      const weekStart = startOfWeek(addWeeks(now, -i), { weekStartsOn: 1 });
      const weekEnd = addWeeks(weekStart, 1);

      const weekActivities = activities.filter(activity => {
        // Strip Z to force local time parsing
        const dateStr = activity.start_date_local.endsWith('Z')
          ? activity.start_date_local.slice(0, -1)
          : activity.start_date_local;
        const activityDate = new Date(dateStr);
        return activityDate >= weekStart && activityDate < weekEnd;
      });

      // Categorize activities
      const runs = weekActivities.filter(a => a.type === 'Run');
      const outdoorRides = weekActivities.filter(a =>
        a.type === 'Ride' && !a.name.toLowerCase().includes('zwift') && !a.name.toLowerCase().includes('virtual')
      );
      const virtualRides = weekActivities.filter(a =>
        a.type === 'Ride' && (a.name.toLowerCase().includes('zwift') || a.name.toLowerCase().includes('virtual'))
      );

      // Helper function to calculate metrics for activity group
      const calculateMetrics = (activityGroup: StravaActivity[]) => {
        const totalDistance = activityGroup.reduce((sum, a) => sum + a.distance, 0);
        const totalTime = activityGroup.reduce((sum, a) => sum + a.moving_time, 0);
        const distanceMiles = totalDistance * 0.000621371;

        const trainingLoad = activityGroup.reduce((load, activity) => {
          const timeHours = activity.moving_time / 3600;
          const intensityFactor = activity.average_speed > 0 ?
            Math.min(activity.average_speed / 3, 2) : 1;
          return load + (timeHours * intensityFactor);
        }, 0);

        const totalTimeHours = totalTime / 3600;
        const avgSpeed = totalTimeHours > 0 ? distanceMiles / totalTimeHours : 0;

        // Calculate average heart rate for activities that have HR data
        const activitiesWithHR = activityGroup.filter(a => a.average_heartrate && a.average_heartrate > 0);
        const avgHeartRate = activitiesWithHR.length > 0
          ? activitiesWithHR.reduce((sum, a) => sum + (a.average_heartrate || 0), 0) / activitiesWithHR.length
          : 0;
        return {
          distance: Math.round(distanceMiles * 10) / 10,
          trainingLoad: Math.round(trainingLoad * 10) / 10,
          avgSpeed: Math.round(avgSpeed * 10) / 10,
          avgHeartRate: Math.round(avgHeartRate)
        };
      };

      const allMetrics = calculateMetrics(weekActivities);
      const runMetrics = calculateMetrics(runs);
      const outdoorRideMetrics = calculateMetrics(outdoorRides);
      const virtualRideMetrics = calculateMetrics(virtualRides);

      const weekLabel = format(weekStart, 'MMM d');

      let overallPerformance = 0;
      const activitiesUpToThisWeek = activities.filter(activity => {
        // Strip Z to force local time parsing
        const dateStr = activity.start_date_local.endsWith('Z')
          ? activity.start_date_local.slice(0, -1)
          : activity.start_date_local;
        const activityDate = new Date(dateStr);
        return activityDate < weekEnd;
      });

      const recentActivitiesForThisWeek = activitiesUpToThisWeek.filter(activity => {
        // Strip Z to force local time parsing
        const dateStr = activity.start_date_local.endsWith('Z')
          ? activity.start_date_local.slice(0, -1)
          : activity.start_date_local;
        const activityDate = new Date(dateStr);
        return activityDate >= subDays(weekEnd, 30);
      });

      if (recentActivitiesForThisWeek.length > 0) {
        const stravaMetrics = trainingMetricsService.calculateStravaMetrics(recentActivitiesForThisWeek);
        overallPerformance = stravaMetrics.overallScore;
      }

      // Calculate Recovery
      const weekMetricsData = weeklyMetrics.get(weekLabel) || [];

      // Inject today's readiness if valid and this is the current week
      const metricsForCalculation = [...weekMetricsData];
      if (todayReadiness && isSameWeek(weekStart, now, { weekStartsOn: 1 })) {
        const todayStr = format(now, 'yyyy-MM-dd');
        const exists = metricsForCalculation.some(m => m.date === todayStr);

        if (!exists && todayReadiness.day === todayStr) {
          metricsForCalculation.push({
            id: 'virtual-today',
            user_id: 'current',
            date: todayStr,
            recovery_score: todayReadiness.score,
            sleep_minutes: 0,
            resting_hr: 0,
            hrv: 0
          });
        }
      }

      const avgRecovery = metricsForCalculation.length > 0
        ? Math.round(metricsForCalculation.reduce((sum, m) => {
          // Use existing score if available, otherwise calculate fallback
          // This aligns with the Recovery Tab logic which prioritizes the synced score
          const score = m.recovery_score || dailyMetricsService.calculateRecoveryScore(m, {});
          return sum + score;
        }, 0) / metricsForCalculation.length)
        : 0;

      weeks.push({
        week: weekLabel,
        allActivities: weekActivities.length,
        allDistance: allMetrics.distance,
        allTrainingLoad: allMetrics.trainingLoad,
        allAvgSpeed: allMetrics.avgSpeed,
        allAvgHeartRate: allMetrics.avgHeartRate,
        runs: runs.length,
        runDistance: runMetrics.distance,
        runTrainingLoad: runMetrics.trainingLoad,
        runAvgSpeed: runMetrics.avgSpeed,
        runAvgHeartRate: runMetrics.avgHeartRate,
        outdoorRides: outdoorRides.length,
        outdoorRideDistance: outdoorRideMetrics.distance,
        outdoorRideTrainingLoad: outdoorRideMetrics.trainingLoad,
        outdoorRideAvgSpeed: outdoorRideMetrics.avgSpeed,
        outdoorRideAvgHeartRate: outdoorRideMetrics.avgHeartRate,
        virtualRides: virtualRides.length,
        virtualRideDistance: virtualRideMetrics.distance,
        virtualRideTrainingLoad: virtualRideMetrics.trainingLoad,
        virtualRideAvgSpeed: virtualRideMetrics.avgSpeed,
        virtualRideAvgHeartRate: virtualRideMetrics.avgHeartRate,
        overallPerformance,
        recoveryCalculated: avgRecovery,
      });
    }

    return weeks;
  }, [activities, weeklyMetrics, todayReadiness]);



  const toggleMetric = (metricId: string) => {
    setSelectedMetrics(prev => {
      const newSet = new Set(prev);
      if (newSet.has(metricId)) {
        newSet.delete(metricId);
      } else {
        newSet.add(metricId);
      }
      return newSet;
    });
  };

  // Calculate previous 4-week totals for trend comparison
  const previousTotals = useMemo(() => {
     const now = new Date();
     // Calculate the 4-week block BEFORE the current 4-week block
     // Current block: i=3..0 (approx 4 weeks ago to now)
     // Previous block: i=7..4 (approx 8 weeks ago to 4 weeks ago)
     
     let prevDistance = 0;
     let prevLoad = 0;

     // Calculate start/end for the entire previous 4-week block
     const prevBlockStart = startOfWeek(addWeeks(now, -7), { weekStartsOn: 1 });
     const prevBlockEnd = startOfWeek(addWeeks(now, -3), { weekStartsOn: 1 }); // Exclusive

     const previousActivities = activities.filter(activity => {
         // Strip Z to force local time parsing
         const dateStr = activity.start_date_local.endsWith('Z') 
            ? activity.start_date_local.slice(0, -1) 
            : activity.start_date_local;
         const activityDate = new Date(dateStr);
         return activityDate >= prevBlockStart && activityDate < prevBlockEnd;
     });

     previousActivities.forEach(activity => {
         prevDistance += activity.distance * 0.000621371; // Convert to miles
         
         const timeHours = activity.moving_time / 3600;
         const intensityFactor = activity.average_speed > 0 ? 
            Math.min(activity.average_speed / 3, 2) : 1;
         prevLoad += (timeHours * intensityFactor);
     });

     return {
         distance: Math.round(prevDistance * 10) / 10,
         load: Math.round(prevLoad * 10) / 10
     };
  }, [activities]);

  // Helper to calculate trend for a metric
  const getMetricStats = (key: string, aggregation: 'sum' | 'latest' | 'average' = 'latest') => {
      if (weeklyTrends.length === 0) return { value: 0, trend: 0, trendValue: 0 };
      
      let value = 0;
      let trendPercent = 0;
      let trendValue = 0;

      if (aggregation === 'sum') {
          // Sum over all displayed weeks (up to 4)
          value = weeklyTrends.reduce((sum, week) => sum + (week[key as keyof WeeklyTrend] as number || 0), 0);
          
          // Compare against PREVIOUS 4-week block totals
          let prevVal = 0;
          if (key === 'allDistance') prevVal = previousTotals.distance;
          if (key === 'allTrainingLoad') prevVal = previousTotals.load;

          if (prevVal > 0) {
              trendPercent = Math.round(((value - prevVal) / prevVal) * 100);
          } else if (value > 0) {
              trendPercent = 100; // New activity
          }
          trendValue = value - prevVal;

      } else {
          // Latest behavior (compare last week to previous week)
          if (weeklyTrends.length < 2) {
             const current = weeklyTrends[weeklyTrends.length - 1];
             value = current[key as keyof WeeklyTrend] as number || 0;
          } else {
             const current = weeklyTrends[weeklyTrends.length - 1];
             const previous = weeklyTrends[weeklyTrends.length - 2];
             
             value = current[key as keyof WeeklyTrend] as number || 0;
             const prevVal = previous[key as keyof WeeklyTrend] as number || 0;

             if (prevVal > 0) {
                 trendPercent = Math.round(((value - prevVal) / prevVal) * 100);
             } else if (value > 0) {
                 trendPercent = 100; // New activity
             }
             trendValue = value - prevVal;
          }
      }

      // Rounding for display
      if (key === 'allDistance' || key === 'allTrainingLoad') {
          value = Math.round(value * 10) / 10;
      } else {
          value = Math.round(value);
      }

      return {
          value,
          trend: trendPercent,
          trendValue
      };
  };

  const metricConfigs = [
    { id: 'distance', label: 'Distance', color: '#3b82f6', unit: 'mi', key: 'allDistance', description: 'Total mileage over the last 4 weeks.', aggregation: 'sum' as const },
    { id: 'load', label: 'Load', color: '#22c55e', unit: '', key: 'allTrainingLoad', description: 'Cumulative stress score over the last 4 weeks.', aggregation: 'sum' as const },
    { id: 'performance', label: 'Fitness', color: '#8b5cf6', unit: '', key: 'overallPerformance', description: 'Weighted score of your physical capacity.', aggregation: 'latest' as const },
    { id: 'recovery', label: 'Recovery', color: '#ec4899', unit: '%', key: 'recoveryCalculated', description: 'Holistic recharge score from sleep & resting HR.', aggregation: 'latest' as const },
  ];

  interface CustomTooltipProps {
    active?: boolean;
    payload?: Array<{
      value: number | string;
      name: string;
      dataKey: string;
      color: string;
    }>;
    label?: string;
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800 p-3 border border-slate-700 rounded-lg shadow-lg z-50">
          <p className="font-medium text-slate-50 mb-2">{`Week of ${label}`}</p>
          {payload.map((entry, index) => {
             // Find config to get unit
             const config = metricConfigs.find(c => c.key === entry.dataKey);
             return (
              <p key={index} style={{ color: entry.color }} className="text-sm">
                {`${entry.name}: ${entry.value} ${config?.unit || ''}`}
              </p>
            );
          })}
        </div>
      );
    }
    return null;
  };

  if (!activities || activities.length === 0) {
    return (
      <div className="bg-slate-900 rounded-lg shadow-sm border border-slate-800 p-6">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-slate-50 mb-2">
            Training Trends
          </h3>
          <p className="text-slate-400 text-sm">
            Log activities to see your progression.
          </p>
        </div>
        <div className="h-60 flex flex-col items-center justify-center text-center text-slate-500">
           No data available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 rounded-lg shadow-lg shadow-black/20 border border-slate-800 p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-slate-50 mb-1">
          Training Trends
        </h3>
        <p className="text-slate-400 text-xs">
          Last 4 Weeks Performance
        </p>
      </div>

      {/* Interactive Stat Rows (Metric Toggle Cards) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {metricConfigs.map((metric) => {
           const stats = getMetricStats(metric.key, metric.aggregation);
           const isActive = selectedMetrics.has(metric.id);
           
           return (
              <button
                key={metric.id}
                type="button"
                onClick={(e) => {
                    e.preventDefault();
                    toggleMetric(metric.id);
                }}
                className={`relative group p-3 rounded-xl transition-all duration-200 text-left border cursor-pointer z-10 ${
                    isActive 
                     ? 'bg-slate-800 border-l-4' 
                     : 'bg-slate-900/50 border-slate-800 opacity-60 hover:opacity-100 hover:bg-slate-800'
                }`}
                style={{ 
                    borderLeftColor: isActive ? metric.color : undefined,
                    borderColor: isActive ? undefined : '#1e293b' // slate-800
                }}
              >
                  {/* Hover Description Tooltip */}
                  <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity bottom-full left-0 mb-2 w-48 bg-slate-950 text-slate-300 text-xs p-2 rounded border border-slate-700 pointer-events-none z-50 shadow-xl">
                      {metric.description}
                  </div>

                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">
                      {metric.label}
                  </p>
                  <div className="flex items-baseline gap-2">
                      <span className={`text-xl font-bold ${isActive ? 'text-white' : 'text-slate-300'}`}>
                          {stats.value}
                          <span className="text-sm font-normal text-slate-500 ml-1">{metric.unit}</span>
                      </span>
                      {stats.trend !== 0 && (
                          <span className={`text-xs font-medium flex items-center ${
                              stats.trend > 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}>
                              {stats.trend > 0 ? '↑' : '↓'} {Math.abs(stats.trend)}%
                          </span>
                      )}
                  </div>
              </button>
           );
        })}
      </div>

      {/* Chart */}
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={weeklyTrends} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis
              dataKey="week"
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              dy={10}
            />
            <YAxis
              hide // Hide Y-axis as per "clean" request and multiple scales
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: "4 4" }} />
            
            {metricConfigs
              .filter(metric => selectedMetrics.has(metric.id))
              .map((metric) => (
                <Line
                  key={metric.id}
                  type="monotone"
                  dataKey={metric.key}
                  stroke={metric.color}
                  strokeWidth={3}
                  dot={{ fill: '#1e293b', stroke: metric.color, strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                  connectNulls={true}
                  isAnimationActive={true}
                />
              ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      <div className="mt-2 text-center">
         <p className="text-[10px] text-slate-600">
             Tap cards above to toggle metrics. Data sourced from Strava & Oura.
         </p>
      </div>
    </div>
  );
};