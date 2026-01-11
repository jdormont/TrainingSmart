import { supabase } from './supabaseClient';
import { DailyMetric, UserProfile, Workout } from '../types';

export const recommendationService = {
  async generateInstantWorkout(
    userProfile: UserProfile,
    dailyMetrics: DailyMetric
  ): Promise<Workout | null> {
    try {
      if (!dailyMetrics || dailyMetrics.recovery_score === undefined) {
        console.warn('Cannot generate instant workout: Missing recovery metrics');
        return null;
      }

      const recoveryScore = dailyMetrics.recovery_score;
      let workoutType: 'easy' | 'moderate' | 'hard' | 'recovery';
      let workoutName = '';
      let workoutDescription = '';
      let duration = 60; // minutes
      let type: Workout['type'] = 'bike'; // Default to bike for now

      // 1. Analyze Context & Select Workout
      if (recoveryScore >= 70) {
        // Fresh: Threshold or VO2 Max
        workoutType = 'hard';
        const isVo2 = Math.random() > 0.5;
        if (isVo2) {
            workoutName = 'VO2 Max Intervals';
            workoutDescription = 'High intensity intervals to boost your aerobic ceiling. Warm up for 15m, then 4x4m at 115% FTP with 4m rest. Cool down 15m.';
            duration = 60;
        } else {
            workoutName = 'Threshold Builder';
            workoutDescription = 'Sustained effort to increase your FTP. Warm up 15m, then 3x10m at 95-100% FTP with 5m rest. Cool down 15m.';
            duration = 75;
        }
      } else if (recoveryScore < 40) {
        // Fatigued: Active Recovery
        workoutType = 'recovery';
        workoutName = 'Active Recovery Spin';
        workoutDescription = 'Light spin to flush out legs. Keep heart rate below Zone 2. Focus on high cadence/low torque.';
        duration = 45;
      } else {
        // Neutral: Zone 2 Endurance
        workoutType = 'easy';
        workoutName = 'Zone 2 Endurance';
        workoutDescription = 'Steady state ride in Zone 2. Build aerobic base without excessive fatigue.';
        duration = 90;
      }

      // 2. Find or Create "Instant Workouts" Plan
      const userId = userProfile.user_id;
      let planId: string;

      const { data: plans, error: plansError } = await supabase
        .from('training_plans')
        .select('id')
        .eq('user_id', userId)
        .eq('name', 'Instant Workouts')
        .single();

      if (plansError && plansError.code !== 'PGRST116') { // PGRST116 is "no rows found" for single()
          console.error('Error fetching plan:', plansError);
          // Fallback? Assuming we can't proceed without a plan ID if db enforces it.
          // But maybe we should create one.
      }

      if (plans) {
          planId = plans.id;
      } else {
          // Create the plan
          const startDate = new Date().toISOString().split('T')[0];
          // End date far in future? Or end of year?
          const endDate = new Date(new Date().getFullYear(), 11, 31).toISOString().split('T')[0];

          const { data: newPlan, error: createError } = await supabase
              .from('training_plans')
              .insert({
                  name: 'Instant Workouts',
                  description: 'Container for generated instant workouts',
                  goal: 'General Fitness',
                  start_date: startDate,
                  end_date: endDate,
                  user_id: userId
              })
              .select('id')
              .single();

          if (createError || !newPlan) {
              console.error('Failed to create Instant Workouts plan', createError);
              throw new Error('Could not create plan container');
          }
          planId = newPlan.id;
      }

      // 3. Persist Workout
      const scheduledDate = new Date().toISOString().split('T')[0];
      
      const newWorkoutData = {
          plan_id: planId,
          user_id: userId,
          name: workoutName,
          type: type,
          description: workoutDescription,
          duration: duration,
          distance: 0,
          intensity: workoutType,
          scheduled_date: scheduledDate,
          completed: false
      };

      const { data: savedWorkout, error: saveError } = await supabase
          .from('workouts')
          .insert(newWorkoutData)
          .select()
          .single();

      if (saveError) {
          console.error('Error saving instant workout:', saveError);
          throw saveError;
      }

      // 4. Return Workout Object
      return {
          id: savedWorkout.id,
          name: savedWorkout.name,
          type: savedWorkout.type as Workout['type'],
          description: savedWorkout.description,
          duration: savedWorkout.duration,
          distance: savedWorkout.distance,
          intensity: savedWorkout.intensity as Workout['intensity'],
          scheduledDate: new Date(savedWorkout.scheduled_date),
          completed: savedWorkout.completed,
          status: savedWorkout.status || 'planned', // Handle missing status column gracefully if needed
          google_calendar_event_id: savedWorkout.google_calendar_event_id
      };

    } catch (error) {
      console.error('generateInstantWorkout error:', error);
      return null;
    }
  },

  async adjustDailyWorkout(
    workout: Workout,
    adjustment: 'rest' | 'shorten' | 'challenge'
  ): Promise<void> {
    try {
      console.log(`Adjusting workout ${workout.id} with intent: ${adjustment}`);
      const { trainingPlansService } = await import('./trainingPlansService');

      if (adjustment === 'rest') {
        // Replace with Active Recovery
        await trainingPlansService.updateWorkout(
          workout.id,
          'Active Recovery Spin',
          'Light spin to flush out legs. Keep heart rate below Zone 2. Focus on high cadence/low torque.',
          45,
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
        const isVo2 = Math.random() > 0.5;
        const newName = isVo2 ? 'VO2 Max Intervals' : 'Threshold Builder';
        const newDesc = isVo2 
          ? 'High intensity intervals to boost your aerobic ceiling. Warm up for 15m, then 4x4m at 115% FTP with 4m rest. Cool down 15m.'
          : 'Sustained effort to increase your FTP. Warm up 15m, then 3x10m at 95-100% FTP with 5m rest. Cool down 15m.';
        const newDuration = isVo2 ? 60 : 75;

        await trainingPlansService.updateWorkout(
          workout.id,
          newName,
          newDesc,
          newDuration,
          undefined,
          'hard',
          workout.scheduledDate
        );
      }
    } catch (error) {
      console.error('Error adjusting workout:', error);
      throw error;
    }
  }
};
