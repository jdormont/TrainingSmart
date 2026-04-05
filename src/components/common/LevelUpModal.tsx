import React, { useState } from 'react';
import { userProfileService } from '../../services/userProfileService';
import { useAuth } from '../../contexts/AuthContext';
import { milestoneService } from '../../services/milestoneService';
import { analytics } from '../../lib/analytics';

interface Props {
  weeksConsistent: number;
  recentActivityCount: number;
  onClose: () => void;
}

export const LevelUpModal: React.FC<Props> = ({ weeksConsistent, recentActivityCount, onClose }) => {
  const { reloadProfile } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleAccept = async () => {
    setLoading(true);
    try {
      await userProfileService.updateFitnessMode('performance');
      await reloadProfile();
      milestoneService.accept();
      analytics.track('level_up_accepted', { weeks_consistent: weeksConsistent, recent_activities: recentActivityCount });
      onClose();
    } catch (err) {
      console.error('Failed to level up:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    milestoneService.dismiss();
    analytics.track('level_up_prompt_dismissed');
    onClose();
  };

  const displayWeeks = weeksConsistent > 0 ? weeksConsistent : Math.ceil(recentActivityCount / 2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleDismiss} />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-8 shadow-2xl text-center">
        {/* Celebration graphic */}
        <div className="text-6xl mb-4">🎉</div>

        <h2 className="text-2xl font-bold text-white mb-2">
          Look how far you've come!
        </h2>
        <p className="text-slate-400 text-sm mb-6 leading-relaxed">
          You've been showing up consistently for{' '}
          <span className="text-orange-400 font-semibold">
            {displayWeeks > 0 ? `${displayWeeks} week${displayWeeks !== 1 ? 's' : ''}` : 'weeks'}
          </span>{' '}
          — that's real momentum. Ready to set a bigger goal together?
        </p>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          {weeksConsistent > 0 && (
            <div className="bg-slate-800 rounded-xl p-4">
              <p className="text-2xl font-bold text-orange-400">{weeksConsistent}</p>
              <p className="text-xs text-slate-400 mt-0.5">weeks consistent</p>
            </div>
          )}
          <div className="bg-slate-800 rounded-xl p-4">
            <p className="text-2xl font-bold text-orange-400">{recentActivityCount}</p>
            <p className="text-xs text-slate-400 mt-0.5">sessions this month</p>
          </div>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={handleAccept}
            disabled={loading}
            className="w-full py-3 px-6 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
          >
            {loading ? 'Leveling up…' : "Yes, let's level up!"}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="w-full py-2.5 px-6 text-slate-400 hover:text-slate-200 text-sm transition-colors"
          >
            Not yet — I'll keep building
          </button>
        </div>

        <p className="text-xs text-slate-600 mt-4">
          Switching to Performance mode unlocks advanced analytics and plan options. You can always switch back in Settings.
        </p>
      </div>
    </div>
  );
};
