import React, { useState, useMemo, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Filter, Eye, EyeOff, LineChart as LineChartIcon, RefreshCw } from 'lucide-react';
import { Button } from '../common/Button';
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



  const metricConfigs = [
    { id: 'distance', label: 'Distance', color: '#3b82f6', unit: 'miles', key: 'allDistance' },
    { id: 'load', label: 'Training Load', color: '#10b981', unit: 'load', key: 'allTrainingLoad' },
    { id: 'speed', label: 'Avg Speed', color: '#f59e0b', unit: 'mph', key: 'allAvgSpeed' },
    { id: 'heartRate', label: 'Avg Heart Rate', color: '#ef4444', unit: 'bpm', key: 'allAvgHeartRate' },
    { id: 'performance', label: 'Overall Performance', color: '#8b5cf6', unit: 'score', key: 'overallPerformance' },
    { id: 'recovery', label: 'Recovery Calculated', color: '#ec4899', unit: 'score', key: 'recoveryCalculated' },
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
        <div className="bg-slate-800 p-3 border border-slate-700 rounded-lg shadow-lg">
          <p className="font-medium text-slate-50 mb-2">{`Week of ${label}`}</p>
          {payload.map((entry, index) => {
            const metric = metricConfigs.find(m => entry.dataKey === m.key);
            const unit = metric?.unit || '';
            return (
              <p key={index} style={{ color: entry.color }} className="text-sm">
                {`${entry.name}: ${entry.value} ${unit}`}
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
            Training Trends (Last 4 Weeks)
          </h3>
          <p className="text-slate-400 text-sm">
            Analyze your training patterns by activity type and metric
          </p>
        </div>

        <div className="h-80 flex flex-col items-center justify-center text-center">
          <LineChartIcon className="h-12 w-12 text-slate-600 mb-4" />
          <h4 className="text-lg font-semibold text-slate-50 mb-2">
            No training data yet
          </h4>
          <p className="text-slate-400 mb-6 max-w-md">
            Connect Strava or log your first ride to see your fitness progression.
          </p>
          <Button
            variant="primary"
            size="md"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Data
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 rounded-lg shadow-lg shadow-black/20 border border-slate-800 p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-slate-50 mb-2">
          Training Trends (Last 4 Weeks)
        </h3>
        <p className="text-slate-400 text-sm">
          Analyze your training patterns by activity type and metric
        </p>
      </div>

      {/* Controls */}
      <div className="mb-6 space-y-4">
        {/* Metric Selection */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center">
            <Filter className="w-4 h-4 mr-1" />
            Metrics to Display (select multiple)
          </label>
          <div className="flex flex-wrap gap-2">
            {metricConfigs.map((metric) => (
              <button
                key={metric.id}
                onClick={() => toggleMetric(metric.id)}
                className={`flex items-center space-x-2 px-3 py-1.5 text-sm rounded-md transition-colors ${selectedMetrics.has(metric.id)
                  ? 'text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                style={selectedMetrics.has(metric.id) ? { backgroundColor: metric.color } : {}}
              >
                {selectedMetrics.has(metric.id) ? (
                  <Eye className="w-3 h-3" />
                ) : (
                  <EyeOff className="w-3 h-3" />
                )}
                <span>{metric.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-80 mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={weeklyTrends} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="week"
              stroke="#94a3b8"
              fontSize={12}
            />
            <YAxis
              stroke="#94a3b8"
              fontSize={12}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ color: '#94a3b8' }} />

            {metricConfigs
              .filter(metric => selectedMetrics.has(metric.id))
              .map((metric) => (
                <Line
                  key={metric.id}
                  type="monotone"
                  dataKey={metric.key}
                  stroke={metric.color}
                  strokeWidth={2}
                  dot={{ fill: metric.color, strokeWidth: 2, r: 4 }}
                  name={metric.label}
                  connectNulls={false}
                />
              ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Metric Explanations */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-center">
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
          <div className="flex items-center justify-center mb-1">
            <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
            <span className="text-sm font-medium text-slate-300">Distance</span>
          </div>
          <p className="text-xs text-slate-400">Weekly mileage volume</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
          <div className="flex items-center justify-center mb-1">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
            <span className="text-sm font-medium text-slate-300">Training Load</span>
          </div>
          <p className="text-xs text-slate-400">Intensity × time factor</p>
        </div>
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
          <div className="flex items-center justify-center mb-1">
            <div className="w-3 h-3 bg-orange-500 rounded-full mr-2"></div>
            <span className="text-sm font-medium text-slate-300">Avg Speed</span>
          </div>
          <p className="text-xs text-slate-400">Overall pace trends</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
          <div className="flex items-center justify-center mb-1">
            <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
            <span className="text-sm font-medium text-slate-300">Avg Heart Rate</span>
          </div>
          <p className="text-xs text-slate-400">Cardiovascular intensity</p>
        </div>
        <div className="bg-violet-500/10 border border-violet-500/20 rounded-lg p-3">
          <div className="flex items-center justify-center mb-1">
            <div className="w-3 h-3 bg-violet-500 rounded-full mr-2"></div>
            <span className="text-sm font-medium text-slate-300">Overall Performance</span>
          </div>
          <p className="text-xs text-slate-400">Holistic training score</p>
        </div>
        <div className="bg-pink-500/10 border border-pink-500/20 rounded-lg p-3">
          <div className="flex items-center justify-center mb-1">
            <div className="w-3 h-3 bg-pink-500 rounded-full mr-2"></div>
            <span className="text-sm font-medium text-slate-300">Recovery</span>
          </div>
          <p className="text-xs text-slate-400">Calculated recovery status</p>
        </div>
      </div>

      <p className="text-xs text-slate-600 text-center mt-4">Powered by Strava</p>
    </div>
  );
};