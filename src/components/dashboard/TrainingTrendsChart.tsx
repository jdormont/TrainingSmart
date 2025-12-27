import React, { useState, useMemo, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Filter, Eye, EyeOff } from 'lucide-react';
import type { StravaActivity, StravaAthlete, DailyMetric } from '../../types';
import { startOfWeek, format, addWeeks } from 'date-fns';
import { healthMetricsService } from '../../services/healthMetricsService';
import { dailyMetricsService } from '../../services/dailyMetricsService';
import type { HealthMetrics } from '../../services/weeklyInsightService';

interface TrainingTrendsChartProps {
  activities: StravaActivity[];
  athlete?: StravaAthlete | null;
  healthMetrics?: HealthMetrics | null;
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

interface ActivityFilter {
  id: string;
  label: string;
  color: string;
  enabled: boolean;
  distanceKey: keyof WeeklyTrend;
  loadKey: keyof WeeklyTrend;
  speedKey: keyof WeeklyTrend;
  heartRateKey: keyof WeeklyTrend;
}

export const TrainingTrendsChart: React.FC<TrainingTrendsChartProps> = ({ activities, athlete, healthMetrics }) => {
  const [weeklyMetrics, setWeeklyMetrics] = useState<Map<string, DailyMetric[]>>(new Map());
  const [selectedMetrics, setSelectedMetrics] = useState<Set<string>>(new Set(['distance']));

  useEffect(() => {
    const fetchWeeklyMetrics = async () => {
      try {
        const metrics = await dailyMetricsService.getMetricsForDateRange(
          new Date(Date.now() - 8 * 7 * 24 * 60 * 60 * 1000),
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

  const [filters, setFilters] = useState<ActivityFilter[]>([
    {
      id: 'all',
      label: 'All Activities',
      color: '#3b82f6',
      enabled: true,
      distanceKey: 'allDistance',
      loadKey: 'allTrainingLoad',
      speedKey: 'allAvgSpeed',
      heartRateKey: 'allAvgHeartRate'
    },
    {
      id: 'runs',
      label: 'Runs',
      color: '#ef4444',
      enabled: false,
      distanceKey: 'runDistance',
      loadKey: 'runTrainingLoad',
      speedKey: 'runAvgSpeed',
      heartRateKey: 'runAvgHeartRate'
    },
    {
      id: 'outdoor-rides',
      label: 'Outdoor Rides',
      color: '#f59e0b',
      enabled: false,
      distanceKey: 'outdoorRideDistance',
      loadKey: 'outdoorRideTrainingLoad',
      speedKey: 'outdoorRideAvgSpeed',
      heartRateKey: 'outdoorRideAvgHeartRate'
    },
    {
      id: 'virtual-rides',
      label: 'Virtual Rides',
      color: '#8b5cf6',
      enabled: false,
      distanceKey: 'virtualRideDistance',
      loadKey: 'virtualRideTrainingLoad',
      speedKey: 'virtualRideAvgSpeed',
      heartRateKey: 'virtualRideAvgHeartRate'
    }
  ]);

  // Calculate weekly trends with activity type breakdown
  const weeklyTrends = useMemo((): WeeklyTrend[] => {
    const now = new Date();
    const weeks: WeeklyTrend[] = [];

    for (let i = 7; i >= 0; i--) {
      const weekStart = startOfWeek(addWeeks(now, -i), { weekStartsOn: 1 });
      const weekEnd = addWeeks(weekStart, 1);

      const weekActivities = activities.filter(activity => {
        const activityDate = new Date(activity.start_date_local);
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
      if (athlete) {
        const activitiesUpToThisWeek = activities.filter(activity => {
          const activityDate = new Date(activity.start_date_local);
          return activityDate < weekEnd;
        });

        const recentActivitiesForThisWeek = activitiesUpToThisWeek.slice(0, Math.min(28, activitiesUpToThisWeek.length));

        if (recentActivitiesForThisWeek.length > 0) {
          const weekHealthMetrics = healthMetricsService.calculateHealthMetrics(
            athlete,
            recentActivitiesForThisWeek,
            [],
            []
          );
          overallPerformance = weekHealthMetrics.overallScore;
        }
      }

      const weekMetricsData = weeklyMetrics.get(weekLabel) || [];
      const avgRecovery = weekMetricsData.length > 0
        ? Math.round(weekMetricsData.reduce((sum, m) => {
            if (m.recovery_score > 0) return sum + m.recovery_score;

            const scores: number[] = [];
            if (m.sleep_minutes > 0) scores.push(Math.min(100, (m.sleep_minutes / 480) * 100));
            if (m.hrv > 0) scores.push(Math.min(100, (m.hrv / 80) * 100));
            if (m.resting_hr > 0) scores.push(Math.max(0, 100 - ((m.resting_hr - 40) * 2)));

            return sum + (scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0);
          }, 0) / weekMetricsData.length)
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
  }, [activities, athlete, weeklyMetrics]);

  const toggleFilter = (filterId: string) => {
    setFilters(prev => prev.map(filter =>
      filter.id === filterId
        ? { ...filter, enabled: !filter.enabled }
        : filter
    ));
  };

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

  const enabledFilters = filters.filter(f => f.enabled);

  const metricConfigs = [
    { id: 'distance', label: 'Distance', color: '#3b82f6', unit: 'miles', key: 'allDistance' },
    { id: 'load', label: 'Training Load', color: '#10b981', unit: 'load', key: 'allTrainingLoad' },
    { id: 'speed', label: 'Avg Speed', color: '#f59e0b', unit: 'mph', key: 'allAvgSpeed' },
    { id: 'heartRate', label: 'Avg Heart Rate', color: '#ef4444', unit: 'bpm', key: 'allAvgHeartRate' },
    { id: 'performance', label: 'Overall Performance', color: '#8b5cf6', unit: 'score', key: 'overallPerformance' },
    { id: 'recovery', label: 'Recovery Calculated', color: '#ec4899', unit: 'score', key: 'recoveryCalculated' },
  ];

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 mb-2">{`Week of ${label}`}</p>
          {payload.map((entry: any, index: number) => {
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

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Training Trends (Last 8 Weeks)
        </h3>
        <p className="text-gray-600 text-sm">
          Analyze your training patterns by activity type and metric
        </p>
      </div>

      {/* Controls */}
      <div className="mb-6 space-y-4">
        {/* Metric Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
            <Filter className="w-4 h-4 mr-1" />
            Metrics to Display (select multiple)
          </label>
          <div className="flex flex-wrap gap-2">
            {metricConfigs.map((metric) => (
              <button
                key={metric.id}
                onClick={() => toggleMetric(metric.id)}
                className={`flex items-center space-x-2 px-3 py-1.5 text-sm rounded-md transition-colors ${
                  selectedMetrics.has(metric.id)
                    ? 'text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="week"
              stroke="#6b7280"
              fontSize={12}
            />
            <YAxis
              stroke="#6b7280"
              fontSize={12}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />

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
        <div className="bg-blue-50 rounded-lg p-3">
          <div className="flex items-center justify-center mb-1">
            <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
            <span className="text-sm font-medium text-gray-700">Distance</span>
          </div>
          <p className="text-xs text-gray-600">Weekly mileage volume</p>
        </div>
        <div className="bg-green-50 rounded-lg p-3">
          <div className="flex items-center justify-center mb-1">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
            <span className="text-sm font-medium text-gray-700">Training Load</span>
          </div>
          <p className="text-xs text-gray-600">Intensity × time factor</p>
        </div>
        <div className="bg-orange-50 rounded-lg p-3">
          <div className="flex items-center justify-center mb-1">
            <div className="w-3 h-3 bg-orange-500 rounded-full mr-2"></div>
            <span className="text-sm font-medium text-gray-700">Avg Speed</span>
          </div>
          <p className="text-xs text-gray-600">Overall pace trends</p>
        </div>
        <div className="bg-red-50 rounded-lg p-3">
          <div className="flex items-center justify-center mb-1">
            <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
            <span className="text-sm font-medium text-gray-700">Avg Heart Rate</span>
          </div>
          <p className="text-xs text-gray-600">Cardiovascular intensity</p>
        </div>
        <div className="bg-violet-50 rounded-lg p-3">
          <div className="flex items-center justify-center mb-1">
            <div className="w-3 h-3 bg-violet-500 rounded-full mr-2"></div>
            <span className="text-sm font-medium text-gray-700">Overall Performance</span>
          </div>
          <p className="text-xs text-gray-600">Holistic training score</p>
        </div>
        <div className="bg-pink-50 rounded-lg p-3">
          <div className="flex items-center justify-center mb-1">
            <div className="w-3 h-3 bg-pink-500 rounded-full mr-2"></div>
            <span className="text-sm font-medium text-gray-700">Recovery</span>
          </div>
          <p className="text-xs text-gray-600">Calculated recovery status</p>
        </div>
      </div>

      <p className="text-xs text-gray-500 text-center mt-4">Powered by Strava</p>
    </div>
  );
};