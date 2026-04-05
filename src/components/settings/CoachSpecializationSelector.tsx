import React, { useState } from 'react';
import type { CoachSpecialization } from '../../types';
import { userProfileService } from '../../services/userProfileService';

const SPECIALIZATIONS: {
  value: CoachSpecialization;
  name: string;
  emoji: string;
  description: string;
}[] = [
  {
    value: 'endurance',
    name: 'Endurance Coach',
    emoji: '🚴',
    description: 'Cycling & running focus with structured progression, power zones, and aerobic development.',
  },
  {
    value: 'strength_mobility',
    name: 'Strength & Mobility Coach',
    emoji: '💪',
    description: 'Strength training, yoga, and functional movement — built around your gym and mobility work.',
  },
  {
    value: 'general_fitness',
    name: 'General Fitness Coach',
    emoji: '⚡',
    description: 'Broad multi-modal balance across all your activities, no single sport dominates.',
  },
  {
    value: 'comeback',
    name: 'Comeback Coach',
    emoji: '🌱',
    description: 'Consistency first. Celebrates showing up, keeps the plan realistic, and builds momentum.',
  },
];

interface Props {
  current: CoachSpecialization | undefined;
  onUpdate: (specialization: CoachSpecialization) => void;
}

export const CoachSpecializationSelector: React.FC<Props> = ({ current, onUpdate }) => {
  const [selected, setSelected] = useState<CoachSpecialization | undefined>(current);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDirty = selected !== current;

  const handleSave = async () => {
    if (!selected || !isDirty) return;
    setSaving(true);
    setError(null);
    try {
      await userProfileService.updateCoachSpecialization(selected);
      onUpdate(selected);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        {SPECIALIZATIONS.map(s => (
          <button
            type="button"
            key={s.value}
            onClick={() => { setSelected(s.value); setSaved(false); }}
            className={`text-left px-4 py-4 rounded-xl border transition-all ${
              selected === s.value
                ? 'border-orange-500 bg-orange-500/10 text-white'
                : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">{s.emoji}</span>
              <span className="font-semibold text-sm">{s.name}</span>
              {current === s.value && selected !== s.value && (
                <span className="ml-auto text-xs text-slate-500">current</span>
              )}
              {current === s.value && selected === s.value && (
                <span className="ml-auto text-xs text-orange-400">current</span>
              )}
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">{s.description}</p>
          </button>
        ))}
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={!isDirty || saving}
          className="px-5 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saved && <span className="text-green-400 text-sm">Saved!</span>}
      </div>
    </div>
  );
};
