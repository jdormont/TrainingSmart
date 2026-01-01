import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lightbulb, TrendingUp, Heart, Target, Calendar, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import type { WeeklyInsight } from '../../services/weeklyInsightService';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { format, startOfWeek } from 'date-fns';

interface WeeklyInsightCardProps {
  insight: WeeklyInsight | null;
  loading?: boolean;
  onRefresh?: () => void;
}

export const WeeklyInsightCard: React.FC<WeeklyInsightCardProps> = ({
  insight,
  loading = false,
  onRefresh
}) => {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();

  const handleAction = () => {
    if (insight?.actionLink) {
      if (insight.actionLink.startsWith('/chat')) {
        // preserve query params
        navigate(insight.actionLink);
      } else {
        navigate(insight.actionLink);
      }
    }
  };

  const getInsightIcon = (type: WeeklyInsight['type']) => {
    switch (type) {
      case 'recovery': return Heart;
      case 'training': return TrendingUp;
      case 'pattern': return Lightbulb;
      case 'goal': return Target;
      case 'consistency': return Calendar;
      default: return Lightbulb;
    }
  };

  const getInsightColor = (type: WeeklyInsight['type']) => {
    switch (type) {
      case 'recovery': return 'text-green-600 bg-green-50';
      case 'training': return 'text-blue-600 bg-blue-50';
      case 'pattern': return 'text-purple-600 bg-purple-50';
      case 'goal': return 'text-orange-600 bg-orange-50';
      case 'consistency': return 'text-indigo-600 bg-indigo-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600 bg-green-100';
    if (confidence >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const currentWeek = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'MMM d');

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse"></div>
            <div>
              <div className="h-5 bg-gray-200 rounded w-32 mb-2 animate-pulse"></div>
              <div className="h-3 bg-gray-200 rounded w-24 animate-pulse"></div>
            </div>
          </div>
          <LoadingSpinner size="sm" className="text-orange-500" />
        </div>
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse"></div>
        </div>
      </div>
    );
  }

  if (!insight) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-500">
          <Lightbulb className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No weekly insight available</p>
          <p className="text-xs">Check back after more training data is collected</p>
        </div>
      </div>
    );
  }

  const Icon = getInsightIcon(insight.type);
  const colorClasses = getInsightColor(insight.type);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${colorClasses}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Weekly Insight</h3>
            <p className="text-sm text-gray-600">Week of {currentWeek}</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Confidence Badge */}
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${getConfidenceColor(insight.confidence)}`}>
            {insight.confidence}% confidence
          </span>

          {/* Readiness Score Badge (New) */}
          {insight.readinessScore !== undefined && (
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${insight.readinessScore > 80 ? 'bg-green-100 text-green-700' :
              insight.readinessScore < 50 ? 'bg-red-100 text-red-700' :
                'bg-yellow-100 text-yellow-700'
              }`}>
              Readiness: {insight.readinessScore}
            </span>
          )}

          {/* Refresh Button */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              title="Generate new insight"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Insight Content */}
      <div className="space-y-3">
        <h4 className="font-medium text-gray-900">{insight.title}</h4>
        <p className="text-gray-700 leading-relaxed">{insight.message}</p>

        {/* Expandable Data Points */}
        {insight.dataPoints.length > 0 && (
          <div>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center space-x-1 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              <span>Supporting data</span>
              {expanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {expanded && (
              <div className="mt-2 p-3 bg-gray-50 rounded-md">
                <ul className="text-sm text-gray-600 space-y-1">
                  {insight.dataPoints.map((point, index) => (
                    <li key={index} className="flex items-center">
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-2"></span>
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Pacing Progress Bar (New) */}
      {insight.pacingProgress !== undefined && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Weekly Volume Goal</span>
            <span>{Math.round(insight.pacingProgress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${insight.pacingProgress > 115 ? 'bg-yellow-500' : // Risk of overtraining
                insight.pacingProgress < 85 ? 'bg-blue-500' :   // Building
                  'bg-green-500' // On Track
                }`}
              style={{ width: `${Math.min(insight.pacingProgress, 100)}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Action Button (New) */}
      {insight.actionLabel && (
        <div className="mt-4 pt-3 border-t border-gray-100">
          <button
            onClick={handleAction}
            className="w-full py-2 px-4 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-md transition-colors flex items-center justify-center space-x-2"
          >
            <Target className="w-4 h-4" />
            <span>{insight.actionLabel}</span>
          </button>
        </div>
      )}
      {/* Footer Metadata */}
      <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
        <span>Generated {insight.generatedAt.toLocaleDateString()}</span>
        <span className="capitalize">{insight.type} Insight</span>
      </div>
    </div>
  );
};