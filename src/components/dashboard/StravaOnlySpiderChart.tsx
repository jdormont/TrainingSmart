import React, { useState } from 'react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts';
import { Activity, TrendingUp, Scale, Zap, Target, ChevronDown, ChevronUp, Info } from 'lucide-react';
import type { StravaActivity, StravaAthlete } from '../../types';
import { LoadingSpinner } from '../common/LoadingSpinner';

import { trainingMetricsService, type StravaOnlyMetrics } from '../../services/trainingMetricsService';

interface StravaOnlySpiderChartProps {
  athlete: StravaAthlete;
  activities: StravaActivity[];
  loading?: boolean;
}

export const StravaOnlySpiderChart: React.FC<StravaOnlySpiderChartProps> = ({
  activities,
  loading = false
}) => {
  const [expandedDimension, setExpandedDimension] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<StravaOnlyMetrics | null>(null);

  React.useEffect(() => {
    if (activities.length > 0) {
      // Filter for last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentActivities = activities.filter(a =>
        new Date(a.start_date_local) >= thirtyDaysAgo
      );

      const calculatedMetrics = trainingMetricsService.calculateStravaMetrics(recentActivities);
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

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: { dimension: string; score: number } }[] }) => {
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
          <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center">
            Training Performance
            <div className="group relative ml-2">
              <Info className="w-4 h-4 text-gray-400 cursor-help" />
              <div className="absolute z-10 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none -left-20 top-6">
                <p className="font-semibold mb-1">Overall Score Inputs:</p>
                <ul className="space-y-1 text-gray-300">
                  <li>• Endurance (25%)</li>
                  <li>• Power/Intensity (20%)</li>
                  <li>• Consistency (20%)</li>
                  <li>• Training Load (20%)</li>
                  <li>• Speed (15%)</li>
                </ul>
                <div className="absolute w-2 h-2 bg-gray-900 rotate-45 left-24 -top-1"></div>
              </div>
            </div>
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
          Based on activities from last 30 days • Strava data only
        </p>
      </div>
    </div>
  );
};
