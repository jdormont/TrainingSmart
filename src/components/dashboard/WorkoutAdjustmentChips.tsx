import React, { useState } from 'react';
import { Battery, Timer, TrendingUp, RefreshCw, AlertTriangle, Zap } from 'lucide-react';
import { recommendationService } from '../../services/recommendationService';
import type { Workout } from '../../types';

interface WorkoutAdjustmentChipsProps {
  workout: Workout;
  onWorkoutUpdated: () => void;
  recoveryScore?: number;
}

type AdjustmentType = 'rest' | 'shorten' | 'challenge';

const ADJUSTMENTS: {
  type: AdjustmentType;
  label: string;
  Icon: React.ElementType;
  confirmLabel: string;
}[] = [
  { type: 'rest',      label: 'Need Rest',      Icon: Battery,    confirmLabel: 'Swap for Active Recovery Spin?' },
  { type: 'shorten',   label: 'Short on Time',  Icon: Timer,      confirmLabel: 'Shorten duration by 40%?' },
  { type: 'challenge', label: 'Feel Fresh',      Icon: TrendingUp, confirmLabel: 'Upgrade to a harder session?' },
];

export const WorkoutAdjustmentChips: React.FC<WorkoutAdjustmentChipsProps> = ({
  workout,
  onWorkoutUpdated,
  recoveryScore,
}) => {
  const [loading, setLoading] = useState<AdjustmentType | null>(null);
  const [pendingAction, setPendingAction] = useState<AdjustmentType | null>(null);

  const isHighIntensity = workout.intensity === 'hard' || workout.intensity === 'moderate';
  const isLowIntensity  = workout.intensity === 'easy'  || workout.intensity === 'recovery';

  const showRestNudge  = recoveryScore !== undefined && recoveryScore < 65  && isHighIntensity;
  const showPushNudge  = recoveryScore !== undefined && recoveryScore > 82  && isLowIntensity;

  const handleChipClick = (type: AdjustmentType) => {
    setPendingAction(type);
  };

  const handleConfirm = async () => {
    if (!pendingAction) return;
    const action = pendingAction;
    setPendingAction(null);
    setLoading(action);
    try {
      await recommendationService.adjustDailyWorkout(workout, action);
      onWorkoutUpdated();
    } catch (error) {
      console.error('Failed to adjust workout:', error);
    } finally {
      setLoading(null);
    }
  };

  if (workout.completed) return null;

  return (
    <div className="mt-1 space-y-2">
      {/* Readiness mismatch banners */}
      {showRestNudge && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300 leading-snug">
            Recovery at <span className="font-semibold">{recoveryScore}</span> — today's session is high intensity.
            Consider easing up.
          </p>
        </div>
      )}
      {showPushNudge && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
          <Zap className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-emerald-300 leading-snug">
            Recovery at <span className="font-semibold">{recoveryScore}</span> — you're primed for more
            today if you want it.
          </p>
        </div>
      )}

      {/* Inline confirm bar */}
      {pendingAction && (
        <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-600">
          <span className="text-xs text-slate-300 leading-snug">
            {ADJUSTMENTS.find(a => a.type === pendingAction)?.confirmLabel}
          </span>
          <div className="flex gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => setPendingAction(null)}
              className="px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="px-2.5 py-1 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-500 rounded-lg transition-colors"
            >
              Confirm
            </button>
          </div>
        </div>
      )}

      {/* Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {ADJUSTMENTS.map(({ type, label, Icon }) => {
          const isHighlighted = (type === 'rest' && showRestNudge) || (type === 'challenge' && showPushNudge);
          const isDimmed      = (type === 'challenge' && showRestNudge) || (type === 'rest' && showPushNudge);

          let chipClass = 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300';
          if (isHighlighted && type === 'rest') {
            chipClass = 'bg-amber-500/15 border-amber-500/40 text-amber-300';
          } else if (isHighlighted && type === 'challenge') {
            chipClass = 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300';
          } else if (isDimmed) {
            chipClass = 'bg-slate-800/40 border-slate-800 text-slate-600';
          }

          return (
            <button
              key={type}
              type="button"
              onClick={() => handleChipClick(type)}
              disabled={!!loading || !!pendingAction}
              className={`flex items-center px-3 py-1.5 border rounded-full text-xs font-medium transition-all whitespace-nowrap disabled:opacity-40 ${chipClass}`}
            >
              {loading === type ? (
                <RefreshCw className="w-3 h-3 mr-1.5 animate-spin" />
              ) : (
                <Icon className="w-3 h-3 mr-1.5" />
              )}
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
