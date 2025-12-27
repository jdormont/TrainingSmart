import React, { useState } from 'react';
import { Trophy, Heart, Zap, Scale, X } from 'lucide-react';
import { Button } from '../common/Button';
import { completeOnboarding, type WizardData } from '../../services/userService';

interface IntakeWizardProps {
  onComplete: () => void;
}

const TRAINING_GOALS = [
  {
    id: 'Event Prep',
    label: 'Event Prep',
    description: 'Training for a race or event',
    icon: Trophy,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-300'
  },
  {
    id: 'General Fitness',
    label: 'General Fitness',
    description: 'Building healthy habits',
    icon: Heart,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-300'
  },
  {
    id: 'Performance/Speed',
    label: 'Performance/Speed',
    description: 'Getting faster and stronger',
    icon: Zap,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-300'
  },
  {
    id: 'Weight Loss',
    label: 'Weight Loss',
    description: 'Managing weight through exercise',
    icon: Scale,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-300'
  }
];

const WEEKLY_HOURS = [3, 5, 8, 10, 12];

const COACH_PERSONAS = [
  {
    id: 'Supportive',
    label: 'Supportive',
    description: 'Gentle, encouraging, and understanding'
  },
  {
    id: 'Drill Sergeant',
    label: 'Drill Sergeant',
    description: 'Direct, demanding, and no-nonsense'
  },
  {
    id: 'Analytical',
    label: 'Analytical',
    description: 'Data-focused, precise, and scientific'
  }
];

export const IntakeWizard: React.FC<IntakeWizardProps> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [wizardData, setWizardData] = useState<WizardData>({
    training_goal: '',
    weekly_hours: 0,
    coach_persona: ''
  });

  const handleGoalSelect = (goal: string) => {
    setWizardData({ ...wizardData, training_goal: goal });
  };

  const handleHoursSelect = (hours: number) => {
    setWizardData({ ...wizardData, weekly_hours: hours });
  };

  const handlePersonaSelect = (persona: string) => {
    setWizardData({ ...wizardData, coach_persona: persona });
  };

  const handleNext = () => {
    if (step === 1 && !wizardData.training_goal) {
      setError('Please select a training goal');
      return;
    }
    if (step === 2 && !wizardData.weekly_hours) {
      setError('Please select weekly hours');
      return;
    }
    setError(null);
    setStep(step + 1);
  };

  const handleBack = () => {
    setError(null);
    setStep(step - 1);
  };

  const handleSubmit = async () => {
    if (!wizardData.coach_persona) {
      setError('Please select a coach persona');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await completeOnboarding(wizardData);
      onComplete();
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-8">
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-3xl font-bold text-gray-900">Welcome to TrainingSmart AI</h2>
            </div>

            <div className="flex items-center space-x-2 mb-6">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`h-2 flex-1 rounded-full transition-colors ${
                    s <= step ? 'bg-orange-600' : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>

            <p className="text-gray-600">
              Step {step} of 3: Let's personalize your experience
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {step === 1 && (
            <div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-6">
                What is your main focus right now?
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {TRAINING_GOALS.map((goal) => {
                  const Icon = goal.icon;
                  const isSelected = wizardData.training_goal === goal.id;

                  return (
                    <button
                      key={goal.id}
                      onClick={() => handleGoalSelect(goal.id)}
                      className={`p-6 rounded-lg border-2 transition-all text-left ${
                        isSelected
                          ? `${goal.borderColor} ${goal.bgColor} shadow-md`
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div className="flex items-start space-x-4">
                        <div className={`p-3 rounded-lg ${goal.bgColor}`}>
                          <Icon className={`w-6 h-6 ${goal.color}`} />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 mb-1">{goal.label}</h4>
                          <p className="text-sm text-gray-600">{goal.description}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-6">
                How many hours per week can you train?
              </h3>
              <div className="flex flex-wrap gap-3 mb-4">
                {WEEKLY_HOURS.map((hours) => {
                  const isSelected = wizardData.weekly_hours === hours;

                  return (
                    <button
                      key={hours}
                      onClick={() => handleHoursSelect(hours)}
                      className={`px-8 py-4 rounded-lg border-2 font-semibold transition-all ${
                        isSelected
                          ? 'border-orange-600 bg-orange-50 text-orange-700 shadow-md'
                          : 'border-gray-200 hover:border-gray-300 bg-white text-gray-700'
                      }`}
                    >
                      {hours} hrs
                    </button>
                  );
                })}
                <button
                  onClick={() => handleHoursSelect(15)}
                  className={`px-8 py-4 rounded-lg border-2 font-semibold transition-all ${
                    wizardData.weekly_hours === 15
                      ? 'border-orange-600 bg-orange-50 text-orange-700 shadow-md'
                      : 'border-gray-200 hover:border-gray-300 bg-white text-gray-700'
                  }`}
                >
                  12+ hrs
                </button>
              </div>
              <p className="text-sm text-gray-500">
                This helps us recommend realistic training plans that fit your schedule.
              </p>
            </div>
          )}

          {step === 3 && (
            <div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-6">
                How should your AI Coach talk to you?
              </h3>
              <div className="space-y-3">
                {COACH_PERSONAS.map((persona) => {
                  const isSelected = wizardData.coach_persona === persona.id;

                  return (
                    <button
                      key={persona.id}
                      onClick={() => handlePersonaSelect(persona.id)}
                      className={`w-full p-5 rounded-lg border-2 transition-all text-left ${
                        isSelected
                          ? 'border-orange-600 bg-orange-50 shadow-md'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <h4 className="font-semibold text-gray-900 mb-1">{persona.label}</h4>
                      <p className="text-sm text-gray-600">{persona.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
            {step > 1 ? (
              <Button variant="outline" onClick={handleBack} disabled={submitting}>
                Back
              </Button>
            ) : (
              <div />
            )}

            {step < 3 ? (
              <Button onClick={handleNext}>Next</Button>
            ) : (
              <Button onClick={handleSubmit} loading={submitting}>
                Complete Setup
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
