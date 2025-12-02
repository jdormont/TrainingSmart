import React, { useState } from 'react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts';
import { Activity, TrendingUp, Scale, Zap, Target, ChevronDown, ChevronUp, Info } from 'lucide-react';
import type { StravaActivity, StravaAthlete } from '../../types';
import { LoadingSpinner } from '../common/LoadingSpinner';

interface StravaOnlyMetrics {
  power: number; // Power/intensity capacity
  endurance: number; // Volume and long ride capacity
  consistency: number; // Training regularity
  speed: number; // Average speed trends
  trainingLoad: number; // Overall training stress
  overallScore: number;
  details: {
    power: MetricDetail;
    endurance: MetricDetail;
    consistency: MetricDetail;
    speed: MetricDetail;
    trainingLoad: MetricDetail;
  };
}

interface MetricDetail {
  score: number;
  components: Array<{
    name: string;
    value: string | number;
    contribution: number;
  }>;
  trend: 'improving' | 'stable' | 'declining';
  suggestion: string;
}

interface StravaOnlySpiderChartProps {
  athlete: StravaAthlete;
  activities: StravaActivity[];
  loading?: boolean;
}

export const StravaOnlySpiderChart: React.FC<StravaOnlySpiderChartProps> = ({
  athlete,
  activities,
  loading = false
}) => {
  const [expandedDimension, setExpandedDimension] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<StravaOnlyMetrics | null>(null);

  React.useEffect(() => {
    if (activities.length > 0) {
      const calculatedMetrics = calculateStravaMetrics(activities);
      setMetrics(calculatedMetrics);
    }
  }, [activities]);

  const getDimensionIcon = (dimension: string) => {
    switch (dimension) {
      case 'power': return Zap;
      case 'endurance': return Activity;
      case 'consistency': return Target;
      case 'speed': return TrendingUp;
      case 'trainingLoad': return Scale;
      default: return Activity;
    }
  };

  const getDimensionColor = (score: number) => {
    if (score >= 80) return '#10B981';
    if (score >= 60) return '#F59E0B';
    return '#EF4444';
  };

  const getTrendIcon = (trend: 'improving' | 'stable' | 'declining') => {
    switch (trend) {
      case 'improving': return <TrendingUp className="w-3 h-3 text-green-500" />;
      case 'declining': return <TrendingUp className="w-3 h-3 text-red-500 rotate-180" />;
      default: return <span className="w-3 h-3 text-gray-400">•</span>;
    }
  };

  const formatDimensionName = (key: string) => {
    switch (key) {
      case 'power': return 'Power/Intensity';
      case 'endurance': return 'Endurance';
      case 'consistency': return 'Consistency';
      case 'speed': return 'Speed';
      case 'trainingLoad': return 'Training Load';
      default: return key;
    }
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900">{data.dimension}</p>
          <p className="text-sm text-gray-600">Score: {data.score}/100</p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">
          <LoadingSpinner size="lg" className="text-orange-500 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Analyzing Your Training Data
          </h3>
          <p className="text-gray-600">
            Processing your Strava activities...
          </p>
        </div>
      </div>
    );
  }

  if (!metrics || activities.length < 3) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-500">
          <Activity className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">Not enough training data</p>
          <p className="text-xs">Need at least 3 activities for analysis</p>
        </div>
      </div>
    );
  }

  const chartData = [
    {
      dimension: 'Power',
      score: metrics.power,
      fullMark: 100
    },
    {
      dimension: 'Endurance',
      score: metrics.endurance,
      fullMark: 100
    },
    {
      dimension: 'Consistency',
      score: metrics.consistency,
      fullMark: 100
    },
    {
      dimension: 'Speed',
      score: metrics.speed,
      fullMark: 100
    },
    {
      dimension: 'Training Load',
      score: metrics.trainingLoad,
      fullMark: 100
    }
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            Training Performance
          </h3>
          <p className="text-gray-600 text-sm">
            Analysis based on Strava activity data
          </p>
        </div>

        <div className="text-center">
          <div className="text-3xl font-bold text-gray-900 mb-1">
            {metrics.overallScore}
          </div>
          <div className="text-sm text-gray-600">Overall Score</div>
          <span className="text-xs px-2 py-1 rounded-full font-medium bg-blue-100 text-blue-600">
            Strava only
          </span>
        </div>
      </div>

      <div className="h-80 mb-6">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={chartData} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
            <PolarGrid stroke="#e5e7eb" />
            <PolarAngleAxis
              dataKey="dimension"
              tick={{ fontSize: 12, fill: '#6b7280' }}
              className="text-xs"
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              tickCount={6}
            />
            <Radar
              name="Performance Score"
              dataKey="score"
              stroke="#f97316"
              fill="#f97316"
              fillOpacity={0.2}
              strokeWidth={2}
              dot={{ fill: '#f97316', strokeWidth: 2, r: 4 }}
            />
            <Tooltip content={<CustomTooltip />} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-3">
        {Object.entries(metrics.details).map(([key, detail]) => {
          const Icon = getDimensionIcon(key);
          const isExpanded = expandedDimension === key;

          return (
            <div key={key} className="border border-gray-200 rounded-lg">
              <button
                onClick={() => setExpandedDimension(isExpanded ? null : key)}
                className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: getDimensionColor(detail.score) + '20' }}
                  >
                    <Icon
                      className="w-4 h-4"
                      style={{ color: getDimensionColor(detail.score) }}
                    />
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-gray-900">
                      {formatDimensionName(key)}
                    </div>
                    <div className="text-sm text-gray-600 flex items-center space-x-1">
                      <span>{detail.score}/100</span>
                      {getTrendIcon(detail.trend)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <div
                    className="text-lg font-bold"
                    style={{ color: getDimensionColor(detail.score) }}
                  >
                    {detail.score}
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 border-t border-gray-100">
                  <div className="mt-3 space-y-3">
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Components</h4>
                      <div className="space-y-2">
                        {detail.components.map((component, index) => (
                          <div key={index} className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">{component.name}</span>
                            <div className="flex items-center space-x-2">
                              <span className="text-gray-900">{component.value}</span>
                              <span className="text-xs text-gray-500">
                                (+{component.contribution} pts)
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-orange-50 rounded-md p-3">
                      <div className="flex items-start space-x-2">
                        <Info className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <h4 className="text-sm font-medium text-orange-900 mb-1">
                            Recommendation
                          </h4>
                          <p className="text-sm text-orange-800">
                            {detail.suggestion}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200 text-center">
        <p className="text-xs text-gray-500">
          Based on last {activities.length} activities • Strava data only
        </p>
      </div>
    </div>
  );
};

function calculateStravaMetrics(activities: StravaActivity[]): StravaOnlyMetrics {
  const recentActivities = activities.slice(0, Math.min(28, activities.length));

  const power = calculatePowerMetric(recentActivities);
  const endurance = calculateEnduranceMetric(recentActivities);
  const consistency = calculateConsistencyMetric(recentActivities);
  const speed = calculateSpeedMetric(recentActivities);
  const trainingLoad = calculateTrainingLoadMetric(recentActivities);

  const overallScore = Math.round(
    (power.score * 0.2) +
    (endurance.score * 0.25) +
    (consistency.score * 0.2) +
    (speed.score * 0.15) +
    (trainingLoad.score * 0.2)
  );

  return {
    power: power.score,
    endurance: endurance.score,
    consistency: consistency.score,
    speed: speed.score,
    trainingLoad: trainingLoad.score,
    overallScore,
    details: {
      power,
      endurance,
      consistency,
      speed,
      trainingLoad
    }
  };
}

function calculatePowerMetric(activities: StravaActivity[]): MetricDetail {
  const components = [];
  let totalScore = 0;

  const hardRides = activities.filter(a => a.average_speed * 2.237 >= 18);
  const hardRidePercentage = (hardRides.length / activities.length) * 100;

  const powerScore = Math.min(40, hardRidePercentage * 2);
  components.push({
    name: 'High Intensity Rides',
    value: `${hardRides.length} rides (${Math.round(hardRidePercentage)}%)`,
    contribution: Math.round(powerScore)
  });
  totalScore += powerScore;

  const elevationGains = activities.map(a => a.total_elevation_gain);
  const avgElevation = elevationGains.reduce((sum, e) => sum + e, 0) / elevationGains.length;
  const elevationScore = Math.min(30, (avgElevation / 1000) * 30);
  components.push({
    name: 'Climbing Volume',
    value: `${Math.round(avgElevation * 3.28084)} ft avg`,
    contribution: Math.round(elevationScore)
  });
  totalScore += elevationScore;

  const maxEffort = Math.max(...activities.map(a => a.average_speed));
  const effortScore = Math.min(30, (maxEffort * 2.237 / 25) * 30);
  components.push({
    name: 'Peak Performance',
    value: `${(maxEffort * 2.237).toFixed(1)} mph max avg`,
    contribution: Math.round(effortScore)
  });
  totalScore += effortScore;

  const finalScore = Math.min(100, Math.round(totalScore));

  return {
    score: finalScore,
    components,
    trend: calculateTrendFromActivities(activities, 'speed'),
    suggestion: finalScore < 60
      ? 'Add 1-2 high-intensity interval sessions per week'
      : finalScore < 80
      ? 'Good power development - maintain intensity work'
      : 'Excellent power capacity - focus on maintaining and varying stimuli'
  };
}

function calculateEnduranceMetric(activities: StravaActivity[]): MetricDetail {
  const components = [];
  let totalScore = 0;

  const totalDistance = activities.reduce((sum, a) => sum + a.distance, 0);
  const avgWeeklyDistance = (totalDistance / activities.length) * 7 * 0.000621371;

  let volumeScore = 0;
  if (avgWeeklyDistance >= 150) volumeScore = 40;
  else if (avgWeeklyDistance >= 100) volumeScore = 32;
  else if (avgWeeklyDistance >= 75) volumeScore = 25;
  else if (avgWeeklyDistance >= 50) volumeScore = 20;
  else volumeScore = avgWeeklyDistance * 0.4;

  components.push({
    name: 'Weekly Volume',
    value: `${avgWeeklyDistance.toFixed(1)} mi/week`,
    contribution: Math.round(volumeScore)
  });
  totalScore += volumeScore;

  const longestRide = Math.max(...activities.map(a => a.distance)) * 0.000621371;
  let longRideScore = 0;
  if (longestRide >= 100) longRideScore = 35;
  else if (longestRide >= 75) longRideScore = 28;
  else if (longestRide >= 50) longRideScore = 22;
  else longRideScore = longestRide * 0.4;

  components.push({
    name: 'Longest Ride',
    value: `${longestRide.toFixed(1)} miles`,
    contribution: Math.round(longRideScore)
  });
  totalScore += longRideScore;

  const avgDuration = activities.reduce((sum, a) => sum + a.moving_time, 0) / activities.length / 3600;
  const durationScore = Math.min(25, avgDuration * 8);
  components.push({
    name: 'Ride Duration',
    value: `${avgDuration.toFixed(1)}h avg`,
    contribution: Math.round(durationScore)
  });
  totalScore += durationScore;

  const finalScore = Math.min(100, Math.round(totalScore));

  return {
    score: finalScore,
    components,
    trend: calculateTrendFromActivities(activities, 'distance'),
    suggestion: finalScore < 60
      ? 'Build aerobic base with longer, easier rides'
      : finalScore < 80
      ? 'Solid endurance base - gradually increase volume'
      : 'Excellent endurance capacity - maintain consistency'
  };
}

function calculateConsistencyMetric(activities: StravaActivity[]): MetricDetail {
  const components = [];
  let totalScore = 0;

  const activityDates = activities.map(a => new Date(a.start_date_local).toDateString());
  const uniqueDays = new Set(activityDates).size;
  const dayRange = Math.ceil((new Date(activities[0].start_date_local).getTime() -
    new Date(activities[activities.length - 1].start_date_local).getTime()) / (1000 * 60 * 60 * 24));

  const frequency = (uniqueDays / dayRange) * 7;
  let frequencyScore = 0;
  if (frequency >= 4 && frequency <= 6) frequencyScore = 40;
  else if (frequency >= 3 && frequency <= 7) frequencyScore = 30;
  else if (frequency >= 2) frequencyScore = 20;
  else frequencyScore = frequency * 10;

  components.push({
    name: 'Training Frequency',
    value: `${frequency.toFixed(1)} days/week`,
    contribution: Math.round(frequencyScore)
  });
  totalScore += frequencyScore;

  const distances = activities.map(a => a.distance);
  const mean = distances.reduce((sum, d) => sum + d, 0) / distances.length;
  const variance = Math.sqrt(
    distances.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / distances.length
  );
  const coefficientOfVariation = (variance / mean) * 100;
  const consistencyScore = Math.max(0, Math.min(35, 35 - coefficientOfVariation * 0.5));

  components.push({
    name: 'Volume Consistency',
    value: `${(100 - coefficientOfVariation).toFixed(0)}% consistent`,
    contribution: Math.round(consistencyScore)
  });
  totalScore += consistencyScore;

  const gapScores = [];
  for (let i = 0; i < activities.length - 1; i++) {
    const gap = Math.abs(
      new Date(activities[i].start_date_local).getTime() -
      new Date(activities[i + 1].start_date_local).getTime()
    ) / (1000 * 60 * 60 * 24);
    gapScores.push(gap <= 3 ? 1 : 0);
  }
  const regularityScore = (gapScores.reduce((sum, s) => sum + s, 0) / gapScores.length) * 25;

  components.push({
    name: 'Schedule Regularity',
    value: `${Math.round((regularityScore / 25) * 100)}% regular`,
    contribution: Math.round(regularityScore)
  });
  totalScore += regularityScore;

  const finalScore = Math.min(100, Math.round(totalScore));

  return {
    score: finalScore,
    components,
    trend: 'stable',
    suggestion: finalScore < 60
      ? 'Aim for 3-4 rides per week with consistent gaps'
      : finalScore < 80
      ? 'Good consistency - maintain regular training schedule'
      : 'Excellent training consistency - key to long-term improvement'
  };
}

function calculateSpeedMetric(activities: StravaActivity[]): MetricDetail {
  const components = [];
  let totalScore = 0;

  const speeds = activities.map(a => a.average_speed * 2.237);
  const avgSpeed = speeds.reduce((sum, s) => sum + s, 0) / speeds.length;

  let speedScore = 0;
  if (avgSpeed >= 20) speedScore = 40;
  else if (avgSpeed >= 18) speedScore = 35;
  else if (avgSpeed >= 16) speedScore = 30;
  else if (avgSpeed >= 14) speedScore = 25;
  else speedScore = avgSpeed * 1.5;

  components.push({
    name: 'Average Speed',
    value: `${avgSpeed.toFixed(1)} mph`,
    contribution: Math.round(speedScore)
  });
  totalScore += speedScore;

  const midpoint = Math.floor(activities.length / 2);
  const recentAvg = speeds.slice(0, midpoint).reduce((sum, s) => sum + s, 0) / midpoint;
  const olderAvg = speeds.slice(midpoint).reduce((sum, s) => sum + s, 0) / (activities.length - midpoint);
  const improvement = ((recentAvg - olderAvg) / olderAvg) * 100;
  const trendScore = Math.min(30, Math.max(0, 15 + improvement * 1.5));

  components.push({
    name: 'Speed Progression',
    value: improvement > 0 ? `+${improvement.toFixed(1)}%` : `${improvement.toFixed(1)}%`,
    contribution: Math.round(trendScore)
  });
  totalScore += trendScore;

  const maxSpeed = Math.max(...speeds);
  const peakScore = Math.min(30, (maxSpeed / 25) * 30);
  components.push({
    name: 'Peak Speed Capacity',
    value: `${maxSpeed.toFixed(1)} mph`,
    contribution: Math.round(peakScore)
  });
  totalScore += peakScore;

  const finalScore = Math.min(100, Math.round(totalScore));

  return {
    score: finalScore,
    components,
    trend: improvement > 5 ? 'improving' : improvement < -5 ? 'declining' : 'stable',
    suggestion: finalScore < 60
      ? 'Work on leg strength and cadence efficiency'
      : finalScore < 80
      ? 'Good speed - add tempo work to continue improving'
      : 'Excellent speed capacity - focus on sustaining at race pace'
  };
}

function calculateTrainingLoadMetric(activities: StravaActivity[]): MetricDetail {
  const components = [];
  let totalScore = 0;

  const totalTime = activities.reduce((sum, a) => sum + a.moving_time, 0) / 3600;
  const avgWeeklyHours = (totalTime / activities.length) * 7;

  let hoursScore = 0;
  if (avgWeeklyHours >= 10) hoursScore = 35;
  else if (avgWeeklyHours >= 8) hoursScore = 30;
  else if (avgWeeklyHours >= 6) hoursScore = 25;
  else if (avgWeeklyHours >= 4) hoursScore = 20;
  else hoursScore = avgWeeklyHours * 5;

  components.push({
    name: 'Weekly Hours',
    value: `${avgWeeklyHours.toFixed(1)}h/week`,
    contribution: Math.round(hoursScore)
  });
  totalScore += hoursScore;

  const intensityDist = calculateIntensityDistribution(activities);
  const balanceScore = intensityDist.easy >= 70 && intensityDist.easy <= 85 ? 35 :
                      intensityDist.easy >= 60 && intensityDist.easy <= 90 ? 25 : 15;

  components.push({
    name: 'Easy/Hard Balance',
    value: `${intensityDist.easy}% easy`,
    contribution: balanceScore
  });
  totalScore += balanceScore;

  const workloadVariation = calculateWorkloadProgression(activities);
  components.push({
    name: 'Load Management',
    value: workloadVariation,
    contribution: 30
  });
  totalScore += 30;

  const finalScore = Math.min(100, Math.round(totalScore));

  return {
    score: finalScore,
    components,
    trend: 'stable',
    suggestion: finalScore < 60
      ? 'Balance training load with 80% easy, 20% hard rides'
      : finalScore < 80
      ? 'Good training load balance - avoid sudden increases'
      : 'Excellent load management - sustainable long-term'
  };
}

function calculateIntensityDistribution(activities: StravaActivity[]) {
  let easy = 0, moderate = 0, hard = 0;

  activities.forEach(a => {
    const speedMph = a.average_speed * 2.237;
    if (speedMph < 15) easy++;
    else if (speedMph < 18) moderate++;
    else hard++;
  });

  const total = activities.length;
  return {
    easy: Math.round((easy / total) * 100),
    moderate: Math.round((moderate / total) * 100),
    hard: Math.round((hard / total) * 100)
  };
}

function calculateWorkloadProgression(activities: StravaActivity[]): string {
  if (activities.length < 6) return 'Appropriate';

  const distances = activities.map(a => a.distance);
  const recent = distances.slice(0, 3).reduce((sum, d) => sum + d, 0) / 3;
  const older = distances.slice(3, 6).reduce((sum, d) => sum + d, 0) / 3;

  if (older === 0) return 'Appropriate';
  const change = ((recent - older) / older) * 100;

  if (change > 15) return 'Too aggressive';
  if (change < -15) return 'Decreasing';
  return 'Appropriate';
}

function calculateTrendFromActivities(
  activities: StravaActivity[],
  metric: 'speed' | 'distance'
): 'improving' | 'stable' | 'declining' {
  if (activities.length < 6) return 'stable';

  const midpoint = Math.floor(activities.length / 2);
  const recentData = activities.slice(0, midpoint);
  const olderData = activities.slice(midpoint);

  let recentAvg = 0, olderAvg = 0;

  if (metric === 'speed') {
    recentAvg = recentData.reduce((sum, a) => sum + a.average_speed, 0) / recentData.length;
    olderAvg = olderData.reduce((sum, a) => sum + a.average_speed, 0) / olderData.length;
  } else {
    recentAvg = recentData.reduce((sum, a) => sum + a.distance, 0) / recentData.length;
    olderAvg = olderData.reduce((sum, a) => sum + a.distance, 0) / olderData.length;
  }

  const change = ((recentAvg - olderAvg) / olderAvg) * 100;

  if (change > 5) return 'improving';
  if (change < -5) return 'declining';
  return 'stable';
}
