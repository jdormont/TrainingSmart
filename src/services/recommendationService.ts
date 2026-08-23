import { Workout } from '../types';

const WORKOUT_TEMPLATES = {
  vo2Max: {
    name: 'VO2 Max Intervals',
    description: 'High intensity intervals to boost your aerobic ceiling. Warm up for 15m, then 4x4m at 115% FTP with 4m rest. Cool down 15m.',
    duration: 60,
  },
  threshold: {
    name: 'Threshold Builder',
    description: 'Sustained effort to increase your FTP. Warm up 15m, then 3x10m at 95-100% FTP with 5m rest. Cool down 15m.',
    duration: 75,
  },
  activeRecovery: {
    name: 'Active Recovery Spin',
    description: 'Light spin to flush out legs. Keep heart rate below Zone 2. Focus on high cadence/low torque.',
    duration: 45,
  },
} as const;

export const recommendationService = {
  async adjustDailyWorkout(
    workout: Workout,
    adjustment: 'rest' | 'shorten' | 'challenge'
  ): Promise<void> {
    try {
      console.log(`Adjusting workout ${workout.id} with intent: ${adjustment}`);
      const { trainingPlansService } = await import('./trainingPlansService');

      if (adjustment === 'rest') {
        const template = WORKOUT_TEMPLATES.activeRecovery;
        await trainingPlansService.updateWorkout(
          workout.id,
          template.name,
          template.description,
          template.duration,
          undefined, // Distance (let it be 0 or calculated)
          'recovery',
          workout.scheduledDate
        );
      } else if (adjustment === 'shorten') {
        // Reduce duration by 40% (to 60% of original)
        const newDuration = Math.max(20, Math.round(workout.duration * 0.6)); // Minimum 20 mins
        const newTitle = workout.name.includes('[Short]') ? workout.name : `${workout.name} [Short]`;

        await trainingPlansService.updateWorkout(
          workout.id,
          newTitle,
          workout.description, // Keep description
          newDuration,
          workout.distance ? workout.distance * 0.6 : undefined,
          workout.intensity,
          workout.scheduledDate
        );
      } else if (adjustment === 'challenge') {
        // Upgrade to High Intensity
        const template = Math.random() > 0.5 ? WORKOUT_TEMPLATES.vo2Max : WORKOUT_TEMPLATES.threshold;

        await trainingPlansService.updateWorkout(
          workout.id,
          template.name,
          template.description,
          template.duration,
          undefined,
          'hard',
          workout.scheduledDate
        );
      }
    } catch (error) {
      console.error('Error adjusting workout:', error);
      throw error;
    }
  },

  getSuggestedWorkout(
    recoveryScore: number,
    acuteLoadRatio: number
  ): {
      type: Workout['intensity'];
      name: string;
      description: string;
      duration: number;
      reason: string;
  } {
      // 1. High Readiness & Safe Load -> INTENSITY
      if (recoveryScore >= 70 && acuteLoadRatio <= 1.3) {
          return {
              type: 'hard',
              name: '45m Tempo Intervals',
              description: 'Warm up 10m. 3 x 8m at Tempo (Zone 3) / Sweet Spot. 4m rest. Cool down 5m.',
              duration: 45,
              reason: 'High Readiness & Safe Load'
          };
      }

      // 2. Low Readiness OR High Load -> RECOVERY
      if (recoveryScore < 40 || acuteLoadRatio > 1.3) {
          return {
              type: 'recovery',
              name: '30m Active Recovery',
              description: 'Very light spin. Keep HR < 60% Max. Flush out the legs.',
              duration: 30,
              reason: recoveryScore < 40 ? 'Low Recovery Score' : 'High Training Load'
          };
      }

      // 3. Moderate -> ENDURANCE
      return {
          type: 'easy',
          name: '60m Zone 2 Ride',
          description: 'Steady endurance pace. Keep conversation feasible. Build base.',
          duration: 60,
          reason: 'Balanced State'
      };
  }
};
