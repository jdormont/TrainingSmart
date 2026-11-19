import React, { useState } from 'react';
import { CalendarCheck, CheckCircle2, Clock, Gauge, ChevronDown, ChevronUp } from 'lucide-react';
import { format, parseISO, addDays } from 'date-fns';
import type { WeeklyReview } from '../../types';

interface WeeklyReviewCardProps {
  review: WeeklyReview | null;
  pastReviews: WeeklyReview[];
  isLoading?: boolean;
}

const RPE_LABEL = (rpe: number): string => (rpe <= 2 ? 'Easy' : rpe >= 4 ? 'Tough' : 'As planned');

const weekRange = (weekStart: string): string => {
  const start = parseISO(weekStart);
  return `${format(start, 'MMM d')} – ${format(addDays(start, 6), 'MMM d')}`;
};

const ScoreRing: React.FC<{ score: number }> = ({ score }) => {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="relative w-24 h-24 shrink-0" role="img" aria-label={`Adherence score ${score} out of 100`}>
      <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
        <circle cx="40" cy="40" r={radius} fill="none" strokeWidth="7" className="stroke-slate-800" />
        <circle
          cx="40" cy="40" r={radius} fill="none" strokeWidth="7" strokeLinecap="round"
          className="stroke-emerald-400 transition-all duration-300"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - score / 100)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-slate-50">{score}</span>
        <span className="text-[10px] uppercase tracking-wide text-slate-400">of 100</span>
      </div>
    </div>
  );
};

const Chip: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="flex items-center gap-2 rounded-lg bg-slate-800/60 border border-white/5 px-3 py-2">
    <span className="text-slate-400">{icon}</span>
    <div className="leading-tight">
      <div className="text-sm font-semibold text-slate-100">{value}</div>
      <div className="text-[11px] text-slate-400">{label}</div>
    </div>
  </div>
);

export const WeeklyReviewCard: React.FC<WeeklyReviewCardProps> = ({ review, pastReviews, isLoading }) => {
  const [showPast, setShowPast] = useState(false);

  if (isLoading && !review) {
    return <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 h-40 animate-pulse" aria-busy="true" />;
  }
  if (!review) return null;

  const { stats } = review;
  const nothingCompleted = stats.workoutsCompleted === 0;
  // Never present a score for a week with nothing done: it reads as a scolding.
  const showScore = review.adherenceScore !== null && !nothingCompleted;
  const older = pastReviews.filter(r => r.id !== review.id);

  return (
    <section className="bg-slate-900 rounded-xl shadow-lg shadow-black/20 border border-slate-800 p-6" aria-label="Weekly review">
      <div className="flex items-center gap-2 mb-4">
        <CalendarCheck className="w-5 h-5 text-emerald-400" aria-hidden="true" />
        <h3 className="text-lg font-semibold text-slate-50">Your week in review</h3>
        <span className="ml-auto text-xs text-slate-400">{weekRange(review.weekStart)}</span>
      </div>

      <div className="flex flex-col sm:flex-row gap-5">
        {showScore && <ScoreRing score={review.adherenceScore as number} />}
        <div className="flex-1 min-w-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
            <Chip
              icon={<CheckCircle2 className="w-4 h-4" />}
              label="Workouts done"
              value={`${stats.workoutsCompleted} of ${stats.workoutsPlanned}`}
            />
            <Chip
              icon={<Clock className="w-4 h-4" />}
              label="Minutes"
              value={`${stats.completedMinutes} of ${stats.plannedMinutes}`}
            />
            <Chip
              icon={<Gauge className="w-4 h-4" />}
              label={stats.avgRpe !== undefined ? 'How it felt' : 'Rest days'}
              value={stats.avgRpe !== undefined ? RPE_LABEL(stats.avgRpe) : `${stats.workoutsSkipped} taken`}
            />
          </div>
          {review.reviewText ? (
            <p className="text-sm leading-relaxed text-slate-200 whitespace-pre-line">{review.reviewText}</p>
          ) : (
            <p className="text-sm text-slate-400">Your coach's recap will appear here shortly.</p>
          )}
        </div>
      </div>

      {older.length > 0 && (
        <div className="mt-5 border-t border-white/5 pt-3">
          <button
            type="button"
            onClick={() => setShowPast(v => !v)}
            aria-expanded={showPast}
            className="flex items-center gap-1 text-sm text-slate-300 hover:text-slate-50 transition-colors"
          >
            Past reviews
            {showPast ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showPast && (
            <ul className="mt-3 space-y-3">
              {older.map(r => (
                <li key={r.id} className="rounded-lg bg-slate-800/40 border border-white/5 p-3">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span>{weekRange(r.weekStart)}</span>
                    {r.adherenceScore !== null && r.stats.workoutsCompleted > 0 && (
                      <span className="text-emerald-400 font-semibold">{r.adherenceScore}/100</span>
                    )}
                  </div>
                  <p className="text-sm text-slate-300">{r.reviewText ?? 'No recap for this week.'}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
};
