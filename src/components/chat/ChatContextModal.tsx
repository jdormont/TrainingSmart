import React, { useState } from 'react';
import { X, CheckCircle, AlertCircle, HelpCircle, Calendar, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { ChatContextSnapshot, StravaAthlete, StravaActivity, StravaStats } from '../../types';

// Minimal profile shape — avoids strict ActivityType mismatch between AuthContext and types/index
interface PlanUserProfile {
  fitness_level?: string;
  primary_goal?: string;
  coach_specialization?: string;
  fitness_mode?: string;
  activity_mix?: unknown;
  weekly_availability_days?: number;
  weekly_availability_duration?: number;
}
import { Button } from '../common/Button';
import { openaiService } from '../../services/openaiApi';
import { trainingPlansService } from '../../services/trainingPlansService';
import { supabaseChatService } from '../../services/supabaseChatService';

interface ChatContextModalProps {
  isOpen: boolean;
  onClose: () => void;
  context: ChatContextSnapshot;
  sessionId: string;
  sessionName: string;
  athlete: StravaAthlete;
  recentActivities: StravaActivity[];
  stats?: StravaStats | undefined;
  userProfile?: PlanUserProfile | null;
}

type Step = 'review' | 'preview';

type GeneratedWorkout = {
  week: number;
  dayOfWeek: number;
  name: string;
  type: string;
  phase?: string;
  description: string;
  duration: number;
  distance?: number;
  intensity: 'easy' | 'moderate' | 'hard' | 'recovery';
  activity_metadata?: Record<string, unknown>;
};

const FITNESS_LEVEL_MAP: Record<string, number> = {
  beginner: 1,
  returning: 2,
  intermediate: 3,
  advanced: 4,
};

const INTENSITY_STYLES: Record<string, string> = {
  easy:     'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  moderate: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  hard:     'bg-purple-500/15 text-purple-300 border-purple-500/30',
  recovery: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
};

const TYPE_EMOJI: Record<string, string> = {
  bike: '🚴', run: '🏃', swim: '🏊', strength: '💪',
  yoga: '🧘', hiking: '🥾', rest: '😴',
};

function estimateFtp(activities: StravaActivity[]): number | null {
  const poweredRides = activities.filter(
    a => a.average_watts && a.moving_time > 1200
  );
  if (poweredRides.length === 0) return null;
  const best = Math.max(...poweredRides.map(a => a.average_watts!));
  return Math.round(best * 0.95);
}

export const ChatContextModal: React.FC<ChatContextModalProps> = ({
  isOpen,
  onClose,
  context: initialContext,
  sessionId,
  sessionName,
  athlete,
  recentActivities,
  stats,
  userProfile,
}) => {
  const navigate = useNavigate();
  const [context] = useState(initialContext);
  const [step, setStep] = useState<Step>('review');
  const [timeframe, setTimeframe] = useState('4 weeks');
  const [eventDateInput, setEventDateInput] = useState('');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedWorkouts, setGeneratedWorkouts] = useState<GeneratedWorkout[]>([]);
  const [generatedDescription, setGeneratedDescription] = useState('');
  const [generatedReasoning, setGeneratedReasoning] = useState<unknown>(null);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set([1]));

  if (!isOpen) return null;

  const estimatedFtp = estimateFtp(recentActivities);
  const fitnessLevel = FITNESS_LEVEL_MAP[userProfile?.fitness_level || 'intermediate'] ?? 2;
  const riderProfile = { stamina: { level: fitnessLevel }, discipline: { level: fitnessLevel } };

  const buildDailyAvailability = (): Record<string, string> | undefined => {
    const days = userProfile?.weekly_availability_days;
    const mins = userProfile?.weekly_availability_duration;
    if (!days || !mins) return undefined;
    const durationLabel = mins >= 90 ? `${mins} min` : `${mins} min`;
    const defaults = ['monday', 'wednesday', 'saturday'];
    const out: Record<string, string> = {};
    defaults.slice(0, Math.min(days, 5)).forEach(d => { out[d] = durationLabel; });
    return out;
  };

  const getConfidenceBadge = (score: number) => {
    if (score >= 75) return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <CheckCircle className="w-3 h-3 mr-1" /> High
      </span>
    );
    if (score >= 50) return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
        <HelpCircle className="w-3 h-3 mr-1" /> Medium
      </span>
    );
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
        <AlertCircle className="w-3 h-3 mr-1" /> Low
      </span>
    );
  };

  const handleGeneratePlan = async () => {
    setGenerating(true);
    setError(null);

    try {
      const weeklyVolume = {
        distance: recentActivities.reduce((s, a) => s + a.distance, 0) / 1000,
        time: recentActivities.reduce((s, a) => s + a.moving_time, 0),
        activities: recentActivities.length,
      };

      const trainingContext = {
        athlete,
        recentActivities,
        stats: stats || undefined,
        weeklyVolume,
        recovery: { sleepData: null, readinessData: null, dailyMetric: null },
        userProfile: userProfile ? {
          training_goal: userProfile.primary_goal || '',
          coach_persona: userProfile.coach_specialization || '',
          weekly_hours: userProfile.weekly_availability_duration
            ? Math.round(userProfile.weekly_availability_duration / 60 * 10) / 10
            : undefined,
          coach_specialization: userProfile.coach_specialization,
          fitness_mode: userProfile.fitness_mode,
          activity_mix: userProfile.activity_mix as any,
        } : undefined,
      };

      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      const startDateStr = startDate.toISOString().split('T')[0];

      const eventDateStr = eventDateInput || (() => {
        const d = new Date(startDate);
        d.setDate(d.getDate() + parseInt(timeframe.split(' ')[0]) * 7);
        return d.toISOString().split('T')[0];
      })();

      const ftpLine = estimatedFtp
        ? `\nEstimated FTP: ${estimatedFtp}w · Zone targets — Z2: ${Math.round(estimatedFtp * 0.56)}–${Math.round(estimatedFtp * 0.75)}w · Sweet spot: ${Math.round(estimatedFtp * 0.88)}–${Math.round(estimatedFtp * 0.94)}w · Threshold: ${Math.round(estimatedFtp * 0.95)}–${Math.round(estimatedFtp * 1.05)}w`
        : '';

      const preferences = `
Goals: ${context.goals.join(', ')}
Time Availability: ${context.constraints.timeAvailability || `${userProfile?.weekly_availability_days ?? 3} days/week, ${userProfile?.weekly_availability_duration ?? 60} min/session`}
Equipment: ${context.constraints.equipment?.join(', ') || 'Standard equipment'}
Injuries/Limitations: ${context.constraints.injuries?.join(', ') || 'None mentioned'}
Preferred Workouts: ${context.preferences.workoutTypes?.join(', ') || 'Varied'}
Intensity Preference: ${context.preferences.intensityPreference || 'Balanced'}${ftpLine}
      `.trim();

      const { description, workouts, reasoning } = await openaiService.generateTrainingPlan(
        trainingContext,
        context.goals[0] || 'General fitness improvement',
        eventDateStr,
        startDateStr,
        riderProfile,
        preferences,
        buildDailyAvailability()
      );

      setGeneratedWorkouts(workouts as GeneratedWorkout[]);
      setGeneratedDescription(description);
      setGeneratedReasoning(reasoning ?? null);
      setStep('preview');
    } catch (err) {
      setError((err as Error).message || 'Failed to generate training plan');
    } finally {
      setGenerating(false);
    }
  };

  const handleSavePlan = async () => {
    setSaving(true);
    setError(null);

    try {
      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);

      const weeksToAdd = eventDateInput
        ? Math.ceil((new Date(eventDateInput).getTime() - startDate.getTime()) / (7 * 86400000))
        : parseInt(timeframe.split(' ')[0]);

      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + weeksToAdd * 7);

      const workoutsWithDates = generatedWorkouts.map((w, index) => {
        const scheduled = new Date(startDate);
        const weekOffset = ((w.week ?? 1) - 1) * 7;
        const dayOffset = (w.dayOfWeek ?? 1) - 1;
        scheduled.setDate(scheduled.getDate() + weekOffset + dayOffset);

        return {
          id: `workout-${Date.now()}-${index}`,
          name: w.name,
          type: w.type as any,
          description: w.description,
          duration: w.duration,
          distance: w.distance ? w.distance * 1609.34 : undefined,
          intensity: w.intensity,
          scheduledDate: scheduled,
          completed: false,
          status: 'planned' as const,
          activity_metadata: w.activity_metadata,
        };
      });

      const goal = context.goals[0] || 'General fitness improvement';
      const newPlan = await trainingPlansService.createPlan({
        name: `${goal} - ${timeframe}`,
        description: generatedDescription,
        goal,
        startDate,
        endDate,
        workouts: workoutsWithDates,
        sourceChatSessionId: sessionId,
        chatContextSnapshot: context,
        reasoning: generatedReasoning as any,
      });

      await supabaseChatService.addMessageToSession(sessionId, {
        id: Date.now().toString(),
        role: 'assistant',
        content: `I've created your training plan! "${newPlan.name}" has ${newPlan.workouts.length} workouts over ${timeframe}. You can view it in the Plans section.`,
        timestamp: new Date(),
      });

      navigate('/plans');
    } catch (err) {
      setError((err as Error).message || 'Failed to save training plan');
    } finally {
      setSaving(false);
    }
  };

  const weekGroups = generatedWorkouts.reduce<Record<number, GeneratedWorkout[]>>((acc, w) => {
    const wk = w.week ?? 1;
    if (!acc[wk]) acc[wk] = [];
    acc[wk].push(w);
    return acc;
  }, {});

  const toggleWeek = (wk: number) => {
    setExpandedWeeks(prev => {
      const next = new Set(prev);
      next.has(wk) ? next.delete(wk) : next.add(wk);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-100">
              {step === 'review' ? 'Create Training Plan' : 'Review Your Plan'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {step === 'review'
                ? `From conversation: "${sessionName}"`
                : `${generatedWorkouts.length} workouts · ${Object.keys(weekGroups).length} weeks`}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">

          {step === 'review' && (
            <>
              {/* Goals */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Goals</h3>
                  {getConfidenceBadge(context.confidenceScores.goals)}
                </div>
                {context.goals.length > 0 ? (
                  <ul className="space-y-1">
                    {context.goals.map((g, i) => (
                      <li key={i} className="flex items-start text-sm text-slate-300">
                        <span className="text-orange-400 mr-2 mt-0.5">·</span>{g}
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-slate-500 italic">No goals found — try discussing what you want to train for.</p>}
              </div>

              {/* Constraints */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Constraints</h3>
                  {getConfidenceBadge(context.confidenceScores.constraints)}
                </div>
                <div className="space-y-1 text-sm">
                  {context.constraints.timeAvailability && (
                    <p className="text-slate-300"><span className="text-slate-500">Time:</span> {context.constraints.timeAvailability}</p>
                  )}
                  {context.constraints.equipment?.length ? (
                    <p className="text-slate-300"><span className="text-slate-500">Equipment:</span> {context.constraints.equipment.join(', ')}</p>
                  ) : null}
                  {context.constraints.injuries?.length ? (
                    <p className="text-slate-300"><span className="text-slate-500">Limitations:</span> {context.constraints.injuries.join(', ')}</p>
                  ) : null}
                  {!context.constraints.timeAvailability && !context.constraints.equipment?.length && !context.constraints.injuries?.length && (
                    <p className="text-slate-500 italic">None detected</p>
                  )}
                </div>
              </div>

              {/* FTP banner */}
              {estimatedFtp && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-orange-500/10 border border-orange-500/25">
                  <Zap className="w-4 h-4 text-orange-400 flex-shrink-0" />
                  <p className="text-xs text-orange-300">
                    Estimated FTP <span className="font-semibold">{estimatedFtp}w</span> from your recent rides — workouts will include zone targets.
                  </p>
                </div>
              )}

              {/* Plan settings */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Duration</label>
                  <select
                    value={timeframe}
                    onChange={e => setTimeframe(e.target.value)}
                    title="Plan duration"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-orange-500/50"
                  >
                    <option value="1 week">1 Week</option>
                    <option value="2 weeks">2 Weeks</option>
                    <option value="4 weeks">4 Weeks</option>
                    <option value="8 weeks">8 Weeks</option>
                    <option value="12 weeks">12 Weeks</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">
                    Target / Event Date <span className="text-slate-600">(optional)</span>
                  </label>
                  <input
                    type="date"
                    value={eventDateInput}
                    onChange={e => setEventDateInput(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    title="Target or event date"
                    placeholder="YYYY-MM-DD"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-orange-500/50"
                  />
                </div>
              </div>

              {error && (
                <div className="px-4 py-3 bg-red-500/10 border border-red-500/25 rounded-xl">
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}
            </>
          )}

          {step === 'preview' && (
            <>
              {/* Plan summary */}
              {generatedDescription && (
                <div className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl">
                  <p className="text-sm text-slate-300 leading-relaxed line-clamp-3">{generatedDescription}</p>
                </div>
              )}

              {/* Weeks */}
              <div className="space-y-2">
                {Object.entries(weekGroups)
                  .sort(([a], [b]) => parseInt(a) - parseInt(b))
                  .map(([wkStr, workouts]) => {
                    const wk = parseInt(wkStr);
                    const isExpanded = expandedWeeks.has(wk);
                    const phase = workouts[0]?.phase;
                    const totalMins = workouts.reduce((s, w) => s + w.duration, 0);

                    return (
                      <div key={wk} className="border border-slate-700 rounded-xl overflow-hidden">
                        <button
                          type="button"
                          onClick={() => toggleWeek(wk)}
                          className="w-full flex items-center justify-between px-4 py-3 bg-slate-800 hover:bg-slate-750 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-slate-200">Week {wk}</span>
                            {phase && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-400">{phase}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-500">
                            <span>{workouts.length} sessions · {totalMins}min</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="divide-y divide-slate-800">
                            {workouts
                              .sort((a, b) => (a.dayOfWeek ?? 0) - (b.dayOfWeek ?? 0))
                              .map((w, i) => (
                                <div key={i} className="flex items-center gap-3 px-4 py-2.5 bg-slate-900">
                                  <span className="text-base w-6 text-center flex-shrink-0">{TYPE_EMOJI[w.type] || '🏋️'}</span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm text-slate-200 font-medium truncate">{w.name}</p>
                                    <p className="text-xs text-slate-500">{w.duration}min</p>
                                  </div>
                                  <span className={`text-xs px-2 py-0.5 rounded-full border ${INTENSITY_STYLES[w.intensity] ?? INTENSITY_STYLES.moderate}`}>
                                    {w.intensity}
                                  </span>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>

              {error && (
                <div className="px-4 py-3 bg-red-500/10 border border-red-500/25 rounded-xl">
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-800">
          {step === 'preview' ? (
            <>
              <button
                type="button"
                onClick={() => { setStep('review'); setError(null); }}
                className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={handleSavePlan}
                disabled={saving}
                className="flex-1 py-2.5 text-sm font-bold text-white bg-orange-600 hover:bg-orange-500 rounded-xl transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving…' : `Save Plan (${generatedWorkouts.length} workouts)`}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGeneratePlan}
                disabled={generating || context.goals.length === 0}
                className="flex-1 py-2.5 text-sm font-bold text-white bg-orange-600 hover:bg-orange-500 rounded-xl transition-colors disabled:opacity-50"
              >
                {generating ? 'Generating Plan…' : 'Generate Plan'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
