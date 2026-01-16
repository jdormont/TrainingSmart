import React from 'react';
import { Moon, Heart, Activity, Wind, AlertCircle, CheckCircle2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { OuraSleepData, OuraReadinessData, DailyMetric } from '../../types';
import { healthMetricsService } from '../../services/healthMetricsService';
import { parseISO, isToday, isYesterday, format } from 'date-fns';


interface RecoveryCardProps {
  sleepData: OuraSleepData | null;
  sleepHistory: OuraSleepData[];
  readinessData: OuraReadinessData | null;
  dailyMetric: DailyMetric | null;
  loading?: boolean;
}

// Reuse OuraIcon
const OuraIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} title="Source: Oura">
     <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
     <path d="M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z" opacity="0.5"/>
  </svg>
);

const CircularProgress: React.FC<{ score: number; size?: number; strokeWidth?: number; label: string }> = ({
  score,
  size = 140,
  strokeWidth = 10,
  label
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (score / 100) * circumference;

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
    <div className="flex flex-col items-center">
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
                <span className={`text-4xl font-bold ${colorClass.replace('text-', 'text-')}`}>
                {Math.round(score)}
                </span>
                <span className="text-xs text-slate-400 font-medium uppercase mt-1 tracking-wider">{label}</span>
            </div>
        </div>
    </div>
  );
};

export const RecoveryCard: React.FC<RecoveryCardProps> = ({
  sleepData,
  sleepHistory,
  dailyMetric,
  loading = false
}) => {
  if (loading) {
    return (
      <div className="bg-slate-900 rounded-3xl shadow-lg border border-slate-800 p-6 h-full min-h-[480px] animate-pulse">
        <div className="h-40 bg-slate-800 rounded-xl mb-6"></div>
        <div className="h-24 bg-slate-800 rounded-xl mb-6"></div>
        <div className="grid grid-cols-2 gap-4">
             <div className="h-24 bg-slate-800 rounded-xl"></div>
             <div className="h-24 bg-slate-800 rounded-xl"></div>
             <div className="h-24 bg-slate-800 rounded-xl"></div>
             <div className="h-24 bg-slate-800 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (!sleepData && !dailyMetric) {
    return (
      <div className="bg-slate-900 rounded-3xl shadow-lg border border-slate-800 p-8 flex flex-col items-center justify-center h-full min-h-[400px] text-center">
        <div className="bg-slate-800/50 p-4 rounded-full mb-4">
            <Moon className="w-8 h-8 text-slate-500" />
        </div>
        <h3 className="text-xl font-bold text-slate-200 mb-2">No Data Available</h3>
        <p className="text-slate-400 max-w-xs mx-auto">
            Connect your Oura Ring or ensure your health data is syncing to see your recovery dashboard.
        </p>
      </div>
    );
  }

  // Calculate Metrics
  let biologicalReadiness = null;
  if (sleepData) {
      biologicalReadiness = healthMetricsService.calculateBiologicalReadiness(sleepData, sleepHistory);
  }

  // Fallback for non-Oura (e.g. Manual/Apple Watch)
  const isOura = !!sleepData;
  const score = biologicalReadiness ? biologicalReadiness.score : (dailyMetric?.recovery_score || 0);
  const status = biologicalReadiness ? biologicalReadiness.status : (score >= 80 ? 'Prime' : score >= 50 ? 'Good' : 'Rest Required');
  
  // Status Message
  let statusMessage = "Recover well to perform better.";
  if (biologicalReadiness) {
      if (biologicalReadiness.details.temperature.isElevated) statusMessage = "Elevated Temp detected (+0.8°C). Focus on rest.";
      else if (biologicalReadiness.status === 'Prime') statusMessage = "CNS is primed. Green light for intensity.";
      else if (biologicalReadiness.status === 'Rest Required') statusMessage = "Biological stress detected. prioritize sleep.";
      else statusMessage = "All systems stable. Train as planned.";
  }

  // Row 2: Sleep Architecture Data
  // If we have Oura data, we have stages. Else, maybe dailyMetric has them.
  const deep = sleepData ? sleepData.deep_sleep_duration / 60 : (dailyMetric?.deep_sleep_minutes || 0); // minutes
  const rem = sleepData ? sleepData.rem_sleep_duration / 60 : (dailyMetric?.rem_sleep_minutes || 0);
  const light = sleepData ? sleepData.light_sleep_duration / 60 : (dailyMetric?.light_sleep_minutes || 0);
  const awake = sleepData ? sleepData.awake_time / 60 : ((dailyMetric?.sleep_minutes || 0) * 0.1); // Estimate if missing
  const totalSleepMin = deep + rem + light;
  const efficiency = sleepData ? sleepData.efficiency : (dailyMetric?.sleep_efficiency || 0);

  const formatMin = (m: number) => {
      const h = Math.floor(m / 60);
      const min = Math.round(m % 60);
      if (h > 0) return `${h}h ${min}m`;
      return `${min}m`;
  };

  return (
    <div className="bg-slate-900 rounded-3xl shadow-xl shadow-black/40 border border-slate-800 overflow-hidden flex flex-col h-full">
      
      {/* HEADER / ROW 1: SCORE & STATUS */}
      <div className="p-6 relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800/50">
          {/* Subtle Background Glow based on score */}
          <div className={`absolute top-0 right-0 w-64 h-64 blur-3xl rounded-full opacity-10 pointer-events-none ${
              score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-yellow-500' : 'bg-red-500' 
          }`}></div>

          <div className="flex flex-col sm:flex-row items-center gap-8 relative z-10">
              <div className="flex-shrink-0">
                <CircularProgress score={score} label="Readiness" />
              </div>
              
              <div className="flex-1 text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
                      <h2 className="text-2xl font-bold text-white tracking-tight">{status}</h2>
                      {isOura && <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[10px] text-slate-400 font-mono flex items-center gap-1"><OuraIcon className="w-3 h-3"/> SYNCED</span>}
                  </div>
                  <p className="text-slate-400 text-sm leading-relaxed mb-4 max-w-md">
                      {statusMessage}
                  </p>
                  
                  {/* Status Indicator Bar */}
                   <div className="flex items-center gap-1 h-1.5 w-full max-w-[200px] mx-auto sm:mx-0 bg-slate-800 rounded-full overflow-hidden">
                       <div className={`h-full rounded-full ${score < 50 ? 'bg-red-500 w-full' : 'bg-red-900/30 w-1/3'}`}></div>
                       <div className={`h-full rounded-full ${score >= 50 && score < 80 ? 'bg-yellow-500 w-full' : 'bg-yellow-900/30 w-1/3'}`}></div>
                       <div className={`h-full rounded-full ${score >= 80 ? 'bg-green-500 w-full' : 'bg-green-900/30 w-1/3'}`}></div>
                   </div>
                   <div className="flex justify-between w-full max-w-[200px] mx-auto sm:mx-0 mt-1 text-[10px] text-slate-600 font-medium uppercase">
                       <span>Rest</span>
                       <span>Steady</span>
                       <span>Push</span>
                   </div>
              </div>
          </div>
      </div>

      <div className="h-px bg-slate-800 w-full"></div>

      {/* ROW 2: SLEEP ARCHITECTURE */}
      <div className="p-6">
          <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                 <Moon className="w-4 h-4 text-purple-400" />
                 <span className="text-sm font-semibold text-slate-300">Sleep Architecture</span>
              </div>
              <div className="text-xs text-slate-500 font-mono bg-slate-800 px-2 py-1 rounded">
                  EFFICIENCY: <span className={efficiency >= 85 ? 'text-green-400' : 'text-slate-300'}>{efficiency}%</span>
              </div>
          </div>

          <div className="h-32 w-full bg-slate-800/30 rounded-lg p-2 border border-slate-800/50 flex flex-col justify-center">
               {/* Custom Legend/Labels on top of bars? No, simpler to just have legend below */}
               <div className="flex h-12 w-full rounded-md overflow-hidden mb-2">
                   {/* Deep */}
                   <div style={{ width: `${(deep / (totalSleepMin + awake)) * 100}%` }} className="bg-indigo-500 h-full relative group">
                        <div className="absolute inset-0 bg-indigo-400 opacity-0 group-hover:opacity-10 transition-opacity"></div>
                   </div>
                   {/* REM */}
                   <div style={{ width: `${(rem / (totalSleepMin + awake)) * 100}%` }} className="bg-sky-400 h-full relative group">
                        <div className="absolute inset-0 bg-sky-300 opacity-0 group-hover:opacity-10 transition-opacity"></div>
                   </div>
                   {/* Light */}
                   <div style={{ width: `${(light / (totalSleepMin + awake)) * 100}%` }} className="bg-slate-400 h-full relative group">
                        <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity"></div>
                   </div>
                   {/* Awake */}
                   <div style={{ width: `${(awake / (totalSleepMin + awake)) * 100}%` }} className="bg-orange-400/80 h-full relative group">
                        <div className="absolute inset-0 bg-orange-300 opacity-0 group-hover:opacity-10 transition-opacity"></div>
                   </div>
               </div>

               {/* Legend / Metrics */}
               <div className="flex justify-between text-xs px-1">
                   <div className="text-indigo-400 font-medium">Deep <span className="text-slate-500 ml-1">{formatMin(deep)}</span></div>
                   <div className="text-sky-400 font-medium">REM <span className="text-slate-500 ml-1">{formatMin(rem)}</span></div>
                   <div className="text-slate-400 font-medium">Light <span className="text-slate-500 ml-1">{formatMin(light)}</span></div>
                   <div className="text-orange-400 font-medium">Awake <span className="text-slate-500 ml-1">{formatMin(awake)}</span></div>
               </div>
          </div>
      </div>

       <div className="h-px bg-slate-800 w-full"></div>

      {/* ROW 3: BIOMETRICS GRID */}
      <div className="p-6 bg-slate-800/20 flex-1">
           <div className="grid grid-cols-2 gap-4">
               {/* 1. HRV */}
                {/* 1. HRV */}
               <BiometricCell 
                  label="HRV" 
                  value={
                    (biologicalReadiness?.details.hrv.value || dailyMetric?.hrv) 
                      ? `${Math.round(biologicalReadiness?.details.hrv.value || dailyMetric?.hrv || 0)}`
                      : '--'
                  }
                  unit="ms"
                  trend={biologicalReadiness?.details.hrv.trend}
                  status={getScoreColor((biologicalReadiness?.breakdown.hrvScore || 0))}
                  icon={Activity}
               />
               
               {/* 2. RHR */}
               <BiometricCell 
                  label="RHR" 
                  value={
                    (biologicalReadiness?.details.rhr.value || dailyMetric?.resting_hr)
                      ? `${Math.round(biologicalReadiness?.details.rhr.value || dailyMetric?.resting_hr || 0)}`
                      : '--'
                  }
                  unit="bpm"
                  // For RHR, "trend up" is technically bad if we just look at raw values, but the service handles "status". 
                  // Trend arrow logic: Service says 'up' if current > baseline.
                  // Visually: Up arrow for RHR is usually bad (red).
                  trend={biologicalReadiness?.details.rhr.trend} 
                  inverseTrend // Up is bad
                  status={getScoreColor((biologicalReadiness?.breakdown.rhrScore || 0))}
                  icon={Heart}
               />

               {/* 3. Temperature */}
               <BiometricCell 
                  label="Body Temp" 
                  value={(() => {
                    const temp = biologicalReadiness?.details.temperature.value ?? dailyMetric?.temperature_deviation;
                    if (temp === undefined || temp === null) return '--';
                    return `${temp > 0 ? '+' : ''}${temp.toFixed(1)}`;
                  })()}
                  unit="°C"
                  isAlert={biologicalReadiness?.details.temperature.isElevated}
                  status={biologicalReadiness?.details.temperature.isElevated ? 'red' : 'green'}
                  customIcon={biologicalReadiness?.details.temperature.isElevated ? <AlertCircle className="w-4 h-4 text-red-500"/> : <CheckCircle2 className="w-4 h-4 text-green-500"/>}
               />

               {/* 4. Respiratory Rate */}
               <BiometricCell 
                  label="Resp Rate" 
                  value={
                    (biologicalReadiness?.details.respiratory.value || dailyMetric?.respiratory_rate)
                      ? `${(biologicalReadiness?.details.respiratory.value || dailyMetric?.respiratory_rate || 0).toFixed(1)}`
                      : '--'
                  }
                  unit="/min"
                  isAlert={biologicalReadiness?.details.respiratory.isElevated}
                  status={biologicalReadiness?.details.respiratory.isElevated ? 'yellow' : 'blue'}
                  icon={Wind}
               />
           </div>
      </div>
    </div>
  );
};

// Helper Sub-Components
const BiometricCell = ({ 
    label, value, unit, trend, inverseTrend, status, icon: Icon, customIcon, isAlert 
}: { 
    label: string, value: string, unit: string, 
    trend?: 'up' | 'down' | 'stable', inverseTrend?: boolean,
    status: string, icon?: any, customIcon?: any, isAlert?: boolean 
}) => {
    
    // Status colors
    const colorMap: Record<string, string> = {
        'green': 'text-green-400 bg-green-900/10 border-green-900/30',
        'yellow': 'text-yellow-400 bg-yellow-900/10 border-yellow-900/30',
        'red': 'text-red-400 bg-red-900/10 border-red-900/30',
        'blue': 'text-sky-400 bg-sky-900/10 border-sky-900/30',
        'neutral': 'text-slate-400 bg-slate-800 border-slate-700'
    };
    const activeColor = colorMap[status] || colorMap['neutral'];

    // Trend Icon
    let TrendIcon = Minus;
    let trendColor = "text-slate-500";
    
    if (trend === 'up') {
        TrendIcon = TrendingUp;
        trendColor = inverseTrend ? "text-red-400" : "text-green-400";
    } else if (trend === 'down') {
        TrendIcon = TrendingDown;
        trendColor = inverseTrend ? "text-green-400" : "text-red-400";
    }

    return (
        <div className={`rounded-xl p-3 border border-slate-800 bg-slate-900/50 flex flex-col justify-between transition-colors hover:bg-slate-800 ${isAlert ? 'border-red-500/30 bg-red-900/5' : ''}`}>
             <div className="flex items-center justify-between mb-1">
                 <span className="text-xs font-medium text-slate-500">{label}</span>
                 {customIcon ? customIcon : (Icon && <Icon className={`w-3 h-3 ${activeColor.split(' ')[0]}`} />)}
             </div>
             <div className="flex items-end gap-2">
                 <span className="text-xl font-bold text-slate-200">{value}<span className="text-xs font-normal text-slate-500 ml-0.5">{unit}</span></span>
                 {trend && (
                     <div className={`flex items-center mb-1 ${trendColor}`}>
                        <TrendIcon className="w-3 h-3" />
                     </div>
                 )}
             </div>
        </div>
    );
}

const getScoreColor = (score: number) => {
    if (score >= 80) return 'green';
    if (score >= 50) return 'yellow';
    return 'red';
}