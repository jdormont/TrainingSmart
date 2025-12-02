import React from 'react';
import { Moon, Battery, Heart, Thermometer, Activity, TrendingUp, TrendingDown } from 'lucide-react';
import type { OuraSleepData, OuraReadinessData } from '../../types';
import { calculateSleepScore, getSleepScoreColor, getSleepScoreBgColor } from '../../utils/sleepScoreCalculator';

interface RecoveryCardProps {
  sleepData: OuraSleepData | null;
  readinessData: OuraReadinessData | null;
  loading?: boolean;
}

export const RecoveryCard: React.FC<RecoveryCardProps> = ({ 
  sleepData, 
  readinessData, 
  loading = false 
}) => {
  // Debug logging for data received
  console.log('=== RECOVERY CARD DEBUG ===');
  console.log('Sleep data received:', sleepData);
  console.log('Readiness data received:', readinessData);
  console.log('Loading state:', loading);
  
  if (sleepData) {
    console.log('Sleep data fields available:', Object.keys(sleepData));
    console.log('Key sleep metrics:', {
      total_sleep_duration: sleepData.total_sleep_duration,
      efficiency: sleepData.efficiency,
      lowest_heart_rate: sleepData.lowest_heart_rate,
      deep_sleep_duration: sleepData.deep_sleep_duration,
      rem_sleep_duration: sleepData.rem_sleep_duration,
      restless_periods: sleepData.restless_periods
    });
  }
  
  if (readinessData) {
    console.log('Readiness data fields available:', Object.keys(readinessData));
    console.log('Readiness score:', readinessData.score);
    console.log('Readiness contributors:', readinessData.contributors);
  }

  // Helper function to safely format numbers and handle missing data
  const safeNumber = (value: number | undefined | null, fallback: string = '--'): string => {
    console.log('safeNumber called with:', { value, fallback, result: value === undefined || value === null || isNaN(value) || value === 0 ? fallback : Math.round(value).toString() });
    if (value === undefined || value === null || isNaN(value) || value === 0) {
      return fallback;
    }
    return Math.round(value).toString();
  };

  // Helper function to safely format duration
  const safeDuration = (seconds: number | undefined | null): string => {
    console.log('safeDuration called with:', { seconds });
    if (!seconds || isNaN(seconds) || seconds === 0) {
      return '--';
    }
    const result = formatDuration(seconds);
    console.log('safeDuration result:', result);
    return result;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="flex items-center mb-4">
            <div className="w-6 h-6 bg-gray-200 rounded mr-2"></div>
            <div className="h-5 bg-gray-200 rounded w-32"></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="text-center">
                <div className="h-8 bg-gray-200 rounded mb-1"></div>
                <div className="h-4 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!sleepData && !readinessData) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center text-gray-500">
          <Moon className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No recovery data available</p>
          <p className="text-xs">Connect your Oura Ring to see sleep and readiness metrics</p>
        </div>
      </div>
    );
  }

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const getScoreColor = (score: number): string => {
    if (score >= 85) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (score: number): string => {
    if (score >= 85) return 'bg-green-50';
    if (score >= 70) return 'bg-yellow-50';
    return 'bg-red-50';
  };

  const getTrendIcon = (current: number, previous: number) => {
    if (current > previous) return <TrendingUp className="w-3 h-3 text-green-500" />;
    if (current < previous) return <TrendingDown className="w-3 h-3 text-red-500" />;
    return null;
  };

  // Calculate sleep score using our algorithm
  const sleepScore = sleepData ? calculateSleepScore(sleepData) : null;
  
  console.log('Sleep score calculation:', {
    hasSleepData: !!sleepData,
    sleepScore: sleepScore,
    totalScore: sleepScore?.totalScore
  });

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 flex items-center">
          <Moon className="w-5 h-5 mr-2 text-purple-500" />
          Recovery Status
        </h3>
        {sleepData && (
          <span className="text-xs text-gray-500">
            {new Date(sleepData.day).toLocaleDateString()}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Sleep Score */}
        {sleepData && (
          <div className={`text-center p-3 rounded-lg ${sleepScore ? getSleepScoreBgColor(sleepScore.totalScore) : 'bg-purple-50'}`}>
            <div className="flex items-center justify-center mb-1">
              <Moon className="w-4 h-4 mr-1 text-purple-600" />
            </div>
            <div className={`text-2xl font-bold ${sleepScore ? getSleepScoreColor(sleepScore.totalScore) : 'text-gray-900'}`}>
              {sleepScore ? sleepScore.totalScore : '--'}
            </div>
            <div className="text-xs text-gray-600">Sleep Score</div>
            <div className="text-xs text-gray-500">
              {sleepScore ? 'Calculated' : `Delta: ${safeNumber(sleepData.sleep_score_delta, '0')}`}
            </div>
          </div>
        )}

        {/* Readiness Score */}
        {readinessData && (
          <div className={`text-center p-3 rounded-lg ${getScoreBgColor(readinessData.score)}`}>
            <div className="flex items-center justify-center mb-1">
              <Battery className="w-4 h-4 mr-1 text-green-600" />
            </div>
            <div className={`text-2xl font-bold ${getScoreColor(readinessData.score)}`}>
              {safeNumber(readinessData.score)}
            </div>
            <div className="text-xs text-gray-600">Readiness</div>
          </div>
        )}

        {/* Sleep Duration */}
        {sleepData && (
          <div className="text-center p-3 rounded-lg bg-blue-50">
            <div className="flex items-center justify-center mb-1">
              <Activity className="w-4 h-4 mr-1 text-blue-600" />
            </div>
            <div className="text-lg font-bold text-gray-900">
              {safeDuration(sleepData.total_sleep_duration)}
            </div>
            <div className="text-xs text-gray-600">Sleep Time</div>
          </div>
        )}

        {/* Resting Heart Rate */}
        {sleepData && (
          <div className="text-center p-3 rounded-lg bg-red-50">
            <div className="flex items-center justify-center mb-1">
              <Heart className="w-4 h-4 mr-1 text-red-600" />
            </div>
            <div className="text-lg font-bold text-gray-900">
              {safeNumber(sleepData.lowest_heart_rate, '--')}
            </div>
            <div className="text-xs text-gray-600">Resting HR</div>
          </div>
        )}
      </div>

      {/* Additional Details */}
      {sleepData && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <div className="font-medium text-gray-900">
                {safeDuration(sleepData.deep_sleep_duration)}
              </div>
              <div className="text-gray-600">Deep Sleep</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-gray-900">
                {safeDuration(sleepData.rem_sleep_duration)}
              </div>
              <div className="text-gray-600">REM Sleep</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-gray-900">
                {safeNumber(sleepData.efficiency)}%
              </div>
              <div className="text-gray-600">Efficiency</div>
            </div>
          </div>
        </div>
      )}

      {/* Training Recommendation */}
      {readinessData && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="text-center">
            <div className="text-sm font-medium text-gray-900 mb-1">
              Training Recommendation
            </div>
            <div className={`text-sm ${getScoreColor(readinessData.score)}`}>
              {(readinessData.score && readinessData.score >= 85) ? '🟢 Ready for intense training' :
               (readinessData.score && readinessData.score >= 70) ? '🟡 Moderate training recommended' :
               '🔴 Focus on recovery today'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};