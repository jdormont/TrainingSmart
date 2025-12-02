import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Filter, Eye, EyeOff } from 'lucide-react';
import type { StravaActivity } from '../../types';
import { startOfWeek, format, addWeeks } from 'date-fns';

interface TrainingTrendsChartProps {
  activities: StravaActivity[];
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

export const TrainingTrendsChart: React.FC<TrainingTrendsChartProps> = ({ activities }) => {
  const [activeMetric, setActiveMetric] = useState<'distance' | 'load' | 'speed' | 'heartRate'>('distance');
  const [filters, setFilters] = useState<ActivityFilter[]>([
    {
      id: 'all',
      label: 'All Activities',
      color: '#6366f1',
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
      color: '#3b82f6',
      enabled: false,
      distanceKey: 'outdoorRideDistance',
      loadKey: 'outdoorRideTrainingLoad',
      speedKey: 'outdoorRideAvgSpeed',
      heartRateKey: 'outdoorRideAvgHeartRate'
    },
    {
      id: 'virtual-rides',
      label: 'Virtual Rides',
      color: '#10b981',
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

      weeks.push({
        week: format(weekStart, 'MMM d'),
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
      });
    }
    
    return weeks;
  }, [activities]);

  const toggleFilter = (filterId: string) => {
    setFilters(prev => prev.map(filter => 
      filter.id === filterId 
        ? { ...filter, enabled: !filter.enabled }
        : filter
    ));
  };

  const enabledFilters = filters.filter(f => f.enabled);

  // Get the appropriate data key based on active metric
  const getDataKey = (filter: ActivityFilter) => {
    switch (activeMetric) {
      case 'distance': return filter.distanceKey;
      case 'load': return filter.loadKey;
      case 'speed': return filter.speedKey;
      case 'heartRate': return filter.heartRateKey;
      default: return filter.distanceKey;
    }
  };

  // Get metric label and unit
  const getMetricInfo = () => {
    switch (activeMetric) {
      case 'distance': return { label: 'Distance', unit: 'miles' };
      case 'load': return { label: 'Training Load', unit: 'load' };
      case 'speed': return { label: 'Average Speed', unit: 'mph' };
      case 'heartRate': return { label: 'Average Heart Rate', unit: 'bpm' };
      default: return { label: 'Distance', unit: 'miles' };
    }
  };

  const metricInfo = getMetricInfo();

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 mb-2">{`Week of ${label}`}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {`${entry.name}: ${entry.value} ${metricInfo.unit}`}
            </p>
          ))}
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
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Metric to Display
          </label>
          <div className="flex space-x-2">
            {[
              { key: 'distance', label: 'Distance (miles)' },
              { key: 'load', label: 'Training Load' },
              { key: 'speed', label: 'Avg Speed (mph)' },
              { key: 'heartRate', label: 'Avg Heart Rate (bpm)' }
            ].map((metric) => (
              <button
                key={metric.key}
                onClick={() => setActiveMetric(metric.key as any)}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  activeMetric === metric.key
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {metric.label}
              </button>
            ))}
          </div>
        </div>

        {/* Activity Type Filters */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
            <Filter className="w-4 h-4 mr-1" />
            Activity Types
          </label>
          <div className="flex flex-wrap gap-2">
            {filters.map((filter) => (
              <button
                key={filter.id}
                onClick={() => toggleFilter(filter.id)}
                className={`flex items-center space-x-2 px-3 py-1 text-sm rounded-md transition-colors ${
                  filter.enabled
                    ? 'text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                style={filter.enabled ? { backgroundColor: filter.color } : {}}
              >
                {filter.enabled ? (
                  <Eye className="w-3 h-3" />
                ) : (
                  <EyeOff className="w-3 h-3" />
                )}
                <span>{filter.label}</span>
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
              label={{ 
                value: metricInfo.label, 
                angle: -90, 
                position: 'insideLeft',
                style: { textAnchor: 'middle' }
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            
            {enabledFilters.map((filter) => (
              <Line
                key={filter.id}
                type="monotone"
                dataKey={getDataKey(filter)}
                stroke={filter.color}
                strokeWidth={2}
                dot={{ fill: filter.color, strokeWidth: 2, r: 4 }}
                name={filter.label}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Metric Explanations */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
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
        <div className="bg-yellow-50 rounded-lg p-3">
          <div className="flex items-center justify-center mb-1">
            <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
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
      </div>

      <p className="text-xs text-gray-500 text-center mt-4">Powered by Strava</p>
    </div>
  );
};