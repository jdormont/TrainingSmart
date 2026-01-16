import React from 'react';
import { Moon, Heart, Activity, Wind, Database } from 'lucide-react';
import type { OuraSleepData, OuraReadinessData, DailyMetric } from '../../types';
import { calculateSleepScore } from '../../utils/sleepScoreCalculator';
import { dailyMetricsService } from '../../services/dailyMetricsService';
import { useAuth } from '../../contexts/AuthContext';
import { format, parseISO, isToday, isYesterday } from 'date-fns';

interface RecoveryCardProps {
  sleepData: OuraSleepData | null;
  readinessData: OuraReadinessData | null;
  dailyMetric: DailyMetric | null;
  loading?: boolean;
}

// Simple Oura Icon Component (Ring shape)
const OuraIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} title="Source: Oura">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
    <path d="M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z" opacity="0.5"/>
  </svg>
);

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
  const usingDailyMetrics = !hasOuraData && !!dailyMetric; // Could be Manual or Apple Health via CSV upload

  // Determine Data Date Label
  let dateLabel = "";
  let dataDateString = "";
  
  if (sleepData?.day) dataDateString = sleepData.day;
  else if (readinessData?.day) dataDateString = readinessData.day;
  else if (dailyMetric?.date) dataDateString = dailyMetric.date;

  if (dataDateString) {
    const d = parseISO(dataDateString);
    if (isToday(d)) dateLabel = "Today";
    else if (isYesterday(d)) dateLabel = "Yesterday";
    else dateLabel = format(d, 'MMM d');
  }

  // Sleep Score
  const sleepScoreObj = sleepData ? calculateSleepScore(sleepData) : null;
  const demographic = userProfile?.gender || userProfile?.age_bucket ? {
    gender: userProfile.gender,
    ageBucket: userProfile.age_bucket
  } : undefined;
  const individualScores = dailyMetric ? dailyMetricsService.calculateIndividualScores(dailyMetric, demographic) : null;

  const sleepScore = sleepScoreObj ? sleepScoreObj.totalScore : (individualScores?.sleepScore ?? 0);
  const sleepDuration = sleepData ? sleepData.total_sleep_duration : (dailyMetric?.sleep_minutes ? dailyMetric.sleep_minutes * 60 : 0);

  // HRV & RHR
  // Priority: Oura Data -> Daily Metric -> 0
  const hrvVal = sleepData?.average_hrv ?? dailyMetric?.hrv ?? 0;
  const rhrVal = sleepData?.lowest_heart_rate ?? dailyMetric?.resting_hr ?? 0;
  // Use Oura 'average_breath' if available, otherwise dailyMetric
  const respVal = sleepData?.average_breath ?? dailyMetric?.respiratory_rate ?? 0;

  const hrvScore = individualScores?.hrvScore ?? 0;
  const rhrScore = individualScores?.rhrScore ?? 0;
  // Don't have a specific score for Resp Rate usually, could derive or just hide score.

  // Overall Score
  let overallScore = 0;
  let statusText = "Recovery Needed"; // Default low

  if (readinessData) {
    overallScore = readinessData.score;
  } else if (usingDailyMetrics) {
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
    // If we have no score (e.g. respiratory), default to neutral
    if (score === 0 && !usingDailyMetrics) return "bg-slate-800/50 border-slate-700"; 
    
    if (score >= 80) return "bg-green-500/10 border-green-500/20";
    if (score >= 50) return "bg-yellow-500/10 border-yellow-500/20";
    return "bg-red-500/10 border-red-500/20";
  };

  const getMetricIconClass = (score: number) => {
    if (score === 0 && !usingDailyMetrics) return "text-slate-400";
    if (score >= 80) return "text-green-500";
    if (score >= 50) return "text-yellow-500";
    return "text-red-500";
  };

  // Source Icon Helper
  const SourceIcon = ({ isOura }: { isOura: boolean }) => {
    if (isOura) return <OuraIcon className="w-3 h-3 text-slate-400 opacity-70" />;
    return <Database className="w-3 h-3 text-slate-500 opacity-50" title="Source: Database" />;
  };

  return (
    <div className="bg-slate-900 rounded-3xl shadow-lg shadow-black/20 border border-slate-800 overflow-hidden">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-lg text-slate-50 flex items-center gap-2">
            Recovery & Sleep
            {hasOuraData && <span className="bg-slate-800 text-slate-300 text-[10px] px-2 py-0.5 rounded-full border border-slate-700 font-medium flex items-center gap-1"><OuraIcon className="w-3 h-3"/> Oura Synced</span>}
          </h3>
          {dateLabel && (
             <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${
               dateLabel === 'Today' 
                ? 'bg-green-500/10 text-green-500 border-green-500/20' 
                : dateLabel === 'Yesterday'
                  ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
             }`}>
               {dateLabel}
             </span>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* LEFT COL: HERO - Overall Recovery */}
          <div className={`col-span-1 rounded-2xl ${heroBg} p-8 flex flex-col items-center justify-center text-center relative min-h-[300px] border border-white/5`}>
            <CircularProgress
              score={overallScore}
              label="Overall Recovery"
            />
            <div className="mt-6 text-sm font-semibold text-slate-300 uppercase tracking-wide">
              {statusText}
            </div>
          </div>

          {/* RIGHT COL: METRICS GRID */}
          <div className="col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Sleep Card */}
            <div className={`rounded-xl p-5 flex flex-col justify-between border ${getMetricCardClass(sleepScore)}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Moon className={`w-5 h-5 ${getMetricIconClass(sleepScore)}`} />
                  <span className="text-sm font-medium text-slate-400">Sleep</span>
                </div>
                <SourceIcon isOura={!!sleepData} />
              </div>
              <div>
                <div className="text-3xl font-bold text-slate-50">{formatDuration(sleepDuration)}</div>
                <div className="text-sm text-slate-500 mt-1">Score: {Math.round(sleepScore)}</div>
              </div>
            </div>

            {/* HRV Card */}
            <div className={`rounded-xl p-5 flex flex-col justify-between border ${getMetricCardClass(hrvScore)}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Activity className={`w-5 h-5 ${getMetricIconClass(hrvScore)}`} />
                  <span className="text-sm font-medium text-slate-400">HRV (Avg)</span>
                </div>
                <SourceIcon isOura={!!sleepData} />
              </div>
              <div>
                <div className="text-3xl font-bold text-slate-50">{Math.round(hrvVal)} ms</div>
                <div className="text-sm text-slate-500 mt-1">Score: {Math.round(hrvScore)}</div>
              </div>
            </div>

            {/* RHR Card */}
            <div className={`rounded-xl p-5 flex flex-col justify-between border ${getMetricCardClass(rhrScore)}`}>
              <div className="flex items-center justify-between mb-2">
                 <div className="flex items-center gap-2">
                  <Heart className={`w-5 h-5 ${getMetricIconClass(rhrScore)}`} />
                  <span className="text-sm font-medium text-slate-400">Resting HR</span>
                </div>
                <SourceIcon isOura={!!sleepData} />
              </div>
              <div>
                <div className="text-3xl font-bold text-slate-50">{Math.round(rhrVal)} bpm</div>
                <div className="text-sm text-slate-500 mt-1">Score: {rhrScore}</div>
              </div>
            </div>

            {/* Respiratory Rate Card */}
            {/* Logic: If Oura data exists, card is green/neutral. If manual, blue. */}
            <div className={`rounded-xl p-5 flex flex-col justify-between border border-cyan-500/20 bg-cyan-900/10`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Wind className="w-5 h-5 text-cyan-500" />
                  <span className="text-sm font-medium text-slate-400">Resp. Rate</span>
                </div>
                <SourceIcon isOura={!!sleepData?.average_breath} />
              </div>
              <div>
                 <div className="text-3xl font-bold text-slate-50">
                  {respVal ? respVal.toFixed(1) : '--'}
                </div>
                <div className="text-sm text-slate-500 mt-1">br/min</div>
                
                {respVal > 0 && (
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