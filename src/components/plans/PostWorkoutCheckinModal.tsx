import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { Workout } from '../../types';

interface PostWorkoutCheckinModalProps {
  workout: Workout;
  onSave: (rpe: number | null, notes: string) => void;
  onSkip: () => void;
}

const EFFORT_OPTIONS = [
  { value: 1, emoji: '😌', label: 'Easy', sub: 'Felt comfortable' },
  { value: 3, emoji: '👌', label: 'As Planned', sub: 'Right on target' },
  { value: 5, emoji: '💪', label: 'Tough', sub: 'Really pushed it' },
] as const;

export const PostWorkoutCheckinModal: React.FC<PostWorkoutCheckinModalProps> = ({
  workout,
  onSave,
  onSkip,
}) => {
  const [selectedRpe, setSelectedRpe] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(selectedRpe, notes);
    setSaving(false);
  };

  const durationDisplay = workout.duration >= 60
    ? `${Math.floor(workout.duration / 60)}h ${workout.duration % 60 > 0 ? `${workout.duration % 60}m` : ''}`.trim()
    : `${workout.duration}m`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-5 pb-3">
          <div>
            <h2 className="text-lg font-bold text-slate-100">How did that feel?</h2>
            <p className="text-sm text-slate-400 mt-0.5">
              {workout.name} &middot; {durationDisplay}
            </p>
          </div>
          <button
            type="button"
            onClick={onSkip}
            className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors rounded-lg hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Effort selector */}
        <div className="px-5 pb-4">
          <div className="grid grid-cols-3 gap-2">
            {EFFORT_OPTIONS.map((option) => {
              const isSelected = selectedRpe === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSelectedRpe(isSelected ? null : option.value)}
                  className={`flex flex-col items-center py-3 px-2 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-orange-500/20 border-orange-500/60 text-orange-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300'
                  }`}
                >
                  <span className="text-2xl mb-1">{option.emoji}</span>
                  <span className="text-xs font-semibold">{option.label}</span>
                  <span className="text-xs text-slate-500 mt-0.5 text-center leading-tight">{option.sub}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Notes */}
        <div className="px-5 pb-4">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any notes? (optional)"
            rows={2}
            maxLength={280}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-orange-500/50 resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-5 pb-5">
          <button
            type="button"
            onClick={onSkip}
            className="flex-1 py-2.5 text-sm font-medium text-slate-400 hover:text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 text-sm font-bold text-white bg-orange-600 hover:bg-orange-500 rounded-xl transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};
