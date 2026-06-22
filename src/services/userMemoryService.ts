import { supabase } from './supabaseClient';
import { supabaseChatService } from './supabaseChatService';
import { dailyMetricsService } from './dailyMetricsService';
import type { ChatMessage, MemoryRollupInput, UserMemory } from '../types';

const HISTORY_BACKFILL_MESSAGE_CAP = 200;
const HISTORY_BACKFILL_ROLLUP_DAYS = 30;

interface MemoryRow {
  user_id: string;
  goals: string[];
  constraints: UserMemory['constraints'];
  preferences: UserMemory['preferences'];
  notable_patterns: UserMemory['notablePatterns'];
  narrative: string;
  previous_narrative: string | null;
  confidence_scores: UserMemory['confidenceScores'];
  source_session_ids: string[];
  updated_at: string;
  created_at: string;
}

function rowToMemory(row: MemoryRow): UserMemory {
  return {
    userId: row.user_id,
    goals: row.goals ?? [],
    constraints: row.constraints ?? {},
    preferences: row.preferences ?? {},
    notablePatterns: row.notable_patterns ?? [],
    narrative: row.narrative ?? '',
    previousNarrative: row.previous_narrative ?? undefined,
    confidenceScores: row.confidence_scores ?? { goals: 0, constraints: 0, preferences: 0 },
    sourceSessionIds: row.source_session_ids ?? [],
    updatedAt: new Date(row.updated_at),
    createdAt: new Date(row.created_at),
  };
}

export interface MergedMemory {
  goals: string[];
  constraints: UserMemory['constraints'];
  preferences: UserMemory['preferences'];
  notablePatterns: UserMemory['notablePatterns'];
  narrative: string;
  confidenceScores: UserMemory['confidenceScores'];
  changeSummary: string;
}

class UserMemoryService {
  private getEdgeFunctionUrl(): string {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error('Supabase URL not configured');
    }
    return `${supabaseUrl}/functions/v1/openai-update-memory`;
  }

  async getMemory(): Promise<UserMemory | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('user_memory')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching user memory:', error);
      throw error;
    }

    return data ? rowToMemory(data as MemoryRow) : null;
  }

  private async mergeWithAI(
    messages: ChatMessage[],
    existingMemory: UserMemory | null,
    rollup?: MemoryRollupInput,
  ): Promise<MergedMemory> {
    const response = await fetch(this.getEdgeFunctionUrl(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: messages.map(m => ({ id: m.id, role: m.role, content: m.content })),
        existingMemory: existingMemory
          ? {
              goals: existingMemory.goals,
              constraints: existingMemory.constraints,
              preferences: existingMemory.preferences,
              notablePatterns: existingMemory.notablePatterns,
              narrative: existingMemory.narrative,
              confidenceScores: existingMemory.confidenceScores,
            }
          : null,
        rollup: rollup ?? null,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to update memory');
    }

    return response.json();
  }

  /**
   * Re-reads the current DB row right before merging so a user's manual
   * edits (or another tab's update) are always the baseline the LLM merges from.
   */
  async updateMemoryFromSession(
    sessionId: string,
    messages: ChatMessage[],
    rollup?: MemoryRollupInput,
  ): Promise<UserMemory> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const existingMemory = await this.getMemory();
    const merged = await this.mergeWithAI(messages, existingMemory, rollup);

    const sourceSessionIds = Array.from(
      new Set([...(existingMemory?.sourceSessionIds ?? []), sessionId]),
    ).slice(-20);

    const { data, error } = await supabase
      .from('user_memory')
      .upsert({
        user_id: user.id,
        goals: merged.goals,
        constraints: merged.constraints,
        preferences: merged.preferences,
        notable_patterns: merged.notablePatterns,
        narrative: merged.narrative,
        previous_narrative: existingMemory?.narrative ?? null,
        confidence_scores: merged.confidenceScores,
        source_session_ids: sourceSessionIds,
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) {
      console.error('Error upserting user memory:', error);
      throw error;
    }

    const { error: auditError } = await supabase.from('user_memory_audit').insert({
      user_id: user.id,
      session_id: sessionId,
      change_summary: merged.changeSummary || 'Memory updated',
    });
    if (auditError) {
      console.error('Error inserting memory audit row:', auditError);
    }

    return rowToMemory(data as MemoryRow);
  }

  private buildRollupFromMetrics(dailyMetrics: { recovery_score?: number | null }[]): MemoryRollupInput | undefined {
    if (dailyMetrics.length === 0) return undefined;

    const recoveryScores = dailyMetrics
      .map(m => m.recovery_score)
      .filter((s): s is number => typeof s === 'number');

    if (recoveryScores.length === 0) {
      return { periodDays: dailyMetrics.length, activityCount: 0 };
    }

    const avgRecoveryScore = Math.round(
      recoveryScores.reduce((sum, s) => sum + s, 0) / recoveryScores.length,
    );

    const half = Math.floor(recoveryScores.length / 2);
    const recentAvg = recoveryScores.slice(0, half).reduce((s, v) => s + v, 0) / Math.max(half, 1);
    const olderAvg = recoveryScores.slice(half).reduce((s, v) => s + v, 0) / Math.max(recoveryScores.length - half, 1);
    const recoveryTrend: MemoryRollupInput['recoveryTrend'] =
      recentAvg - olderAvg > 5 ? 'improving' : olderAvg - recentAvg > 5 ? 'declining' : 'stable';

    return {
      periodDays: dailyMetrics.length,
      activityCount: 0,
      avgRecoveryScore,
      recoveryTrend,
    };
  }

  /**
   * Builds a one-time draft memory from the user's full chat history plus a
   * recent recovery rollup, without persisting anything. The caller (Settings
   * UI) shows this draft for review/edit before calling applyDraft().
   */
  async generateDraftFromHistory(): Promise<MergedMemory> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const sessions = await supabaseChatService.getSessions();
    const allMessages: ChatMessage[] = sessions
      .flatMap(s => s.messages)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .slice(-HISTORY_BACKFILL_MESSAGE_CAP);

    if (allMessages.length === 0) {
      throw new Error('No chat history found to generate memory from');
    }

    const [existingMemory, dailyMetrics] = await Promise.all([
      this.getMemory(),
      dailyMetricsService.getRecentMetrics(HISTORY_BACKFILL_ROLLUP_DAYS).catch(() => []),
    ]);

    return this.mergeWithAI(allMessages, existingMemory, this.buildRollupFromMetrics(dailyMetrics));
  }

  /**
   * Persists a previously generated (and possibly user-edited) draft as the
   * user's active memory, after they've reviewed it in Settings.
   */
  async applyDraft(draft: MergedMemory, sourceSessionIds: string[] = []): Promise<UserMemory> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const existingMemory = await this.getMemory();

    const { data, error } = await supabase
      .from('user_memory')
      .upsert({
        user_id: user.id,
        goals: draft.goals,
        constraints: draft.constraints,
        preferences: draft.preferences,
        notable_patterns: draft.notablePatterns,
        narrative: draft.narrative,
        previous_narrative: existingMemory?.narrative ?? null,
        confidence_scores: draft.confidenceScores,
        source_session_ids: sourceSessionIds.slice(-20),
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) {
      console.error('Error applying memory draft:', error);
      throw error;
    }

    const { error: auditError } = await supabase.from('user_memory_audit').insert({
      user_id: user.id,
      session_id: null,
      change_summary: draft.changeSummary || 'Initial memory generated from chat history',
    });
    if (auditError) {
      console.error('Error inserting memory audit row:', auditError);
    }

    return rowToMemory(data as MemoryRow);
  }

  async editMemory(partial: {
    goals?: string[];
    constraints?: UserMemory['constraints'];
    preferences?: UserMemory['preferences'];
    notablePatterns?: UserMemory['notablePatterns'];
    narrative?: string;
  }): Promise<UserMemory> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (partial.goals !== undefined) update.goals = partial.goals;
    if (partial.constraints !== undefined) update.constraints = partial.constraints;
    if (partial.preferences !== undefined) update.preferences = partial.preferences;
    if (partial.notablePatterns !== undefined) update.notable_patterns = partial.notablePatterns;
    if (partial.narrative !== undefined) update.narrative = partial.narrative;

    const { data, error } = await supabase
      .from('user_memory')
      .upsert({ user_id: user.id, ...update })
      .select('*')
      .single();

    if (error) {
      console.error('Error editing user memory:', error);
      throw error;
    }

    return rowToMemory(data as MemoryRow);
  }

  async clearMemory(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('user_memory')
      .delete()
      .eq('user_id', user.id);

    if (error) {
      console.error('Error clearing user memory:', error);
      throw error;
    }
  }
}

export const userMemoryService = new UserMemoryService();
