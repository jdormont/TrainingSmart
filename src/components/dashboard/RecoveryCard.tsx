import React from 'react';
import { Moon, Battery, Heart, Thermometer, Activity, TrendingUp, TrendingDown } from 'lucide-react';
import type { OuraSleepData, OuraReadinessData, DailyMetric } from '../../types';
import { calculateSleepScore, getSleepScoreColor, getSleepScoreBgColor } from '../../utils/sleepScoreCalculator';
import { dailyMetricsService } from '../../services/dailyMetricsService';
import { useAuth } from '../../contexts/AuthContext';

interface RecoveryCardProps {
  sleepData: OuraSleepData | null;
  readinessData: OuraReadinessData | null;
  dailyMetric: DailyMetric | null;
  loading?: boolean;
}

export const RecoveryCard: React.FC<RecoveryCardProps> = ({
  sleepData,
  readinessData,
  dailyMetric,
  loading = false
}) => {
  const { userProfile } = useAuth();

  // Debug logging for data received
  console.log('=== RECOVERY CARD DEBUG ===');
  console.log('Sleep data received:', sleepData);
  console.log('Readiness data received:', readinessData);
  console.log('Daily metric received:', dailyMetric);
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

  if (!sleepData && !readinessData && !dailyMetric) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center text-gray-500">
          <Moon className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No recovery data available</p>
          <p className="text-xs">Connect your Oura Ring or sync health data to see recovery metrics</p>
        </div>
      </div>
    );
  }

  const hasOuraData = sleepData || readinessData;
  const usingDailyMetrics = !hasOuraData && dailyMetric;

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

  const demographic = userProfile?.gender || userProfile?.age_bucket ? {
    gender: userProfile.gender,
    ageBucket: userProfile.age_bucket
  } : undefined;

  const individualScores = dailyMetric ? dailyMetricsService.calculateIndividualScores(dailyMetric, demographic) : null;

  const displayRecoveryScore = dailyMetric ? (() => {
    if (dailyMetric.recovery_score > 0) {
      return dailyMetric.recovery_score;
    }

    const scores: number[] = [];
    if (individualScores?.sleepScore !== null) scores.push(individualScores.sleepScore!);
    if (individualScores?.hrvScore !== null) scores.push(individualScores.hrvScore!);
    if (individualScores?.rhrScore !== null) scores.push(individualScores.rhrScore!);

    if (scores.length === 0) return 0;

    const sum = scores.reduce((acc, score) => acc + score, 0);
    return Math.round(sum / scores.length);
  })() : 0;

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
        {usingDailyMetrics && dailyMetric && (
          <span className="text-xs text-gray-500">
            {new Date(dailyMetric.date).toLocaleDateString()}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Sleep Score - Oura or Daily Metrics */}
        {sleepData ? (
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
        ) : usingDailyMetrics && individualScores?.sleepScore !== null ? (
          <div className={`text-center p-3 rounded-lg ${getScoreBgColor(individualScores.sleepScore!)}`}>
            <div className="flex items-center justify-center mb-1">
              <Moon className="w-4 h-4 mr-1 text-purple-600" />
            </div>
            <div className={`text-2xl font-bold ${getScoreColor(individualScores.sleepScore!)}`}>
              {individualScores.sleepScore}
            </div>
            <div className="text-xs text-gray-600">Sleep Score</div>
            <div className="text-xs text-gray-500">{Math.round(dailyMetric!.sleep_minutes / 60)}h {dailyMetric!.sleep_minutes % 60}m</div>
          </div>
        ) : null}

        {/* Recovery Score - Daily Metrics or Readiness - Oura */}
        {readinessData ? (
          <div className={`text-center p-3 rounded-lg ${getScoreBgColor(readinessData.score)}`}>
            <div className="flex items-center justify-center mb-1">
              <Battery className="w-4 h-4 mr-1 text-green-600" />
            </div>
            <div className={`text-2xl font-bold ${getScoreColor(readinessData.score)}`}>
              {safeNumber(readinessData.score)}
            </div>
            <div className="text-xs text-gray-600">Readiness</div>
          </div>
        ) : usingDailyMetrics ? (
          <div className={`text-center p-3 rounded-lg ${getScoreBgColor(displayRecoveryScore)}`}>
            <div className="flex items-center justify-center mb-1">
              <Battery className="w-4 h-4 mr-1 text-green-600" />
            </div>
            <div className={`text-2xl font-bold ${getScoreColor(displayRecoveryScore)}`}>
              {displayRecoveryScore}
            </div>
            <div className="text-xs text-gray-600">Recovery</div>
            <div className="text-xs text-gray-500">Calculated</div>
          </div>
        ) : null}

        {/* HRV Score - Daily Metrics */}
        {usingDailyMetrics && individualScores?.hrvScore !== null && (
          <div className={`text-center p-3 rounded-lg ${getScoreBgColor(individualScores.hrvScore!)}`}>
            <div className="flex items-center justify-center mb-1">
              <Activity className="w-4 h-4 mr-1 text-blue-600" />
            </div>
            <div className={`text-2xl font-bold ${getScoreColor(individualScores.hrvScore!)}`}>
              {individualScores.hrvScore}
            </div>
            <div className="text-xs text-gray-600">HRV Score</div>
            <div className="text-xs text-gray-500">{dailyMetric!.hrv}ms</div>
          </div>
        )}

        {/* Sleep Duration or Resting HR */}
        {sleepData ? (
          <div className="text-center p-3 rounded-lg bg-blue-50">
            <div className="flex items-center justify-center mb-1">
              <Activity className="w-4 h-4 mr-1 text-blue-600" />
            </div>
            <div className="text-lg font-bold text-gray-900">
              {safeDuration(sleepData.total_sleep_duration)}
            </div>
            <div className="text-xs text-gray-600">Sleep Time</div>
          </div>
        ) : usingDailyMetrics && individualScores?.rhrScore !== null ? (
          <div className={`text-center p-3 rounded-lg ${getScoreBgColor(individualScores.rhrScore!)}`}>
            <div className="flex items-center justify-center mb-1">
              <Heart className="w-4 h-4 mr-1 text-red-600" />
            </div>
            <div className={`text-2xl font-bold ${getScoreColor(individualScores.rhrScore!)}`}>
              {individualScores.rhrScore}
            </div>
            <div className="text-xs text-gray-600">RHR Score</div>
            <div className="text-xs text-gray-500">{dailyMetric!.resting_hr} bpm</div>
          </div>
        ) : null}

        {/* Resting Heart Rate - Oura only */}
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