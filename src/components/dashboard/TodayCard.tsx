import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, isTomorrow, isToday } from 'date-fns';
import {
  Activity,
  AlertTriangle,
  Battery,
  Calendar,
  CheckCircle2,
  HeartPulse,
  Map,
  RefreshCw,
  Sparkles,
  Timer,
  Zap,
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { recommendationService } from '../../services/recommendationService';
import { ROUTES } from '../../utils/constants';
import type { CoachSpecialization, DailyMetric, Workout } from '../../types';
import type { ReadinessVerdict } from '../../services/readinessService';

interface TodayCardProps {
  nextWorkout: Workout | null;
  dailyMetric: DailyMetric | null;
  readinessVerdict: ReadinessVerdict | null;
  coachSpecialization?: CoachSpecialization;
  isDemoMode?: boolean;
  onViewDetails?: (workout: Workout) => void;
  onOpenPicker?: () => void;
  onWorkoutUpdated: () => void;
}

type AdjustmentType = 'rest' | 'shorten' | 'challenge';

const ADJUSTMENTS: { type: AdjustmentType; label: string; Icon: React.ElementType; confirmLabel: string }[] = [
  { type: 'rest', label: 'Need Rest', Icon: Battery, confirmLabel: 'Swap for Active Recovery Spin?' },
  { type: 'shorten', label: 'Short on Time', Icon: Timer, confirmLabel: 'Shorten duration by 40%?' },
  { type: 'challenge', label: 'Feel Fresh', Icon: HeartPulse, confirmLabel: 'Upgrade to a harder session?' },
];

export const TodayCard: React.FC<TodayCardProps> = ({
  nextWorkout,
  dailyMetric,
  readinessVerdict,
  coachSpecialization,
  isDemoMode = false,
  onViewDetails,
  onOpenPicker,
  onWorkoutUpdated,
}) => {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const [recentWorkout, setRecentWorkout] = useState<Workout | null>(null);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [loadingAdjustment, setLoadingAdjustment] = useState<AdjustmentType | null>(null);
  const [pendingAdjustment, setPendingAdjustment] = useState<AdjustmentType | null>(null);

  useEffect(() => {
    const fetchRecentWorkout = async () => {
      if (isDemoMode) {
        setRecentWorkout({
          id: 'demo-workout',
          name: 'Demo Ride',
          type: 'bike',
          description: '',
          duration: 45,
          intensity: 'hard',
          scheduledDate: new Date(Date.now() - 86400000),
          completed: true,
          status: 'completed',
        });
        setLoadingRecent(false);
        return;
      }

      if (!userProfile?.user_id) {
        setLoadingRecent(false);
        return;
      }

      try {
        const today = new Date().toISOString().split('T')[0];
        const { data } = await supabase
          .from('workouts')
          .select('*')
          .eq('user_id', userProfile.user_id)
          .lt('scheduled_date', today)
          .order('scheduled_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data) {
          setRecentWorkout({
            ...data,
            scheduledDate: new Date(data.scheduled_date + 'T00:00:00'),
          } as Workout);
        }
      } catch (err) {
        console.warn('Failed to fetch recent workout for today card:', err);
      } finally {
        setLoadingRecent(false);
      }
    };

    fetchRecentWorkout();
  }, [userProfile?.user_id, isDemoMode]);

  if (loadingRecent) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-6 animate-pulse">
        <div className="h-5 bg-slate-800 rounded w-1/3 mb-3"></div>
        <div className="h-4 bg-slate-800 rounded w-2/3 mb-2"></div>
        <div className="h-4 bg-slate-800 rounded w-1/2"></div>
      </div>
    );
  }

  const todayStr = new Date().toLocaleDateString('en-CA');
  const nextWorkoutDateStr = nextWorkout?.scheduledDate instanceof Date
    ? nextWorkout.scheduledDate.toISOString().split('T')[0]
    : nextWorkout?.scheduledDate
      ? String(nextWorkout.scheduledDate).split('T')[0]
      : null;
  const isWorkoutToday = !!nextWorkout && nextWorkoutDateStr === todayStr;

  // ── Workout header visuals (gradient + focus tag by intensity) ──
  let gradientClass = 'bg-gradient-to-br from-blue-700 to-cyan-600';
  let HeaderIcon = Activity;
  let focusTag = 'Base Building';
  let dateDisplay = '';
  let durationDisplay = '';

  if (nextWorkout) {
    const workoutDate = new Date(nextWorkout.scheduledDate);
    dateDisplay = format(workoutDate, 'MMM d');
    if (isToday(workoutDate)) dateDisplay = 'Today';
    else if (isTomorrow(workoutDate)) dateDisplay = 'Tomorrow';

    const durationHours = Math.floor(nextWorkout.duration / 60);
    const durationMinutes = nextWorkout.duration % 60;
    if (durationHours > 0) durationDisplay += `${durationHours}h `;
    if (durationMinutes > 0 || durationHours === 0) durationDisplay += `${durationMinutes}m`;
    durationDisplay = durationDisplay.trim();

    const intensity = nextWorkout.intensity || 'moderate';
    const name = nextWorkout.name.toLowerCase();

    if (intensity === 'hard' || name.includes('vo2') || name.includes('race')) {
      gradientClass = 'bg-gradient-to-br from-purple-900 to-indigo-800';
      HeaderIcon = Zap;
      focusTag = 'High Intensity';
    } else if (intensity === 'moderate' || name.includes('tempo') || name.includes('sweet spot')) {
      gradientClass = 'bg-gradient-to-br from-orange-700 to-red-600';
      HeaderIcon = Activity;
      focusTag = 'Tempo / Threshold';
    } else if (intensity === 'recovery' || name.includes('recovery')) {
      gradientClass = 'bg-gradient-to-br from-teal-800 to-emerald-600';
      HeaderIcon = CheckCircle2;
      focusTag = 'Active Recovery';
    } else {
      gradientClass = 'bg-gradient-to-br from-blue-700 to-cyan-600';
      HeaderIcon = Activity;
      focusTag = 'Base Building';
    }
  }

  // ── Today's suggestion synthesis (only meaningful when nothing is scheduled today) ──
  const recoveryScore = dailyMetric?.recovery_score ?? readinessVerdict?.score ?? null;
  const dayOfWeek = new Date().getDay();

  let daysSinceLastSession = 0;
  let lastSessionYesterday = false;
  if (recentWorkout) {
    const lastDate = recentWorkout.scheduledDate.getTime();
    const today = new Date().setHours(0, 0, 0, 0);
    daysSinceLastSession = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
    lastSessionYesterday = daysSinceLastSession === 1;
  }

  const wasHighIntensity = recentWorkout?.intensity === 'hard';

  let suggestionHeadline = 'Consistency is what counts today';
  let suggestionExplanation = 'Keep moving to maintain your training habit.';
  let suggestionText = '20-30 min session of your choice';
  let SuggestionIcon = Sparkles;
  let suggestionIconColor = 'text-blue-400';

  if (readinessVerdict?.status === 'rest_required') {
    suggestionHeadline = 'Take it easy today';
    suggestionExplanation = readinessVerdict.isSick
      ? readinessVerdict.headline
      : `Your recovery is lower than usual (${Math.round(readinessVerdict.score)}%). Listen to your body and avoid pushing too hard.`;
    suggestionText = '15-20 min mobility or easy walk';
    SuggestionIcon = Battery;
    suggestionIconColor = 'text-red-400';
    if (coachSpecialization === 'strength_mobility') {
      suggestionText = '15-20 min dedicated stretching and mobility';
    }
  } else if (readinessVerdict?.status === 'prime' && daysSinceLastSession >= 2) {
    suggestionHeadline = 'Good day to push';
    suggestionExplanation = `Your recovery is excellent (${Math.round(readinessVerdict.score)}%) and you're well rested from your last session.`;
    suggestionText = '45-60 min effort building session';
    SuggestionIcon = HeartPulse;
    suggestionIconColor = 'text-green-400';
    if (coachSpecialization === 'endurance') {
      suggestionText = '45-60 min threshold intervals';
    }
  } else if (lastSessionYesterday && wasHighIntensity) {
    suggestionHeadline = 'Mobility work would serve you well';
    suggestionExplanation = 'You had a hard session yesterday. Active recovery will help your muscles bounce back faster.';
    suggestionText = '25 min yoga or active recovery spin';
    SuggestionIcon = Activity;
    suggestionIconColor = 'text-orange-400';
  } else if (dayOfWeek === 0 || dayOfWeek === 6) {
    suggestionHeadline = 'Enjoy the weekend';
    suggestionExplanation = "It's a great time to get outside or do something fun.";
    suggestionText = 'Long unstructured activity (e.g., hiking or long ride)';
    SuggestionIcon = Map;
    suggestionIconColor = 'text-purple-400';
  } else if (recoveryScore) {
    suggestionExplanation = `Your recovery is steady at ${Math.round(recoveryScore)}%.`;
    suggestionText = 'A 20-30 min session of your choice';
  }

  // ── Adjustment chips (act on nextWorkout, whichever day it falls on) ──
  const isHighIntensity = nextWorkout?.intensity === 'hard' || nextWorkout?.intensity === 'moderate';
  const isLowIntensity = nextWorkout?.intensity === 'easy' || nextWorkout?.intensity === 'recovery';
  const showRestNudge = readinessVerdict?.status === 'rest_required' && isHighIntensity;
  const showPushNudge = readinessVerdict?.status === 'prime' && isLowIntensity;

  const handleChipClick = (type: AdjustmentType) => setPendingAdjustment(type);

  const handleConfirmAdjustment = async () => {
    if (!pendingAdjustment || !nextWorkout) return;
    const action = pendingAdjustment;
    setPendingAdjustment(null);
    setLoadingAdjustment(action);
    try {
      await recommendationService.adjustDailyWorkout(nextWorkout, action);
      onWorkoutUpdated();
    } catch (error) {
      console.error('Failed to adjust workout:', error);
    } finally {
      setLoadingAdjustment(null);
    }
  };

  const showSuggestionSection = !isWorkoutToday;
  const showPicker = showSuggestionSection && !!onOpenPicker;
  const showAdjustmentChips = !!nextWorkout && !nextWorkout.completed;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden mb-6 shadow-sm">
      {nextWorkout && (
        <div className={`relative w-full ${gradientClass} text-white p-6`}>
          <div className="absolute -top-6 -right-6 opacity-10 pointer-events-none">
            <HeaderIcon size={140} />
          </div>
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-3">
              <div className="flex flex-col">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/20 backdrop-blur-sm border border-white/10 mb-2 w-fit">
                  🎯 {focusTag}
                </span>
                <h2 className="text-2xl font-bold tracking-tight leading-tight">{nextWorkout.name}</h2>
              </div>
            </div>

            <div className="flex items-center space-x-4 mb-4 text-white/90">
              <div className="flex items-center">
                <Calendar className="w-4 h-4 mr-1.5 opacity-80" />
                <span className="text-sm font-medium">{dateDisplay}</span>
              </div>
              <div className="flex items-center">
                <Timer className="w-4 h-4 mr-1.5 opacity-80" />
                <span className="text-sm font-medium">{durationDisplay}</span>
              </div>
            </div>

            {readinessVerdict && (
              <div className="mb-4 rounded-lg backdrop-blur-sm px-3 py-2 flex items-center space-x-2 bg-white/10 border border-white/10">
                <Sparkles className="w-4 h-4 flex-shrink-0 text-white/90" />
                <span className="text-sm font-medium leading-snug text-white/90">{readinessVerdict.headline}</span>
              </div>
            )}

            <button
              onClick={() => (onViewDetails ? onViewDetails(nextWorkout) : navigate(ROUTES.PLANS))}
              className="w-full bg-white text-gray-900 hover:bg-gray-50 active:scale-[0.98] transition-all font-bold py-3 px-4 rounded-xl shadow-md flex items-center justify-center space-x-2"
            >
              <span>View Session Brief</span>
              <Activity className="w-4 h-4 ml-1" />
            </button>
          </div>
        </div>
      )}

      {!nextWorkout && readinessVerdict && (
        <div className="px-5 pt-5">
          <div className="rounded-lg px-3 py-2.5 flex items-center gap-2 bg-slate-800/60 border border-slate-700/50">
            <Sparkles className="w-4 h-4 flex-shrink-0 text-slate-300" />
            <span className="text-sm font-medium leading-snug text-slate-300">{readinessVerdict.headline}</span>
          </div>
        </div>
      )}

      {showSuggestionSection && (
        <div className="p-5">
          <div className="flex items-start mb-3">
            <div className={`p-2 rounded-lg bg-slate-800 border border-slate-700 mr-3 flex-shrink-0 ${suggestionIconColor}`}>
              <SuggestionIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-slate-200 font-semibold text-lg leading-tight mb-1">{suggestionHeadline}</h3>
              <p className="text-slate-400 text-sm">{suggestionExplanation}</p>
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold block mb-0.5">Suggested</span>
                <span className="text-slate-300 font-medium text-sm">{suggestionText}</span>
              </div>
              <div className="text-xs text-slate-500 text-right max-w-[120px] leading-tight flex items-center">
                Based on your recovery + recent activity
              </div>
            </div>

            {showPicker && (
              <button
                type="button"
                onClick={onOpenPicker}
                className="w-full flex items-center justify-center px-4 py-2 mt-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors font-medium border border-slate-600 shadow-sm text-sm"
              >
                <Sparkles className="w-4 h-4 mr-2 text-yellow-400" />
                Smart Workout Picker
              </button>
            )}
          </div>
        </div>
      )}

      {showAdjustmentChips && (
        <div className={`px-5 pb-5 space-y-2 ${isWorkoutToday ? 'pt-1' : ''}`}>
          {showRestNudge && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300 leading-snug">
                Today's planned session is high intensity — consider easing up given your current recovery.
              </p>
            </div>
          )}
          {showPushNudge && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
              <Zap className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-emerald-300 leading-snug">
                You're primed for more than today's planned session — consider upgrading it.
              </p>
            </div>
          )}

          {pendingAdjustment && (
            <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-600">
              <span className="text-xs text-slate-300 leading-snug">
                {ADJUSTMENTS.find(a => a.type === pendingAdjustment)?.confirmLabel}
              </span>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setPendingAdjustment(null)}
                  className="px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAdjustment}
                  className="px-2.5 py-1 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-500 rounded-lg transition-colors"
                >
                  Confirm
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {ADJUSTMENTS.map(({ type, label, Icon }) => {
              const isHighlighted = (type === 'rest' && showRestNudge) || (type === 'challenge' && showPushNudge);
              const isDimmed = (type === 'challenge' && showRestNudge) || (type === 'rest' && showPushNudge);

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
                  disabled={!!loadingAdjustment || !!pendingAdjustment}
                  className={`flex items-center px-3 py-1.5 border rounded-full text-xs font-medium transition-all whitespace-nowrap disabled:opacity-40 ${chipClass}`}
                >
                  {loadingAdjustment === type ? (
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
      )}
    </div>
  );
};
