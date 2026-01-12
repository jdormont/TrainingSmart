import React from 'react';
import { ChevronDown, Info, Target, TrendingUp } from 'lucide-react';
import type { LevelDetail } from '../../services/healthMetricsService';

interface SkillCardProps {
  subject: string;
  metricData: LevelDetail; // Contains level, currentValue, nextLevelCriteria, prompt
  tier: { name: string; color: string };
  isExpanded: boolean;
  onToggle: () => void;
}

export const SkillCard: React.FC<SkillCardProps> = ({ 
  subject, 
  metricData, 
  tier, 
  isExpanded, 
  onToggle 
}) => {
  // Calculate progress bar width (rough approximation based on level)
  // Level 1 = 10%, Level 10 = 100%.
  const progressPercent = Math.min(100, Math.max(10, metricData.level * 10));

  return (
    <div 
      className={`rounded-xl border transition-all duration-300 overflow-hidden ${
        isExpanded 
          ? 'bg-slate-900 border-slate-700 shadow-lg' 
          : 'bg-slate-950 border-slate-800/50 hover:bg-slate-900'
      }`}
      style={{
        borderColor: isExpanded ? tier.color : undefined
      }}
    >
      {/* Header (Always Visible) */}
      <button 
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-left outline-none"
      >
        <div className="flex items-center gap-3">
          {/* Level Badge */}
          <div 
            className="flex flex-col items-center justify-center w-10 h-10 rounded-lg bg-slate-900 border border-slate-800"
            style={{ borderColor: tier.color + '40' }}
          >
            <span className="text-xl font-black leading-none" style={{ color: tier.color }}>
              {metricData.level}
            </span>
          </div>

          <div>
            <h4 className="font-bold text-slate-100 text-base">{subject}</h4>
            <span 
              className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border"
              style={{ 
                color: tier.color,
                backgroundColor: tier.color + '10',
                borderColor: tier.color + '20'
              }}
            >
              {tier.name}
            </span>
          </div>
        </div>

        <ChevronDown 
          className={`w-5 h-5 text-slate-500 transition-transform duration-300 ${
            isExpanded ? 'rotate-180' : ''
          }`} 
        />
      </button>

      {/* Expanded Body */}
      <div 
        className={`transition-all duration-300 ease-in-out ${
          isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-4 pb-4 pt-0 space-y-4">
          
          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-400">
               <span>Lvl 1</span>
               <span>Lvl 9 (Pro)</span>
            </div>
            <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
               <div 
                  className="h-full rounded-full transition-all duration-1000 ease-out"
                  style={{ 
                      width: `${progressPercent}%`,
                      backgroundColor: tier.color
                  }}
               />
            </div>
          </div>

          {/* Coach Action Box */}
          <div className="bg-slate-950/80 rounded-lg p-3 border border-slate-800 relative overflow-hidden group">
             <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: tier.color }} />
             
             <div className="flex gap-3 relative z-10">
                <div className="mt-0.5 min-w-[20px]">
                   <Info className="w-5 h-5" style={{ color: tier.color }} />
                </div>
                <div>
                   <p className="text-xs font-bold uppercase text-slate-500 mb-1">Coach Action</p>
                   <p className="text-sm font-medium text-slate-200 leading-snug">
                     "{metricData.prompt}"
                   </p>
                </div>
             </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3 pt-2">
             <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-center">
                <div className="text-xs text-slate-500 mb-1 flex justify-center items-center gap-1">
                   <Target className="w-3 h-3" />
                   Current
                </div>
                <div className="font-mono font-bold text-slate-200">
                   {metricData.currentValue}
                </div>
             </div>
             <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-center">
                <div className="text-xs text-slate-500 mb-1 flex justify-center items-center gap-1">
                   <TrendingUp className="w-3 h-3" />
                   Next Lvl
                </div>
                <div className="font-mono font-bold text-slate-200">
                   {metricData.nextLevelCriteria}
                </div>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
};
