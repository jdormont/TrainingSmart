import React from 'react';
import { Activity, Flame, Clock, Footprints } from 'lucide-react';
import type { DailyMetric } from '../../types';

interface DailyActivityCardProps {
  dailyMetric: DailyMetric | null;
}

const ProgressBar = ({ value, max, colorClass, bgClass, label, icon: Icon, unit }: any) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="mb-4 last:mb-0">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-md ${bgClass}`}>
            <Icon className={`w-4 h-4 ${colorClass}`} />
          </div>
          <span className="text-sm font-medium text-slate-300">{label}</span>
        </div>
        <div className="text-sm font-bold text-slate-200">
          {value.toLocaleString()} <span className="text-xs font-normal text-slate-500">{unit}</span>
        </div>
      </div>
      <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-1000 ${colorClass.replace('text-', 'bg-')}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

export const DailyActivityCard: React.FC<DailyActivityCardProps> = ({ dailyMetric }) => {
  if (!dailyMetric) return null;

  const hasActivityData = 
    (dailyMetric.active_calories != null) || 
    (dailyMetric.exercise_minutes != null) || 
    (dailyMetric.stand_hours != null) || 
    (dailyMetric.daily_steps != null);

  if (!hasActivityData) return null;

  // Defaults if some missing
  const calories = dailyMetric.active_calories || 0;
  const exercise = dailyMetric.exercise_minutes || 0;
  const stand = dailyMetric.stand_hours || 0;
  const steps = dailyMetric.daily_steps || 0;

  // Targets (could be moved to user profile later)
  const targetCalories = 600;
  const targetExercise = 30;
  const targetStand = 12;
  const targetSteps = 10000;

  return (
    <div className="bg-slate-900 rounded-3xl shadow-xl shadow-black/40 border border-slate-800 p-6 flex flex-col h-full">
      <div className="flex items-center gap-2 mb-6">
        <Activity className="w-5 h-5 text-sky-400" />
        <h3 className="text-lg font-bold text-slate-200">Daily Activity</h3>
      </div>

      <div className="flex-1 flex flex-col justify-center gap-2">
        {dailyMetric.active_calories != null && (
          <ProgressBar 
            value={calories} 
            max={targetCalories} 
            colorClass="text-red-500" 
            bgClass="bg-red-900/20" 
            label="Move" 
            icon={Flame} 
            unit="kcal" 
          />
        )}
        
        {dailyMetric.exercise_minutes != null && (
          <ProgressBar 
            value={exercise} 
            max={targetExercise} 
            colorClass="text-green-500" 
            bgClass="bg-green-900/20" 
            label="Exercise" 
            icon={Clock} 
            unit="min" 
          />
        )}
        
        {dailyMetric.stand_hours != null && (
          <ProgressBar 
            value={stand} 
            max={targetStand} 
            colorClass="text-blue-500" 
            bgClass="bg-blue-900/20" 
            label="Stand" 
            icon={Activity} 
            unit="hrs" 
          />
        )}

        {dailyMetric.daily_steps != null && (
          <div className="mt-2 pt-4 border-t border-slate-800/50">
            <ProgressBar 
              value={steps} 
              max={targetSteps} 
              colorClass="text-amber-500" 
              bgClass="bg-amber-900/20" 
              label="Steps" 
              icon={Footprints} 
              unit="steps" 
            />
          </div>
        )}
      </div>
    </div>
  );
};
