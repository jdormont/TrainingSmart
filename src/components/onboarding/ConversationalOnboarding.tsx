import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { saveOnboardingProfile } from '../../services/onboardingService';
import type { ActivityType, ActivityMixItem, FitnessLevel, CoachSpecialization } from '../../types';
import { ROUTES } from '../../utils/constants';

// ── Data ─────────────────────────────────────────────────────────────────────

const GOAL_OPTIONS = [
  { value: 'get_back_into_it', label: 'Get back into it', description: "I've had a break and want to rebuild consistency" },
  { value: 'train_for_event', label: 'Train for an event', description: 'Race, competition, or a specific goal date' },
  { value: 'build_strength', label: 'Build strength', description: 'Lift more, move better, get stronger' },
  { value: 'stay_consistent', label: 'Stay consistent', description: 'Show up regularly and keep momentum' },
  { value: 'explore_activities', label: 'Explore new activities', description: "I want to try things I haven't done before" },
] as const;

const ACTIVITY_OPTIONS: { type: ActivityType; label: string; emoji: string }[] = [
  { type: 'bike', label: 'Cycling', emoji: '🚴' },
  { type: 'run', label: 'Running', emoji: '🏃' },
  { type: 'strength', label: 'Strength training', emoji: '🏋️' },
  { type: 'yoga', label: 'Yoga', emoji: '🧘' },
  { type: 'hiking', label: 'Hiking', emoji: '🥾' },
  { type: 'swim', label: 'Swimming', emoji: '🏊' },
];

const DURATION_OPTIONS = [20, 30, 45, 60, 90];

const FITNESS_OPTIONS: { value: FitnessLevel; label: string; description: string }[] = [
  { value: 'beginner', label: 'Just getting started', description: "New to structured training or exercise in general" },
  { value: 'returning', label: 'Getting back into it', description: "I've trained before but have been away for a while" },
  { value: 'intermediate', label: 'Pretty fit already', description: 'I train regularly and feel comfortable pushing' },
  { value: 'advanced', label: 'Well-trained, I push hard', description: 'High volume, performance-focused, I know my metrics' },
];

const COACH_LABELS: Record<CoachSpecialization, { name: string; description: string; emoji: string }> = {
  comeback: {
    name: 'Comeback Coach',
    emoji: '🌱',
    description: "I'll celebrate every session and focus on building momentum — not chasing metrics.",
  },
  endurance: {
    name: 'Endurance Coach',
    emoji: '🚴',
    description: "I'll guide your cycling and running with structured progression and performance focus.",
  },
  strength_mobility: {
    name: 'Strength & Mobility Coach',
    emoji: '💪',
    description: "I'll build your strength and mobility with smart programming across your chosen activities.",
  },
  general_fitness: {
    name: 'General Fitness Coach',
    emoji: '⚡',
    description: "I'll balance your mix of activities into a cohesive, well-rounded training week.",
  },
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface FormState {
  primary_goal: string;
  activity_mix: ActivityMixItem[];
  weekly_availability_days: number;
  weekly_availability_duration: number;
  fitness_level: FitnessLevel | '';
  optional_event: string;
}

const INITIAL_STATE: FormState = {
  primary_goal: '',
  activity_mix: [],
  weekly_availability_days: 4,
  weekly_availability_duration: 45,
  fitness_level: '',
  optional_event: '',
};

// ── Sub-components ────────────────────────────────────────────────────────────

const ProgressDots: React.FC<{ total: number; current: number }> = ({ total, current }) => (
  <div className="flex gap-2 justify-center">
    {Array.from({ length: total }).map((_, i) => (
      <div
        key={i}
        className={`h-2 rounded-full transition-all duration-300 ${
          i < current ? 'w-6 bg-orange-500' : i === current ? 'w-6 bg-orange-400' : 'w-2 bg-slate-600'
        }`}
      />
    ))}
  </div>
);

// ── Main Component ────────────────────────────────────────────────────────────

export const ConversationalOnboarding: React.FC = () => {
  const { user, reloadProfile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [saving, setSaving] = useState(false);
  const [assignedCoach, setAssignedCoach] = useState<CoachSpecialization | null>(null);
  const [error, setError] = useState<string | null>(null);

  const TOTAL_STEPS = 5; // questions only, not the completion screen

  const canAdvance = () => {
    if (step === 0) return !!form.primary_goal;
    if (step === 1) return form.activity_mix.length > 0;
    if (step === 2) return true; // steppers always have a valid value
    if (step === 3) return !!form.fitness_level;
    if (step === 4) return true; // optional
    return false;
  };

  const toggleActivity = (type: ActivityType) => {
    setForm(prev => {
      const exists = prev.activity_mix.find(a => a.type === type);
      if (exists) {
        const updated = prev.activity_mix
          .filter(a => a.type !== type)
          .map((a, i) => ({ ...a, priority: i + 1 }));
        return { ...prev, activity_mix: updated };
      }
      return {
        ...prev,
        activity_mix: [...prev.activity_mix, { type, priority: prev.activity_mix.length + 1 }],
      };
    });
  };

  const handleNext = () => {
    if (step < TOTAL_STEPS - 1) {
      setStep(s => s + 1);
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    if (!user || !form.fitness_level) return;
    setSaving(true);
    setError(null);
    try {
      const goal = form.optional_event
        ? `${form.primary_goal} — ${form.optional_event}`
        : form.primary_goal;

      const { coach_specialization } = await saveOnboardingProfile(user.id, {
        primary_goal: goal,
        activity_mix: form.activity_mix,
        weekly_availability_days: form.weekly_availability_days,
        weekly_availability_duration: form.weekly_availability_duration,
        fitness_level: form.fitness_level as FitnessLevel,
      });
      setAssignedCoach(coach_specialization);
      setStep(TOTAL_STEPS); // advance to completion screen
    } catch (err) {
      setError('Something went wrong saving your profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleGoToDashboard = async () => {
    await reloadProfile();
    navigate(ROUTES.DASHBOARD, { replace: true });
  };

  const handleSkip = async () => {
    if (!user) return;
    try {
      await saveOnboardingProfile(user.id, {
        primary_goal: 'skipped',
        activity_mix: [{ type: 'bike', priority: 1 }],
        weekly_availability_days: 4,
        weekly_availability_duration: 45,
        fitness_level: 'intermediate',
      });
    } catch {
      // Non-blocking — proceed anyway
    }
    await reloadProfile();
    navigate(ROUTES.DASHBOARD, { replace: true });
  };

  // ── Completion screen ──────────────────────────────────────────────────────

  if (step === TOTAL_STEPS && assignedCoach) {
    const coach = COACH_LABELS[assignedCoach];
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-8 animate-fadeIn">
          <div className="text-6xl">{coach.emoji}</div>
          <div className="space-y-3">
            <p className="text-slate-400 text-sm uppercase tracking-widest">Meet your coach</p>
            <h1 className="text-3xl font-bold text-white">{coach.name}</h1>
            <p className="text-slate-300 text-lg leading-relaxed">{coach.description}</p>
          </div>
          <p className="text-slate-500 text-sm">
            You can change your coach specialization any time in Settings.
          </p>
          <button
            type="button"
            onClick={handleGoToDashboard}
            className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl text-lg transition-colors"
          >
            Let's go →
          </button>
        </div>
      </div>
    );
  }

  // ── Question screens ──────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-5">
        <div className="w-24" /> {/* spacer */}
        <ProgressDots total={TOTAL_STEPS} current={step} />
        <button
          type="button"
          onClick={handleSkip}
          className="text-slate-500 hover:text-slate-300 text-sm transition-colors w-24 text-right"
        >
          Skip for now
        </button>
      </div>

      {/* Question area */}
      <div className="flex-1 flex items-center justify-center px-4 pb-8">
        <div className="max-w-lg w-full space-y-8">

          {/* Step 0 — Goal */}
          {step === 0 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-slate-400 text-sm">Question 1 of 5</p>
                <h2 className="text-2xl font-bold text-white">What brings you to TrainingSmart?</h2>
              </div>
              <div className="space-y-3">
                {GOAL_OPTIONS.map(opt => (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => setForm(f => ({ ...f, primary_goal: opt.value }))}
                    className={`w-full text-left px-5 py-4 rounded-xl border transition-all ${
                      form.primary_goal === opt.value
                        ? 'border-orange-500 bg-orange-500/10 text-white'
                        : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <div className="font-medium">{opt.label}</div>
                    <div className="text-sm text-slate-400 mt-0.5">{opt.description}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 1 — Activity mix */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-slate-400 text-sm">Question 2 of 5</p>
                <h2 className="text-2xl font-bold text-white">Which activities do you do or want to do?</h2>
                <p className="text-slate-400 text-sm">Select all that apply. Your first pick becomes your top priority.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {ACTIVITY_OPTIONS.map(({ type, label, emoji }) => {
                  const entry = form.activity_mix.find(a => a.type === type);
                  return (
                    <button
                      type="button"
                      key={type}
                      onClick={() => toggleActivity(type)}
                      className={`relative px-4 py-4 rounded-xl border transition-all text-left ${
                        entry
                          ? 'border-orange-500 bg-orange-500/10 text-white'
                          : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      {entry && (
                        <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center font-bold">
                          {entry.priority}
                        </span>
                      )}
                      <div className="text-2xl mb-1">{emoji}</div>
                      <div className="font-medium text-sm">{label}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2 — Availability */}
          {step === 2 && (
            <div className="space-y-8">
              <div className="space-y-2">
                <p className="text-slate-400 text-sm">Question 3 of 5</p>
                <h2 className="text-2xl font-bold text-white">How often can you realistically train?</h2>
                <p className="text-slate-400 text-sm">Be honest — it's better to plan for what you can actually do.</p>
              </div>

              {/* Days */}
              <div className="space-y-3">
                <label className="text-slate-300 font-medium">Days per week</label>
                <div className="flex gap-2">
                  {[2, 3, 4, 5, 6, 7].map(d => (
                    <button
                      type="button"
                      key={d}
                      onClick={() => setForm(f => ({ ...f, weekly_availability_days: d }))}
                      className={`flex-1 py-3 rounded-xl border font-semibold transition-all ${
                        form.weekly_availability_days === d
                          ? 'border-orange-500 bg-orange-500/10 text-white'
                          : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration */}
              <div className="space-y-3">
                <label className="text-slate-300 font-medium">Session length</label>
                <div className="flex gap-2 flex-wrap">
                  {DURATION_OPTIONS.map(d => (
                    <button
                      type="button"
                      key={d}
                      onClick={() => setForm(f => ({ ...f, weekly_availability_duration: d }))}
                      className={`px-4 py-3 rounded-xl border font-semibold transition-all ${
                        form.weekly_availability_duration === d
                          ? 'border-orange-500 bg-orange-500/10 text-white'
                          : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      {d} min
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3 — Fitness level */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-slate-400 text-sm">Question 4 of 5</p>
                <h2 className="text-2xl font-bold text-white">How would you describe your current fitness?</h2>
                <p className="text-slate-400 text-sm">No wrong answers — this helps your coach set the right starting point.</p>
              </div>
              <div className="space-y-3">
                {FITNESS_OPTIONS.map(opt => (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => setForm(f => ({ ...f, fitness_level: opt.value }))}
                    className={`w-full text-left px-5 py-4 rounded-xl border transition-all ${
                      form.fitness_level === opt.value
                        ? 'border-orange-500 bg-orange-500/10 text-white'
                        : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <div className="font-medium">{opt.label}</div>
                    <div className="text-sm text-slate-400 mt-0.5">{opt.description}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 4 — Optional event */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-slate-400 text-sm">Question 5 of 5</p>
                <h2 className="text-2xl font-bold text-white">Any upcoming events or goals? <span className="text-slate-500 font-normal">(optional)</span></h2>
                <p className="text-slate-400 text-sm">A race date, a specific lift, a distance target — anything to aim for.</p>
              </div>
              <textarea
                value={form.optional_event}
                onChange={e => setForm(f => ({ ...f, optional_event: e.target.value }))}
                placeholder="e.g. 10K in June, bench press 200 lbs, hike a 14er this summer…"
                rows={3}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 resize-none"
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          {/* Next / Submit button */}
          <button
            type="button"
            onClick={handleNext}
            disabled={!canAdvance() || saving}
            className="w-full py-4 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-lg transition-colors"
          >
            {saving ? 'Saving…' : step === TOTAL_STEPS - 1 ? 'Show me my coach →' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
};
