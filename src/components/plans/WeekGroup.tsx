import React from 'react';
import { ChevronDown, CheckCircle2, MapPin, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { Workout, WeeklyStats } from '../../types';
import { formatDistance, formatDuration } from '../../utils/formatters';
import { StatsSummary } from '../dashboard/StatsSummary';
import { UserStreak } from '../../services/streakService';

interface WeekGroupProps {
  weekNumber: number;
  status: 'completed' | 'current' | 'upcoming';
  dateRange: { start: Date; end: Date };
  workouts: Workout[];
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  weeklyStats?: WeeklyStats | null;
  streak?: UserStreak | null;
}

export const WeekGroup: React.FC<WeekGroupProps> = ({
  weekNumber,
  status,
  dateRange,
  workouts,
  isOpen,
  onToggle,
  children,
  weeklyStats,
  streak
}) => {
  const completedCount = workouts.filter(w => w.completed).length;
  const totalWorkouts = workouts.length;
  const totalDistance = workouts.reduce((sum, w) => sum + (w.distance || 0), 0);
  const totalDuration = workouts.reduce((sum, w) => sum + w.duration, 0);

  // Determine border/bg colors based on status
  const getStatusStyles = () => {
    switch (status) {
      case 'current':
        return 'border-orange-500/50 bg-slate-900/80 shadow-lg shadow-orange-900/10';
      case 'completed':
        return 'border-slate-800 bg-slate-900/40 opacity-75';
      case 'upcoming':
        return 'border-slate-800 bg-slate-900/40';
      default:
        return 'border-slate-800 bg-slate-900/40';
    }
  };

  return (
    <div 
      id={`week-${weekNumber}`}
      className={`rounded-xl border transition-all duration-300 overflow-hidden ${getStatusStyles()}`}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors text-left"
      >
        <div className="flex items-center gap-4">
          <div className={`p-2 rounded-lg ${status === 'current' ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-800 text-slate-400'}`}>
            <span className="font-bold text-sm">W{weekNumber}</span>
          </div>
          
          <div>
            <h3 className={`font-semibold ${status === 'current' ? 'text-white' : 'text-slate-300'}`}>
              {status === 'current' ? 'Current Week' : format(dateRange.start, 'MMM d') + ' - ' + format(dateRange.end, 'MMM d')}
            </h3>
            <p className="text-xs text-slate-500">
              {totalWorkouts} Workouts • {formatDuration(totalDuration)}
            </p>
          </div>
        </div>

        {/* Collapsed Summary Stats (Only visible when collapsed or not current) */}
        {!isOpen && (
          <div className="flex items-center gap-4 text-sm text-slate-400">
            <div className="hidden sm:flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4 ml-1" />
              <span>{completedCount}/{totalWorkouts}</span>
            </div>
            <div className="hidden sm:flex items-center gap-1">
              <MapPin className="w-4 h-4 ml-1" />
              <span>{formatDistance(totalDistance)}</span>
            </div>
             <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
          </div>
        )}
         {isOpen && (
             <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
         )}

      </button>

      {/* Expandable Content */}
      <div 
        className={`transition-all duration-500 ease-in-out ${isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <div className="p-4 border-t border-white/5">
          
          {/* Current Week Enhanced Stats Header */}
          {status === 'current' && weeklyStats && (
            <div className="mb-6 bg-slate-800/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3 text-orange-400">
                <Clock className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">This Week's Progress</span>
              </div>
              <StatsSummary weeklyStats={weeklyStats} streak={streak} />
            </div>
          )}

          {children}
        </div>
      </div>
    </div>
  );
};
