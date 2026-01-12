import React, { useState } from 'react';
import { X, CheckCircle, AlertCircle, HelpCircle, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { ChatContextSnapshot, StravaAthlete, StravaActivity, StravaStats } from '../../types';
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
  stats?: StravaStats | undefined; // Made optional as dashboard data might not provide it
}

export const ChatContextModal: React.FC<ChatContextModalProps> = ({
  isOpen,
  onClose,
  context: initialContext,
  sessionId,
  sessionName,
  athlete,
  recentActivities,
  stats
}) => {
  const navigate = useNavigate();
  const [context] = useState(initialContext); // Removed unused setContext
  const [timeframe, setTimeframe] = useState('4 weeks');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const getConfidenceBadge = (score: number) => {
    if (score >= 75) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3 mr-1" />
          High
        </span>
      );
    } else if (score >= 50) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          <HelpCircle className="w-3 h-3 mr-1" />
          Medium
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          <AlertCircle className="w-3 h-3 mr-1" />
          Low
        </span>
      );
    }
  };

  const handleGeneratePlan = async () => {
    setGenerating(true);
    setError(null);

    try {
      const weeklyStats = {
        distance: recentActivities.reduce((sum, a) => sum + a.distance, 0) / 1000,
        time: recentActivities.reduce((sum, a) => sum + a.moving_time, 0),
        activities: recentActivities.length
      };

      const trainingContext = {
        athlete,
        recentActivities,
        stats: stats || undefined,
        weeklyVolume: weeklyStats,
        recovery: {
            sleepData: null,
            readinessData: null, 
            dailyMetric: null
        }
      };

      const preferences = `
Goals: ${context.goals.join(', ')}
Time Availability: ${context.constraints.timeAvailability || 'Not specified'}
Equipment: ${context.constraints.equipment?.join(', ') || 'Standard equipment'}
Injuries/Limitations: ${context.constraints.injuries?.join(', ') || 'None mentioned'}
Preferred Workouts: ${context.preferences.workoutTypes?.join(', ') || 'Varied'}
Intensity Preference: ${context.preferences.intensityPreference || 'Balanced'}
      `.trim();

      const goal = context.goals[0] || 'General cycling improvement';

      const { description, workouts } = await openaiService.generateTrainingPlan(
        trainingContext,
        goal,
        timeframe,
        preferences
      );

      console.log(`OpenAI returned ${workouts.length} workouts`);
      console.log('First workout sample:', workouts[0]);

      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(startDate);
      const weeksToAdd = parseInt(timeframe.split(' ')[0]);
      endDate.setDate(endDate.getDate() + weeksToAdd * 7);

      const workoutsWithDates = workouts.map((workout: any, index: number) => {
        const scheduledDate = new Date(startDate);
        scheduledDate.setDate(scheduledDate.getDate() + Math.floor(index / 7) * 7 + (workout.dayOfWeek || 0));

        return {
          id: `workout-${Date.now()}-${index}`,
          name: workout.name,
          type: workout.type,
          description: workout.description,
          duration: workout.duration,
          distance: workout.distance ? workout.distance * 1609.34 : undefined,
          intensity: workout.intensity,
          scheduledDate,
          completed: false,
          status: 'planned' as const
        };
      });

      console.log(`Converted to ${workoutsWithDates.length} workouts with dates`);
      console.log('First workout with date:', workoutsWithDates[0]);

      const newPlan = await trainingPlansService.createPlan({
        name: `${goal} - ${timeframe}`,
        description,
        goal,
        startDate,
        endDate,
        workouts: workoutsWithDates,
        sourceChatSessionId: sessionId,
        chatContextSnapshot: context
      });

      const confirmationMessage = {
        id: Date.now().toString(),
        role: 'assistant' as const,
        content: `I've created your training plan! The plan "${newPlan.name}" includes ${newPlan.workouts.length} workouts over ${timeframe}. You can view and manage it in the Plans section.`,
        timestamp: new Date()
      };

      await supabaseChatService.addMessageToSession(sessionId, confirmationMessage);

      navigate('/plans');
    } catch (err) {
      console.error('Error generating plan:', err);
      setError((err as Error).message || 'Failed to generate training plan');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Create Training Plan from Chat</h2>
            <p className="text-sm text-gray-600 mt-1">Review and confirm the extracted context from "{sessionName}"</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium text-gray-900">Training Goals</h3>
              {getConfidenceBadge(context.confidenceScores.goals)}
            </div>
            {context.goals.length > 0 ? (
              <ul className="space-y-2">
                {context.goals.map((goal, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-blue-500 mr-2">•</span>
                    <span className="text-gray-700">{goal}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 italic">No specific goals mentioned</p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium text-gray-900">Constraints</h3>
              {getConfidenceBadge(context.confidenceScores.constraints)}
            </div>
            <div className="space-y-3">
              {context.constraints.timeAvailability && (
                <div>
                  <span className="font-medium text-gray-700">Time: </span>
                  <span className="text-gray-600">{context.constraints.timeAvailability}</span>
                </div>
              )}
              {context.constraints.equipment && context.constraints.equipment.length > 0 && (
                <div>
                  <span className="font-medium text-gray-700">Equipment: </span>
                  <span className="text-gray-600">{context.constraints.equipment.join(', ')}</span>
                </div>
              )}
              {context.constraints.injuries && context.constraints.injuries.length > 0 && (
                <div>
                  <span className="font-medium text-gray-700">Injuries/Limitations: </span>
                  <span className="text-gray-600">{context.constraints.injuries.join(', ')}</span>
                </div>
              )}
              {!context.constraints.timeAvailability &&
                (!context.constraints.equipment || context.constraints.equipment.length === 0) &&
                (!context.constraints.injuries || context.constraints.injuries.length === 0) && (
                  <p className="text-gray-500 italic">No constraints mentioned</p>
                )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium text-gray-900">Preferences</h3>
              {getConfidenceBadge(context.confidenceScores.preferences)}
            </div>
            <div className="space-y-3">
              {context.preferences.workoutTypes && context.preferences.workoutTypes.length > 0 && (
                <div>
                  <span className="font-medium text-gray-700">Workout Types: </span>
                  <span className="text-gray-600">{context.preferences.workoutTypes.join(', ')}</span>
                </div>
              )}
              {context.preferences.intensityPreference && (
                <div>
                  <span className="font-medium text-gray-700">Intensity: </span>
                  <span className="text-gray-600">{context.preferences.intensityPreference}</span>
                </div>
              )}
              {(!context.preferences.workoutTypes || context.preferences.workoutTypes.length === 0) &&
                !context.preferences.intensityPreference && (
                  <p className="text-gray-500 italic">No preferences mentioned</p>
                )}
            </div>
          </div>

          {context.keyMessages.length > 0 && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">Key Discussion Points</h3>
              <div className="space-y-2">
                {context.keyMessages.map((msg, index) => (
                  <div key={index} className="bg-gray-50 rounded-lg p-3">
                    <p className="text-sm text-gray-700 italic">"{msg.content}"</p>
                    <p className="text-xs text-gray-500 mt-1">{msg.relevance}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <Calendar className="w-5 h-5 text-blue-600 mr-3 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-blue-900 mb-2">Plan Duration</h4>
                <select
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value)}
                  className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="1 week">1 Week</option>
                  <option value="2 weeks">2 Weeks</option>
                  <option value="4 weeks">4 Weeks</option>
                  <option value="8 weeks">8 Weeks</option>
                  <option value="12 weeks">12 Weeks</option>
                </select>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-end space-x-3">
          <Button
            onClick={onClose}
            disabled={generating}
            className="bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
          >
            Cancel
          </Button>
          <Button
            onClick={handleGeneratePlan}
            disabled={generating || context.goals.length === 0}
            className="bg-blue-500 hover:bg-blue-600 text-white"
          >
            {generating ? 'Generating Plan...' : 'Generate Training Plan'}
          </Button>
        </div>
      </div>
    </div>
  );
};
