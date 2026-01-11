import React, { useState } from 'react';
import { Battery, Timer, TrendingUp, RefreshCw } from 'lucide-react';
import { recommendationService } from '../../services/recommendationService';
import type { Workout } from '../../types';

interface WorkoutAdjustmentChipsProps {
  workout: Workout;
  onWorkoutUpdated: () => void;
}

export const WorkoutAdjustmentChips: React.FC<WorkoutAdjustmentChipsProps> = ({
  workout,
  onWorkoutUpdated
}) => {
  const [loading, setLoading] = useState<string | null>(null);

  const handleAdjustment = async (type: 'rest' | 'shorten' | 'challenge') => {
    let confirmMessage = '';
    
    switch (type) {
      case 'rest':
        confirmMessage = `Swap "${workout.name}" for an Active Recovery Spin?`;
        break;
      case 'shorten':
        confirmMessage = `Shorten "${workout.name}" duration by 40%?`;
        break;
      case 'challenge':
        confirmMessage = `Swap "${workout.name}" for a high-intensity Challenge workout?`;
        break;
    }

    if (window.confirm(confirmMessage)) {
      setLoading(type);
      try {
        await recommendationService.adjustDailyWorkout(workout, type);
        onWorkoutUpdated();
      } catch (error) {
        console.error('Failed to adjust workout:', error);
        alert('Failed to update workout. Please try again.');
      } finally {
        setLoading(null);
      }
    }
  };

  if (workout.completed) return null;

  return (
    <div className="flex items-center space-x-2 mt-4 overflow-x-auto pb-2 scrollbar-hide">
      {/* Need Rest */}
      <button
        onClick={() => handleAdjustment('rest')}
        disabled={!!loading}
        className="flex items-center px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full text-xs font-medium transition-colors whitespace-nowrap disabled:opacity-50"
      >
        {loading === 'rest' ? (
          <RefreshCw className="w-3 h-3 mr-1.5 animate-spin" />
        ) : (
          <Battery className="w-3 h-3 mr-1.5 text-green-600" />
        )}
        Need Rest
      </button>

      {/* Short on Time */}
      <button
        onClick={() => handleAdjustment('shorten')}
        disabled={!!loading}
        className="flex items-center px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-full text-xs font-medium transition-colors whitespace-nowrap disabled:opacity-50"
      >
        {loading === 'shorten' ? (
          <RefreshCw className="w-3 h-3 mr-1.5 animate-spin" />
        ) : (
          <Timer className="w-3 h-3 mr-1.5 text-amber-600" />
        )}
        Short on Time
      </button>

      {/* Feel Fresh */}
      <button
        onClick={() => handleAdjustment('challenge')}
        disabled={!!loading}
        className="flex items-center px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-full text-xs font-medium transition-colors whitespace-nowrap disabled:opacity-50"
      >
        {loading === 'challenge' ? (
          <RefreshCw className="w-3 h-3 mr-1.5 animate-spin" />
        ) : (
          <TrendingUp className="w-3 h-3 mr-1.5 text-orange-600" />
        )}
        Feel Fresh
      </button>
    </div>
  );
};
