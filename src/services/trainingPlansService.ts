import { supabase } from './supabaseClient';
import type { TrainingPlan, Workout } from '../types';
import { STORAGE_KEYS } from '../utils/constants';

interface DbTrainingPlan {
  id: string;
  name: string;
  description: string;
  goal: string;
  start_date: string;
  end_date: string;
  created_at: string;
  source_chat_session_id?: string;
  chat_context_snapshot?: Record<string, unknown>;
  user_id: string;
}

interface DbWorkout {
  id: string;
  name: string;
  type: string;
  description: string;
  duration: number;
  distance: number;
  intensity: string;
  scheduled_date: string;
  completed: boolean;
  status: 'planned' | 'completed' | 'skipped';
  google_calendar_event_id?: string;
  plan_id: string;
  user_id: string;
}

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
      .replace(/```json[\s\S]*$/g, '')
      .replace(/\[\s*\{[\s\S]*?\}\s*\]/g, '')
      .replace(/\{\s*"name"[\s\S]*$/g, '')
      .replace(/^Workouts:?\s*$/gim, '')
      .trim();

    return cleaned;
  }

  private sanitizeIntensity(intensity: string): Workout['intensity'] {
    const validIntensities: Workout['intensity'][] = ['easy', 'moderate', 'hard', 'recovery'];
    const normalized = intensity?.toLowerCase().trim();

    if (validIntensities.includes(normalized as Workout['intensity'])) {
      return normalized as Workout['intensity'];
    }

    // Map common variations
    if (normalized === 'rest' || normalized === 'light') return 'recovery';
    if (normalized === 'medium' || normalized === 'tempo') return 'moderate';
    if (normalized === 'vigorous' || normalized === 'intense' || normalized === 'threshold' || normalized === 'vo2max') return 'hard';
    if (normalized === 'base' || normalized === 'zone2') return 'easy';

    // Default fallback
    return 'moderate';
  }

  private dbPlanToTrainingPlan(dbPlan: DbTrainingPlan, workouts: DbWorkout[]): TrainingPlan {
    const plan: TrainingPlan = {
      id: dbPlan.id,
      name: dbPlan.name,
      description: this.cleanDescription(dbPlan.description),
      goal: dbPlan.goal,
      startDate: new Date(dbPlan.start_date + 'T00:00:00'),
      endDate: new Date(dbPlan.end_date + 'T00:00:00'),
      createdAt: new Date(dbPlan.created_at),
      workouts: workouts.map(w => ({
        id: w.id,
        name: w.name,
        type: w.type as Workout['type'],
        description: w.description,
        duration: w.duration,
        distance: w.distance,
        intensity: w.intensity as Workout['intensity'],
        scheduledDate: new Date(w.scheduled_date + 'T00:00:00'),
        completed: w.completed, // Keep for backward compatibility view
        // If completed boolean is true, force status to completed. Otherwise use status or default.
        status: w.completed ? 'completed' : (w.status || 'planned'),
        google_calendar_event_id: w.google_calendar_event_id
      }))
    };

    if (dbPlan.source_chat_session_id) {
      plan.sourceChatSessionId = dbPlan.source_chat_session_id;
    }

    if (dbPlan.chat_context_snapshot) {
      const snapshot = dbPlan.chat_context_snapshot as { extractedAt: string | number | Date;[key: string]: unknown };
      plan.chatContextSnapshot = {
        ...snapshot,
        extractedAt: new Date(snapshot.extractedAt)
      } as any; // Cast to satisfy TrainingPlan type which expects ChatContextSnapshot
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
        .select('*, workouts(*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (plansError) {
        console.error('Error fetching training plans:', plansError);
        return this.getLocalStoragePlans();
      }

      console.log(`Fetched ${plans?.length || 0} training plans from Supabase`);
      
      const trainingPlans = (plans || []).map(plan => {
          // Sort workouts by date as potential join order isn't guaranteed (though usually is)
          const sortedWorkouts = (plan.workouts || []).sort((a: any, b: any) => 
            new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime()
          );
          
          return this.dbPlanToTrainingPlan(plan, sortedWorkouts);
      });

      console.log(`Returning ${trainingPlans.length} training plans`);
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

      const plans = JSON.parse(stored) as TrainingPlan[]; // Assert specific type
      return plans.map((plan) => ({
        ...plan,
        description: this.cleanDescription(plan.description),
        startDate: new Date(plan.startDate),
        endDate: new Date(plan.endDate),
        createdAt: new Date(plan.createdAt),
        workouts: plan.workouts.map((w) => ({
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

      const insertData: Record<string, string | number | boolean | null | Record<string, unknown>> = {
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
        insertData.chat_context_snapshot = plan.chatContextSnapshot as unknown as Record<string, unknown>;
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
        const workoutsToInsert = plan.workouts
          .filter(w => w.type !== 'rest' && !w.name.toLowerCase().includes('rest day')) // Filter out rest days
          .map(w => ({
            plan_id: newPlan.id,
            user_id: userId,
            name: w.name,
            type: w.type,
            description: w.description,
            duration: w.duration,
            distance: w.distance,
            intensity: this.sanitizeIntensity(w.intensity),
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

  async updateWorkoutStatus(workoutId: string, status: 'planned' | 'completed' | 'skipped'): Promise<void> {
    try {
      const userId = await this.getCurrentUserId();
      // Calculate completed boolean for backward compat
      const completed = status === 'completed';

      if (!userId) {
        return this.updateLocalStorageWorkoutStatus(workoutId, status);
      }

      const { error } = await supabase
        .from('workouts')
        .update({
          // status, // Column does not exist in DB
          completed // Sync boolean
        })
        .eq('id', workoutId)
        .eq('user_id', userId);

      if (error) {
        console.error('Error updating workout status:', error);
        throw error;
      }

      await this.touchPlanUpdatedAt(workoutId);
    } catch (error) {
      console.error('Error in updateWorkoutStatus:', error);
      this.updateLocalStorageWorkoutStatus(workoutId, status);
    }
  }

  // Helper to update plan timestamp
  private async touchPlanUpdatedAt(workoutId: string) {
    const { data } = await supabase
      .from('workouts')
      .select('plan_id')
      .eq('id', workoutId)
      .single();

    if (data?.plan_id) {
      await supabase
        .from('training_plans')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', data.plan_id);
    }
  }

  // Legacy boolean method wrapper
  async updateWorkoutCompletion(workoutId: string, completed: boolean): Promise<void> {
    return this.updateWorkoutStatus(workoutId, completed ? 'completed' : 'planned');
  }

  private updateLocalStorageWorkoutStatus(workoutId: string, status: 'planned' | 'completed' | 'skipped'): void {
    const plans = this.getLocalStoragePlans();
    const updatedPlans = plans.map(plan => ({
      ...plan,
      workouts: plan.workouts.map(w =>
        w.id === workoutId ? { ...w, status, completed: status === 'completed' } : w
      )
    }));
    localStorage.setItem(STORAGE_KEYS.TRAINING_PLANS, JSON.stringify(updatedPlans));
  }

  async deleteWorkout(workoutId: string): Promise<void> {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) {
        return this.deleteLocalStorageWorkout(workoutId);
      }

      // Get plan ID first for timestamp update
      const { data } = await supabase
        .from('workouts')
        .select('plan_id')
        .eq('id', workoutId)
        .single();

      const { error } = await supabase
        .from('workouts')
        .delete()
        .eq('id', workoutId)
        .eq('user_id', userId);

      if (error) throw error;

      if (data?.plan_id) {
        await supabase
          .from('training_plans')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', data.plan_id);
      }
    } catch (error) {
      console.error('Error deleting workout:', error);
      this.deleteLocalStorageWorkout(workoutId);
    }
  }

  private deleteLocalStorageWorkout(workoutId: string): void {
    const plans = this.getLocalStoragePlans();
    const updatedPlans = plans.map(plan => ({
      ...plan,
      workouts: plan.workouts.filter(w => w.id !== workoutId)
    }));
    localStorage.setItem(STORAGE_KEYS.TRAINING_PLANS, JSON.stringify(updatedPlans));
  }

  async addPlaceholderWorkout(planId: string, scheduledDate: Date): Promise<Workout> {
    try {
      const userId = await this.getCurrentUserId();

      const newWorkout: Partial<DbWorkout> = {
        plan_id: planId,
        user_id: userId || 'local',
        name: 'New Workout',
        type: 'bike',
        description: 'Add description...',
        duration: 60,
        distance: 0,
        intensity: 'moderate',
        scheduled_date: scheduledDate.toISOString().split('T')[0],
        completed: false
        // status: 'planned' // Column does not exist
      };

      if (!userId) {
        return this.addLocalStorageWorkout(planId, newWorkout);
      }

      const { data, error } = await supabase
        .from('workouts')
        .insert(newWorkout)
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        name: data.name,
        type: data.type as Workout['type'],
        description: data.description,
        duration: data.duration,
        distance: data.distance,
        intensity: data.intensity as Workout['intensity'],
        scheduledDate: new Date(data.scheduled_date),
        completed: data.completed,
        status: data.status as Workout['status'],
        google_calendar_event_id: data.google_calendar_event_id
      };

    } catch (error) {
      console.error('Error adding placeholder workout:', error);
      throw error;
    }
  }

  private addLocalStorageWorkout(planId: string, workoutData: any): Workout {
    const plans = this.getLocalStoragePlans();
    const planIndex = plans.findIndex(p => p.id === planId);
    if (planIndex === -1) throw new Error('Plan not found');

    const newWorkout: Workout = {
      id: Date.now().toString(),
      name: workoutData.name,
      type: workoutData.type,
      description: workoutData.description,
      duration: workoutData.duration,
      distance: workoutData.distance,
      intensity: workoutData.intensity,
      scheduledDate: new Date(workoutData.scheduled_date),
      completed: false,
      status: 'planned'
    };

    plans[planIndex].workouts.push(newWorkout);
    localStorage.setItem(STORAGE_KEYS.TRAINING_PLANS, JSON.stringify(plans));
    return newWorkout;
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
          intensity: this.sanitizeIntensity(intensity),
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

  async getNextUpcomingWorkout(): Promise<Workout | null> {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) {
        // Local storage fallback
        const plans = this.getLocalStoragePlans();
        const allWorkouts = plans.flatMap(p => p.workouts);
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        const upcoming = allWorkouts
          .filter(w => !w.completed && w.status !== 'completed' && w.status !== 'skipped' && new Date(w.scheduledDate) >= now)
          .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());

        return upcoming.length > 0 ? upcoming[0] : null;
      }

      // Get today's date in YYYY-MM-DD format for comparison
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('workouts')
        .select('*')
        .eq('user_id', userId)
        .gte('scheduled_date', today)
        .eq('completed', false)
        // .neq('status', 'skipped') // status column doesn't exist in DB yet based on previous file analysis
        .order('scheduled_date', { ascending: true })
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') { // No rows found
          return null;
        }
        console.error('Error fetching next workout:', error);
        return null;
      }

      if (!data) return null;

      return {
        id: data.id,
        name: data.name,
        type: data.type as Workout['type'],
        description: data.description,
        duration: data.duration,
        distance: data.distance,
        intensity: data.intensity as Workout['intensity'],
        scheduledDate: new Date(data.scheduled_date + 'T00:00:00'),
        completed: data.completed,
        status: data.completed ? 'completed' : (data.status || 'planned'),
        google_calendar_event_id: data.google_calendar_event_id
      };
    } catch (error) {
      console.error('Error in getNextUpcomingWorkout:', error);
      return null;
    }
  }

  async addWorkoutToPlan(planId: string, workout: Partial<DbWorkout>): Promise<Workout> {
    try {
      const userId = await this.getCurrentUserId();
      
      // Sanitize payload to match DB schema (snake_case) and remove camelCase
      const dbPayload: any = {
        plan_id: planId,
        user_id: userId || 'local',
        name: workout.name,
        type: workout.type,
        description: workout.description,
        duration: workout.duration,
        distance: workout.distance,
        intensity: workout.intensity,
        completed: false,
        // status: workout.status || 'planned', // status column does not exist in DB
        scheduled_date: (workout as any).scheduled_date || 
                       ((workout as any).scheduledDate ? new Date((workout as any).scheduledDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0])
      };
      
      // Remove undefined keys
      Object.keys(dbPayload).forEach(key => dbPayload[key] === undefined && delete dbPayload[key]);

      if (!userId) {
        return this.addLocalStorageWorkout(planId, dbPayload);
      }

      const { data, error } = await supabase
        .from('workouts')
        .insert(dbPayload)
        .select()
        .single();

      if (error) throw error;

      await this.touchPlanUpdatedAt(data.id);

      return {
        id: data.id,
        name: data.name,
        type: data.type as Workout['type'],
        description: data.description,
        duration: data.duration,
        distance: data.distance,
        intensity: data.intensity as Workout['intensity'],
        scheduledDate: new Date(data.scheduled_date),
        completed: data.completed,
        status: data.status as Workout['status'],
        google_calendar_event_id: data.google_calendar_event_id
      };
    } catch (error) {
      console.error('Error adding workout to plan:', error);
      throw error;
    }
  }

  async ensureActivePlan(forceUserId?: string): Promise<string> {
    try {
      const userId = forceUserId || await this.getCurrentUserId();
      if (!userId) {
        // Use local storage plan or create one
        const plans = this.getLocalStoragePlans();
        if (plans.length > 0) return plans[0].id; // Just return first plan
        
        // Create default local plan
        const newPlan = await this.createLocalStoragePlan({
           name: 'My Training Plan',
           description: 'General training plan',
           goal: 'Fitness',
           startDate: new Date(),
           endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
           workouts: []
        });
        return newPlan.id;
      }

      // 1. Try to find the most recently created plan
      const { data: plans } = await supabase
        .from('training_plans')
        .select('id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (plans && plans.length > 0) {
        return plans[0].id;
      }

      // 2. If no plan, create a default "General Training" plan
      const { data: newPlan, error } = await supabase
        .from('training_plans')
        .insert({
          name: 'General Training',
          description: 'A container for your manual workouts.',
          goal: 'General Fitness',
          start_date: new Date().toISOString().split('T')[0],
          end_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
          user_id: userId
        })
        .select('id')
        .single();

      if (error) throw error;
      return newPlan.id;

    } catch (error) {
      console.error('Error in ensureActivePlan:', error);
      throw error;
    }
  }
}

export const trainingPlansService = new TrainingPlansService();
