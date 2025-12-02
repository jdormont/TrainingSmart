import { supabase } from './supabaseClient';
import type { TrainingPlan, Workout } from '../types';
import { STORAGE_KEYS } from '../utils/constants';

class TrainingPlansService {
  private async getCurrentUserId(): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  }

  private cleanDescription(description: string): string {
    if (!description) return description;

    let cleaned = description;

    const workoutsIndex = cleaned.toLowerCase().indexOf('workouts');
    if (workoutsIndex !== -1) {
      const beforeWorkouts = cleaned.substring(0, workoutsIndex);
      const afterWorkouts = cleaned.substring(workoutsIndex);

      const jsonStart = afterWorkouts.search(/```|^\s*\[|\{.*"name":/m);
      if (jsonStart !== -1) {
        cleaned = beforeWorkouts + afterWorkouts.substring(0, jsonStart);
      }
    }

    cleaned = cleaned
      .replace(/```json\s*[\s\S]*?\s*```/g, '')
      .replace(/```\s*[\s\S]*?\s*```/g, '')
      .replace(/\`\`\`json[\s\S]*$/g, '')
      .replace(/\[\s*\{[\s\S]*?\}\s*\]/g, '')
      .replace(/\{\s*"name"[\s\S]*$/g, '')
      .replace(/^Workouts:?\s*$/gim, '')
      .trim();

    return cleaned;
  }

  private dbPlanToTrainingPlan(dbPlan: any, workouts: any[]): TrainingPlan {
    const plan: TrainingPlan = {
      id: dbPlan.id,
      name: dbPlan.name,
      description: this.cleanDescription(dbPlan.description),
      goal: dbPlan.goal,
      startDate: new Date(dbPlan.start_date),
      endDate: new Date(dbPlan.end_date),
      createdAt: new Date(dbPlan.created_at),
      workouts: workouts.map(w => ({
        id: w.id,
        name: w.name,
        type: w.type as Workout['type'],
        description: w.description,
        duration: w.duration,
        distance: w.distance,
        intensity: w.intensity as Workout['intensity'],
        scheduledDate: new Date(w.scheduled_date),
        completed: w.completed,
        google_calendar_event_id: w.google_calendar_event_id
      }))
    };

    if (dbPlan.source_chat_session_id) {
      plan.sourceChatSessionId = dbPlan.source_chat_session_id;
    }

    if (dbPlan.chat_context_snapshot) {
      const snapshot = dbPlan.chat_context_snapshot;
      plan.chatContextSnapshot = {
        ...snapshot,
        extractedAt: new Date(snapshot.extractedAt)
      };
    }

    return plan;
  }

  async getPlans(): Promise<TrainingPlan[]> {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) {
        console.log('No user ID, loading from localStorage');
        return this.getLocalStoragePlans();
      }

      const { data: plans, error: plansError } = await supabase
        .from('training_plans')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (plansError) {
        console.error('Error fetching training plans:', plansError);
        return this.getLocalStoragePlans();
      }

      console.log(`Fetched ${plans?.length || 0} training plans from Supabase`);
      const trainingPlans: TrainingPlan[] = [];

      for (const plan of plans || []) {
        const { data: workouts, error: workoutsError } = await supabase
          .from('workouts')
          .select('*')
          .eq('plan_id', plan.id)
          .order('scheduled_date', { ascending: true });

        if (workoutsError) {
          console.error('Error fetching workouts for plan', plan.id, ':', workoutsError);
          continue;
        }

        console.log(`Plan "${plan.name}" (ID: ${plan.id}) has ${workouts?.length || 0} workouts`);
        trainingPlans.push(this.dbPlanToTrainingPlan(plan, workouts || []));
      }

      console.log(`Returning ${trainingPlans.length} training plans with workouts:`,
        trainingPlans.map(p => ({ name: p.name, workoutCount: p.workouts.length })));

      return trainingPlans;
    } catch (error) {
      console.error('Error in getPlans:', error);
      return this.getLocalStoragePlans();
    }
  }

  private getLocalStoragePlans(): TrainingPlan[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.TRAINING_PLANS);
      if (!stored) return [];

      const plans = JSON.parse(stored);
      return plans.map((plan: any) => ({
        ...plan,
        description: this.cleanDescription(plan.description),
        startDate: new Date(plan.startDate),
        endDate: new Date(plan.endDate),
        createdAt: new Date(plan.createdAt),
        workouts: plan.workouts.map((w: any) => ({
          ...w,
          scheduledDate: new Date(w.scheduledDate)
        }))
      }));
    } catch (error) {
      console.error('Error loading localStorage plans:', error);
      return [];
    }
  }

  async createPlan(plan: Omit<TrainingPlan, 'id' | 'createdAt'>): Promise<TrainingPlan> {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) {
        console.log('No user ID, creating plan in localStorage');
        return this.createLocalStoragePlan(plan);
      }

      console.log(`Creating plan "${plan.name}" with ${plan.workouts.length} workouts`);

      const insertData: any = {
        name: plan.name,
        description: plan.description,
        goal: plan.goal,
        start_date: plan.startDate.toISOString().split('T')[0],
        end_date: plan.endDate.toISOString().split('T')[0],
        user_id: userId
      };

      if (plan.sourceChatSessionId) {
        insertData.source_chat_session_id = plan.sourceChatSessionId;
      }

      if (plan.chatContextSnapshot) {
        insertData.chat_context_snapshot = plan.chatContextSnapshot;
      }

      const { data: newPlan, error: planError } = await supabase
        .from('training_plans')
        .insert(insertData)
        .select()
        .single();

      if (planError) {
        console.error('Error creating training plan:', planError);
        throw planError;
      }

      console.log(`Created plan with ID: ${newPlan.id}`);

      if (plan.workouts.length > 0) {
        const workoutsToInsert = plan.workouts.map(w => ({
          plan_id: newPlan.id,
          user_id: userId,
          name: w.name,
          type: w.type,
          description: w.description,
          duration: w.duration,
          distance: w.distance,
          intensity: w.intensity,
          scheduled_date: w.scheduledDate.toISOString().split('T')[0],
          completed: w.completed
        }));

        console.log(`Inserting ${workoutsToInsert.length} workouts for plan ${newPlan.id}`);

        const { data: insertedWorkouts, error: workoutsError } = await supabase
          .from('workouts')
          .insert(workoutsToInsert)
          .select();

        if (workoutsError) {
          console.error('Error creating workouts:', workoutsError);
        } else {
          console.log(`Successfully inserted ${insertedWorkouts?.length || 0} workouts`);
        }
      }

      const { data: workouts } = await supabase
        .from('workouts')
        .select('*')
        .eq('plan_id', newPlan.id)
        .order('scheduled_date', { ascending: true });

      console.log(`Fetched ${workouts?.length || 0} workouts for newly created plan`);

      const finalPlan = this.dbPlanToTrainingPlan(newPlan, workouts || []);
      console.log(`Returning plan with ${finalPlan.workouts.length} workouts`);

      return finalPlan;
    } catch (error) {
      console.error('Error in createPlan:', error);
      return this.createLocalStoragePlan(plan);
    }
  }

  private createLocalStoragePlan(plan: Omit<TrainingPlan, 'id' | 'createdAt'>): TrainingPlan {
    const newPlan: TrainingPlan = {
      id: Date.now().toString(),
      ...plan,
      createdAt: new Date()
    };

    const plans = this.getLocalStoragePlans();
    plans.push(newPlan);
    localStorage.setItem(STORAGE_KEYS.TRAINING_PLANS, JSON.stringify(plans));

    return newPlan;
  }

  async deletePlan(planId: string): Promise<void> {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) {
        return this.deleteLocalStoragePlan(planId);
      }

      const { error } = await supabase
        .from('training_plans')
        .delete()
        .eq('id', planId)
        .eq('user_id', userId);

      if (error) {
        console.error('Error deleting training plan:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error in deletePlan:', error);
      this.deleteLocalStoragePlan(planId);
    }
  }

  private deleteLocalStoragePlan(planId: string): void {
    const plans = this.getLocalStoragePlans();
    const filteredPlans = plans.filter(p => p.id !== planId);
    localStorage.setItem(STORAGE_KEYS.TRAINING_PLANS, JSON.stringify(filteredPlans));
  }

  async updateWorkoutCompletion(workoutId: string, completed: boolean): Promise<void> {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) {
        return this.updateLocalStorageWorkout(workoutId, completed);
      }

      const { error } = await supabase
        .from('workouts')
        .update({ completed })
        .eq('id', workoutId)
        .eq('user_id', userId);

      if (error) {
        console.error('Error updating workout:', error);
        throw error;
      }

      await supabase
        .from('training_plans')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', (
          await supabase
            .from('workouts')
            .select('plan_id')
            .eq('id', workoutId)
            .single()
        ).data?.plan_id);
    } catch (error) {
      console.error('Error in updateWorkoutCompletion:', error);
      this.updateLocalStorageWorkout(workoutId, completed);
    }
  }

  private updateLocalStorageWorkout(workoutId: string, completed: boolean): void {
    const plans = this.getLocalStoragePlans();
    const updatedPlans = plans.map(plan => ({
      ...plan,
      workouts: plan.workouts.map(w =>
        w.id === workoutId ? { ...w, completed } : w
      )
    }));
    localStorage.setItem(STORAGE_KEYS.TRAINING_PLANS, JSON.stringify(updatedPlans));
  }

  async updateWorkout(
    workoutId: string,
    name: string,
    description: string,
    duration: number,
    distance: number | undefined,
    intensity: Workout['intensity'],
    scheduledDate: Date
  ): Promise<void> {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) {
        return this.updateLocalStorageWorkoutFull(workoutId, name, description, duration, distance, intensity, scheduledDate);
      }

      const { error } = await supabase
        .from('workouts')
        .update({
          name,
          description,
          duration,
          distance,
          intensity,
          scheduled_date: scheduledDate.toISOString().split('T')[0]
        })
        .eq('id', workoutId)
        .eq('user_id', userId);

      if (error) {
        console.error('Error updating workout:', error);
        throw error;
      }

      await supabase
        .from('training_plans')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', (
          await supabase
            .from('workouts')
            .select('plan_id')
            .eq('id', workoutId)
            .single()
        ).data?.plan_id);
    } catch (error) {
      console.error('Error in updateWorkout:', error);
      this.updateLocalStorageWorkoutFull(workoutId, name, description, duration, distance, intensity, scheduledDate);
    }
  }

  private updateLocalStorageWorkoutFull(
    workoutId: string,
    name: string,
    description: string,
    duration: number,
    distance: number | undefined,
    intensity: Workout['intensity'],
    scheduledDate: Date
  ): void {
    const plans = this.getLocalStoragePlans();
    const updatedPlans = plans.map(plan => ({
      ...plan,
      workouts: plan.workouts.map(w =>
        w.id === workoutId ? { ...w, name, description, duration, distance, intensity, scheduledDate } : w
      )
    }));
    localStorage.setItem(STORAGE_KEYS.TRAINING_PLANS, JSON.stringify(updatedPlans));
  }

  async migrateLocalStorageToSupabase(): Promise<void> {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) {
        console.log('User not authenticated, skipping migration');
        return;
      }

      const localPlans = this.getLocalStoragePlans();
      if (localPlans.length === 0) {
        console.log('No local plans to migrate');
        return;
      }

      console.log(`Migrating ${localPlans.length} training plans to Supabase...`);

      for (const plan of localPlans) {
        const { data: newPlan, error: planError } = await supabase
          .from('training_plans')
          .insert({
            name: plan.name,
            description: plan.description,
            goal: plan.goal,
            start_date: plan.startDate.toISOString().split('T')[0],
            end_date: plan.endDate.toISOString().split('T')[0],
            user_id: userId,
            created_at: plan.createdAt.toISOString()
          })
          .select()
          .single();

        if (planError) {
          console.error('Error migrating plan:', planError);
          continue;
        }

        if (plan.workouts.length > 0) {
          const workoutsToInsert = plan.workouts.map(w => ({
            plan_id: newPlan.id,
            user_id: userId,
            name: w.name,
            type: w.type,
            description: w.description,
            duration: w.duration,
            distance: w.distance,
            intensity: w.intensity,
            scheduled_date: w.scheduledDate.toISOString().split('T')[0],
            completed: w.completed
          }));

          const { error: workoutsError } = await supabase
            .from('workouts')
            .insert(workoutsToInsert);

          if (workoutsError) {
            console.error('Error migrating workouts:', workoutsError);
          }
        }
      }

      console.log('Migration completed successfully');
    } catch (error) {
      console.error('Error during migration:', error);
    }
  }
}

export const trainingPlansService = new TrainingPlansService();
