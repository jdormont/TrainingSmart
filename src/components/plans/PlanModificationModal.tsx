import { useState } from 'react';
import { X, Wand2, AlertCircle } from 'lucide-react';
import { Workout } from '../../types';
import WorkoutCard from './WorkoutCard';
import { Button } from '../common/Button';

interface PlanModificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  weekNumber: number;
  currentWorkouts: Workout[];
  onApplyChanges: (modificationRequest: string) => Promise<void>;
}

export default function PlanModificationModal({
  isOpen,
  onClose,
  weekNumber,
  currentWorkouts,
  onApplyChanges,
}: PlanModificationModalProps) {
  const [request, setRequest] = useState('');
  const [isModifying, setIsModifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!request.trim()) return;

    setIsModifying(true);
    setError(null);

    try {
      await onApplyChanges(request);
      setRequest('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to modify plan');
    } finally {
      setIsModifying(false);
    }
  };

  const handleClose = () => {
    if (!isModifying) {
      setRequest('');
      setError(null);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-800">
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-orange-500/10 rounded-lg">
              <Wand2 className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-50">Modify Week {weekNumber}</h2>
              <p className="text-sm text-slate-400">Adjust your training plan using natural language</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isModifying}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50 text-slate-400 hover:text-slate-200"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-50 mb-3">Current Week's Workouts</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {currentWorkouts.map((workout) => (
                <WorkoutCard key={workout.id} workout={workout} showDate={false} />
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="modification-request" className="block text-sm font-medium text-slate-300 mb-2">
              What would you like to change?
            </label>
            <textarea
              id="modification-request"
              value={request}
              onChange={(e) => setRequest(e.target.value)}
              disabled={isModifying}
              placeholder="Examples:
• I only have 2 hours total this week
• Can't workout on Wednesday and Thursday
• Feeling tired, reduce intensity by 20%
• Need to swap Tuesday and Friday workouts"
              className="w-full h-32 px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none disabled:bg-slate-800/50 disabled:cursor-not-allowed text-slate-50 placeholder-slate-500"
            />
            <div className="mt-2 flex items-start space-x-2 text-sm text-slate-400">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p>
                Be specific about your constraints. The AI will adjust your plan while maintaining training principles.
              </p>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-red-900">Modification Failed</h4>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-800 bg-slate-900/50 flex justify-end space-x-3">
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={isModifying}
            className="bg-transparent border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-slate-200"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!request.trim() || isModifying}
            className="flex items-center space-x-2"
          >
            {isModifying ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                <span>Modifying Plan...</span>
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                <span>Apply Changes</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
