import React, { useState } from 'react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts';
import { Heart, Activity, Moon, Battery, Scale, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, Info } from 'lucide-react';
import type { HealthMetrics } from '../../services/healthMetricsService';
import { LoadingSpinner } from '../common/LoadingSpinner';

interface HealthSpiderChartProps {
  healthMetrics: HealthMetrics | null;
  loading?: boolean;
}

export const HealthSpiderChart: React.FC<HealthSpiderChartProps> = ({
  healthMetrics,
  loading = false
}) => {
  const [expandedDimension, setExpandedDimension] = useState<string | null>(null);

  const getDimensionIcon = (dimension: string) => {
    switch (dimension) {
      case 'cardiovascular': return Heart;
      case 'endurance': return Activity;
      case 'recovery': return Battery;
      case 'sleep': return Moon;
      case 'trainingBalance': return Scale;
      default: return Activity;
    }
  };

  const getDimensionColor = (score: number) => {
    if (score >= 80) return '#10B981'; // Green
    if (score >= 60) return '#F59E0B'; // Yellow
    return '#EF4444'; // Red
  };

  const getTrendIcon = (trend: 'improving' | 'stable' | 'declining') => {
    switch (trend) {
      case 'improving': return <TrendingUp className="w-3 h-3 text-green-500" />;
      case 'declining': return <TrendingDown className="w-3 h-3 text-red-500" />;
      default: return <Minus className="w-3 h-3 text-gray-400" />;
    }
  };

  const getDataQualityColor = (quality: string) => {
    switch (quality) {
      case 'excellent': return 'text-green-600 bg-green-100';
      case 'good': return 'text-blue-600 bg-blue-100';
      default: return 'text-yellow-600 bg-yellow-100';
    }
  };

  const formatDimensionName = (key: string) => {
    switch (key) {
      case 'cardiovascular': return 'Cardiovascular';
      case 'endurance': return 'Endurance';
      case 'recovery': return 'Recovery';
      case 'sleep': return 'Sleep';
      case 'trainingBalance': return 'Training Balance';
      default: return key;
    }
  };

  // Custom tooltip for radar chart
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-800 p-3 border border-slate-700 rounded-lg shadow-lg">
          <p className="font-medium text-slate-50">{data.dimension}</p>
          <p className="text-sm text-slate-300">Score: {data.score}/100</p>
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
          <h3 className="text-lg font-semibold text-slate-50 mb-2">
            Analyzing Your Health Metrics
          </h3>
          <p className="text-slate-400">
            Processing your training and recovery data...
          </p>
        </div>
      </div>
    );
  }

  if (!healthMetrics) {
    return (
      <div className="p-6">
        <div className="text-center text-slate-500">
          <Heart className="w-8 h-8 mx-auto mb-2 text-slate-600" />
          <p className="text-sm">No health metrics available</p>
          <p className="text-xs">Need more training data to generate insights</p>
        </div>
      </div>
    );
  }

  // Prepare data for radar chart
  const chartData = [
    {
      dimension: 'Cardiovascular',
      score: healthMetrics.cardiovascular,
      fullMark: 100
    },
    {
      dimension: 'Endurance',
      score: healthMetrics.endurance,
      fullMark: 100
    },
    {
      dimension: 'Recovery',
      score: healthMetrics.recovery,
      fullMark: 100
    },
    {
      dimension: 'Sleep',
      score: healthMetrics.sleep,
      fullMark: 100
    },
    {
      dimension: 'Training Balance',
      score: healthMetrics.trainingBalance,
      fullMark: 100
    }
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-50 mb-1">
            Health Overview
          </h3>
          <p className="text-slate-400 text-sm">
            Holistic view of your fitness and recovery
          </p>
        </div>

        <div className="text-center">
          <div className="text-3xl font-bold text-slate-50 mb-1">
            {healthMetrics.overallScore}
          </div>
          <div className="text-sm text-slate-400">Overall Score</div>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${getDataQualityColor(healthMetrics.dataQuality).replace('text-green-600 bg-green-100', 'text-green-400 bg-green-500/10 border border-green-500/20').replace('text-blue-600 bg-blue-100', 'text-blue-400 bg-blue-500/10 border border-blue-500/20').replace('text-yellow-600 bg-yellow-100', 'text-yellow-400 bg-yellow-500/10 border border-yellow-500/20')}`}>
            {healthMetrics.dataQuality} data
          </span>
        </div>
      </div>

      {/* Spider Chart */}
      <div className="h-80 mb-6">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={chartData} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
            <PolarGrid stroke="#334155" />
            <PolarAngleAxis
              dataKey="dimension"
              tick={{ fontSize: 12, fill: '#94a3b8' }}
              className="text-xs"
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: '#64748b' }}
              tickCount={6}
            />
            <Radar
              name="Health Score"
              dataKey="score"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.2}
              strokeWidth={2}
              dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
            />
            <Tooltip content={<CustomTooltip />} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Dimension Scores */}
      <div className="space-y-3">
        {Object.entries(healthMetrics.details).map(([key, detail]) => {
          const Icon = getDimensionIcon(key);
          const isExpanded = expandedDimension === key;

          return (
            <div key={key} className="border border-slate-800 rounded-lg">
              <button
                onClick={() => setExpandedDimension(isExpanded ? null : key)}
                className="w-full p-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors"
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
                    <div className="font-medium text-slate-200">
                      {formatDimensionName(key)}
                    </div>
                    <div className="text-sm text-slate-500">
                      {detail.score}/100 {getTrendIcon(detail.trend)}
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
                    <ChevronUp className="w-4 h-4 text-slate-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                  )}
                </div>
              </button>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-slate-800 bg-slate-800/20">
                  <div className="mt-3 space-y-3">
                    {/* Components */}
                    <div>
                      <h4 className="text-sm font-medium text-slate-400 mb-2">Components</h4>
                      <div className="space-y-2">
                        {detail.components.map((component, index) => (
                          <div key={index} className="flex items-center justify-between text-sm">
                            <span className="text-slate-400">{component.name}</span>
                            <div className="flex items-center space-x-2">
                              <span className="text-slate-200">{component.value}</span>
                              <span className="text-xs text-slate-500">
                                (+{component.contribution} pts)
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Suggestion */}
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-md p-3">
                      <div className="flex items-start space-x-2">
                        <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <h4 className="text-sm font-medium text-blue-400 mb-1">
                            Recommendation
                          </h4>
                          <p className="text-sm text-blue-300/80">
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

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-slate-800 text-center space-y-1">
        <p className="text-xs text-slate-500">
          Last updated: {healthMetrics.lastUpdated.toLocaleDateString()} •
          Based on last 4 weeks of data
        </p>
        <p className="text-xs text-slate-600 italic">
          Insights derived in part from Garmin device-sourced data.
        </p>
      </div>
    </div>
  );
};