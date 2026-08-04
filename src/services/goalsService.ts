import { supabase } from './supabaseClient';
import type { Goal, GoalSource, GoalStatus } from '../types';

interface GoalRow {
  id: string;
  user_id: string;
  status: GoalStatus;
  title: string;
  description: string | null;
  target_date: string | null;
  block_start_date: string | null;
  block_end_date: string | null;
  event_type: string | null;
  success_criteria: Goal['successCriteria'];
  confidence_score: number | null;
  source: GoalSource;
  source_session_ids: string[];
  closed_at: string | null;
  closed_reason: string | null;
  created_at: string;
  updated_at: string;
}

function rowToGoal(row: GoalRow): Goal {
  return {
    id: row.id,
    userId: row.user_id,
    status: row.status,
    title: row.title,
    description: row.description ?? undefined,
    targetDate: row.target_date ?? undefined,
    blockStartDate: row.block_start_date ?? undefined,
    blockEndDate: row.block_end_date ?? undefined,
    eventType: row.event_type ?? undefined,
    successCriteria: row.success_criteria ?? [],
    confidenceScore: row.confidence_score ?? undefined,
    source: row.source,
    sourceSessionIds: row.source_session_ids ?? [],
    closedAt: row.closed_at ? new Date(row.closed_at) : undefined,
    closedReason: row.closed_reason ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export interface NewGoalInput {
  title: string;
  description?: string;
  targetDate?: string;
  blockStartDate?: string;
  blockEndDate?: string;
  eventType?: string;
  successCriteria?: Goal['successCriteria'];
  source?: GoalSource;
}

class GoalsService {
  async getActiveGoal(): Promise<Goal | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (error) {
      console.error('Error fetching active goal:', error);
      throw error;
    }

    return data ? rowToGoal(data as GoalRow) : null;
  }

  async listGoalHistory(limit = 20): Promise<Goal[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', user.id)
      .neq('status', 'active')
      .order('closed_at', { ascending: false, nullsFirst: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching goal history:', error);
      throw error;
    }

    return (data ?? []).map(row => rowToGoal(row as GoalRow));
  }

  async createActiveGoal(input: NewGoalInput): Promise<Goal> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('goals')
      .insert({
        user_id: user.id,
        status: 'active',
        title: input.title,
        description: input.description ?? null,
        target_date: input.targetDate ?? null,
        block_start_date: input.blockStartDate ?? null,
        block_end_date: input.blockEndDate ?? null,
        event_type: input.eventType ?? null,
        success_criteria: input.successCriteria ?? [],
        source: input.source ?? 'manual',
      })
      .select('*')
      .single();

    if (error) {
      console.error('Error creating active goal:', error);
      throw error;
    }

    return rowToGoal(data as GoalRow);
  }

  async updateActiveGoal(
    id: string,
    patch: Partial<Pick<Goal, 'title' | 'description' | 'targetDate' | 'blockStartDate' | 'blockEndDate' | 'successCriteria' | 'confidenceScore'>>,
  ): Promise<Goal> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.title !== undefined) update.title = patch.title;
    if (patch.description !== undefined) update.description = patch.description;
    if (patch.targetDate !== undefined) update.target_date = patch.targetDate;
    if (patch.blockStartDate !== undefined) update.block_start_date = patch.blockStartDate;
    if (patch.blockEndDate !== undefined) update.block_end_date = patch.blockEndDate;
    if (patch.successCriteria !== undefined) update.success_criteria = patch.successCriteria;
    if (patch.confidenceScore !== undefined) update.confidence_score = patch.confidenceScore;

    const { data, error } = await supabase
      .from('goals')
      .update(update)
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .select('*')
      .single();

    if (error) {
      console.error('Error updating active goal:', error);
      throw error;
    }

    return rowToGoal(data as GoalRow);
  }

  async closeGoal(id: string, status: 'completed' | 'abandoned', reason?: string): Promise<Goal> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('goals')
      .update({
        status,
        closed_reason: reason ?? null,
        closed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .single();

    if (error) {
      console.error('Error closing goal:', error);
      throw error;
    }

    return rowToGoal(data as GoalRow);
  }

  /**
   * Atomically closes the current active goal (if any) and creates a new one,
   * via a Postgres function — two separate client calls would race against
   * the "one active goal per user" unique index.
   */
  async replaceActiveGoal(
    newGoal: NewGoalInput,
    closure?: { goalId: string; status: 'completed' | 'abandoned'; reason?: string },
  ): Promise<{ closed: Goal | null; created: Goal }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase.rpc('close_and_create_goal', {
      p_user_id: user.id,
      p_close_goal_id: closure?.goalId ?? null,
      p_close_status: closure?.status ?? null,
      p_close_reason: closure?.reason ?? null,
      p_new_title: newGoal.title,
      p_new_description: newGoal.description ?? null,
      p_new_target_date: newGoal.targetDate ?? null,
      p_new_block_start_date: newGoal.blockStartDate ?? null,
      p_new_block_end_date: newGoal.blockEndDate ?? null,
      p_new_event_type: newGoal.eventType ?? null,
      p_new_success_criteria: newGoal.successCriteria ?? [],
      p_new_source: newGoal.source ?? 'manual',
    });

    if (error) {
      console.error('Error replacing active goal:', error);
      throw error;
    }

    const created = rowToGoal(data as GoalRow);
    const closed = closure ? await this.getGoalById(closure.goalId) : null;

    return { closed, created };
  }

  private async getGoalById(id: string): Promise<Goal | null> {
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching goal by id:', error);
      return null;
    }

    return data ? rowToGoal(data as GoalRow) : null;
  }
}

export const goalsService = new GoalsService();
