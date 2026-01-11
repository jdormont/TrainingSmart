import React from 'react';
import { Moon, Battery, Heart, Activity, Wind, TrendingUp, TrendingDown } from 'lucide-react';
import type { OuraSleepData, OuraReadinessData, DailyMetric } from '../../types';
import { calculateSleepScore } from '../../utils/sleepScoreCalculator';
import { dailyMetricsService } from '../../services/dailyMetricsService';
import { useAuth } from '../../contexts/AuthContext';

interface RecoveryCardProps {
  sleepData: OuraSleepData | null;
  readinessData: OuraReadinessData | null;
  dailyMetric: DailyMetric | null;
  loading?: boolean;
}

const CircularProgress: React.FC<{ score: number; size?: number; strokeWidth?: number; label: string }> = ({
  score,
  size = 180,
  strokeWidth = 12,
  label
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (score / 100) * circumference;

  // Color logic
  let colorClass = 'text-red-500';
  let bgClass = 'text-red-900/20';
  if (score >= 80) {
    colorClass = 'text-green-500';
    bgClass = 'text-green-900/20';
  } else if (score >= 50) {
    colorClass = 'text-yellow-500';
    bgClass = 'text-yellow-900/20';
  }

  return (
    <div className="relative flex flex-col items-center justify-center" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90 w-full h-full">
        <circle
          className={bgClass}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          className={`${colorClass} transition-all duration-1000 ease-out`}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className={`text-5xl font-bold ${colorClass.replace('text-', 'text-')}`}>
          {Math.round(score)}
        </span>
        <span className="text-sm text-slate-500 font-medium mt-1">{label}</span>
      </div>
    </div>
  );
};

export const RecoveryCard: React.FC<RecoveryCardProps> = ({
  sleepData,
  readinessData,
  dailyMetric,
  loading = false
}) => {
  const { userProfile } = useAuth();

  if (loading) {
    return (
      <div className="bg-slate-900 rounded-2xl shadow-sm border border-slate-800 p-6 h-full min-h-[300px] animate-pulse">
        <div className="flex flex-col md:flex-row gap-6 h-full">
          <div className="w-full md:w-1/3 bg-slate-800 rounded-xl h-48 md:h-auto"></div>
          <div className="w-full md:w-2/3 grid grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-slate-800 rounded-xl h-24"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!sleepData && !readinessData && !dailyMetric) {
    return (
      <div className="bg-slate-900 rounded-2xl shadow-sm border border-slate-800 p-6">
        <div className="text-center text-slate-500 py-12">
          <Moon className="w-12 h-12 mx-auto mb-3 text-slate-600" />
          <p className="text-base font-medium">No recovery data available</p>
          <p className="text-sm mt-1">Connect your Oura Ring or sync health data.</p>
        </div>
      </div>
    );
  }

  // --- Data preparation ---
  const hasOuraData = !!(sleepData || readinessData);
  const usingDailyMetrics = !hasOuraData && !!dailyMetric;

  // Sleep Score
  const sleepScoreObj = sleepData ? calculateSleepScore(sleepData) : null;
  const demographic = userProfile?.gender || userProfile?.age_bucket ? {
    gender: userProfile.gender,
    ageBucket: userProfile.age_bucket
  } : undefined;
  const individualScores = dailyMetric ? dailyMetricsService.calculateIndividualScores(dailyMetric, demographic) : null;

  const sleepVal = sleepScoreObj ? sleepScoreObj.totalScore : (individualScores?.sleepScore ?? 0);
  const sleepDuration = sleepData ? sleepData.total_sleep_duration : (dailyMetric?.sleep_minutes ? dailyMetric.sleep_minutes * 60 : 0);

  // HRV & RHR
  const hrvVal = sleepData?.average_hrv ?? dailyMetric?.hrv ?? 0;
  const rhrVal = sleepData?.lowest_heart_rate ?? dailyMetric?.resting_hr ?? 0;

  const hrvScore = individualScores?.hrvScore ?? 0;
  const rhrScore = individualScores?.rhrScore ?? 0;

  // Overall Score
  let overallScore = 0;
  let statusText = "Recovery Needed"; // Default low

  if (readinessData) {
    overallScore = readinessData.score;
  } else if (usingDailyMetrics) {
    // Calculate locally
    const scores: number[] = [];
    if (individualScores?.sleepScore) scores.push(individualScores.sleepScore);
    if (individualScores?.hrvScore) scores.push(individualScores.hrvScore);
    if (individualScores?.rhrScore) scores.push(individualScores.rhrScore);
    if (scores.length > 0) {
      overallScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    }
  }

  // Status Text Logic - Updated thresholds
  if (overallScore >= 80) statusText = "Prime State";
  else if (overallScore >= 50) statusText = "Strained / Normal";
  else statusText = "Recovery Needed";

  // Gradient / Background logic based on Overall Score for the Hero Card
  let heroBg = "bg-red-500/10";
  if (overallScore >= 80) heroBg = "bg-green-500/10";
  else if (overallScore >= 50) heroBg = "bg-yellow-500/10";

  // Helper formatting
  const formatDuration = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return `${h}h ${m}m`;
  };

  // Helper for metric card colors
  const getMetricCardClass = (score: number) => {
    if (score >= 80) return "bg-green-500/10 border-green-500/20";
    if (score >= 50) return "bg-yellow-500/10 border-yellow-500/20";
    return "bg-red-500/10 border-red-500/20";
  };

  const getMetricIconClass = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 50) return "text-yellow-500";
    return "text-red-500";
  };

  return (
    <div className="bg-slate-900 rounded-3xl shadow-lg shadow-black/20 border border-slate-800 overflow-hidden">
      <div className="p-6">
        <h3 className="font-bold text-lg text-slate-50 mb-6 flex items-center">
          Recovery & Sleep
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* LEFT COL: HERO - Overall Recovery */}
          <div className={`col-span-1 rounded-2xl ${heroBg} p-8 flex flex-col items-center justify-center text-center relative min-h-[300px] border border-white/5`}>

            <CircularProgress
              score={overallScore}
              label="Overall Recovery"
            />

            {/* Moved subLabel outside of CircularProgress to avoid overlap */}
            <div className="mt-6 text-sm font-semibold text-slate-300 uppercase tracking-wide">
              {statusText}
            </div>

          </div>

          {/* RIGHT COL: METRICS GRID */}
          <div className="col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Sleep Card */}
            <div className={`rounded-xl p-5 flex flex-col justify-between border ${getMetricCardClass(sleepVal)}`}>
              <div className="flex items-center gap-2 mb-2">
                <Moon className={`w-5 h-5 ${getMetricIconClass(sleepVal)}`} />
                <span className="text-sm font-medium text-slate-400">Sleep Score</span>
              </div>
              <div>
                <div className="text-3xl font-bold text-slate-50">{sleepVal || '--'}</div>
                <div className="text-sm text-slate-500 mt-1">{formatDuration(sleepDuration)}</div>
              </div>
            </div>

            {/* HRV Card */}
            <div className={`rounded-xl p-5 flex flex-col justify-between border ${getMetricCardClass(hrvScore)}`}>
              <div className="flex items-center gap-2 mb-2">
                <Activity className={`w-5 h-5 ${getMetricIconClass(hrvScore)}`} />
                <span className="text-sm font-medium text-slate-400">HRV Score</span>
              </div>
              <div>
                <div className="text-3xl font-bold text-slate-50">{Math.round(hrvScore) || '--'}</div>
                <div className="text-sm text-slate-500 mt-1">{Math.round(hrvVal)} ms</div>
              </div>
            </div>

            {/* RHR Card */}
            <div className={`rounded-xl p-5 flex flex-col justify-between border ${getMetricCardClass(rhrScore)}`}>
              <div className="flex items-center gap-2 mb-2">
                <Heart className={`w-5 h-5 ${getMetricIconClass(rhrScore)}`} />
                <span className="text-sm font-medium text-slate-400">RHR Score</span>
              </div>
              <div>
                <div className="text-3xl font-bold text-slate-50">
                  {rhrScore || '--'}
                </div>
                <div className="text-sm text-slate-500 mt-1">{Math.round(rhrVal)} bpm</div>
              </div>
            </div>

            {/* Respiratory Rate Card */}
            <div className="bg-cyan-900/10 border border-cyan-500/20 rounded-xl p-5 flex flex-col justify-between">
              <div className="flex items-center gap-2 mb-2">
                <Wind className="w-5 h-5 text-cyan-500" />
                <span className="text-sm font-medium text-slate-400">Respiratory Rate</span>
              </div>
              <div>
                <div className="text-3xl font-bold text-slate-50">
                  {dailyMetric?.respiratory_rate ?? '--'}
                </div>
                <div className="text-sm text-slate-500 mt-1">br/min</div>

                {dailyMetric?.respiratory_rate && (
                  <div className="w-full bg-cyan-900/30 rounded-full h-1.5 mt-3 overflow-hidden">
                    <div className="bg-cyan-500 h-1.5 rounded-full" style={{ width: '60%' }}></div>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Footer Text */}
        <div className="mt-8 text-xs text-slate-500 text-center border-t border-slate-800 pt-4">
          Recovery efficiency is calculated as a weighted balance of HRV (50%), RHR (30%), and Sleep (20%) normalized against your 30-day baseline.
        </div>
      </div>
    </div>
  );
};