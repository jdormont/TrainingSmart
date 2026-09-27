import { supabase } from './supabaseClient';
import { supabaseChatService } from './supabaseChatService';
import { dailyMetricsService } from './dailyMetricsService';
import { goalsService } from './goalsService';
import { recentActivityNotesService } from './recentActivityNotesService';
import { memoryRollupService } from './memoryRollupService';
import { chatMemorySyncStateService } from './chatMemorySyncStateService';
import type { AthleteProfile, ChatMessage, Goal, MemoryRollupInput } from '../types';

const HISTORY_BACKFILL_MESSAGE_CAP = 200;
const HISTORY_BACKFILL_ROLLUP_DAYS = 30;

interface ProfileRow {
  user_id: string;
  constraints: AthleteProfile['constraints'];
  preferences: AthleteProfile['preferences'];
  notable_patterns: AthleteProfile['notablePatterns'];
  narrative: string;
  previous_narrative: string | null;
  confidence_scores: AthleteProfile['confidenceScores'];
  source_session_ids: string[];
  updated_at: string;
  created_at: string;
}

function rowToProfile(row: ProfileRow): AthleteProfile {
  return {
    userId: row.user_id,
    constraints: row.constraints ?? {},
    preferences: row.preferences ?? {},
    notablePatterns: row.notable_patterns ?? [],
    narrative: row.narrative ?? '',
    previousNarrative: row.previous_narrative ?? undefined,
    confidenceScores: row.confidence_scores ?? { constraints: 0, preferences: 0 },
    sourceSessionIds: row.source_session_ids ?? [],
    updatedAt: new Date(row.updated_at),
    createdAt: new Date(row.created_at),
  };
}

export interface MergedProfile {
  constraints: AthleteProfile['constraints'];
  preferences: AthleteProfile['preferences'];
  notablePatterns: AthleteProfile['notablePatterns'];
  narrative: string;
  confidenceScores: AthleteProfile['confidenceScores'];
  changeSummary: string;
}

export interface GoalCompletionSuggestion {
  reason: string;
}

export interface FtpReportSuggestion {
  watts: number;
  effectiveDate: string;
  note?: string;
}

export interface MergeFromSessionResult {
  profile: AthleteProfile;
  goalCompletionSuggested: GoalCompletionSuggestion | null;
  ftpReportSuggested: FtpReportSuggestion | null;
}

interface EdgeMergeResponse {
  profile: MergedProfile;
  recentActivityNotes?: Array<{ note: string; noteDate?: string }>;
  activeGoalPatch?: Partial<Pick<Goal, 'targetDate' | 'blockStartDate' | 'blockEndDate' | 'description'>> | null;
  goalCompletionSuggested?: GoalCompletionSuggestion | null;
  ftpReportSuggested?: FtpReportSuggestion | null;
  changeSummary?: string;
}

class AthleteProfileService {
  private getEdgeFunctionUrl(): string {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error('Supabase URL not configured');
    }
    return `${supabaseUrl}/functions/v1/openai-update-memory`;
  }

  async getProfile(): Promise<AthleteProfile | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('athlete_profile')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching athlete profile:', error);
      throw error;
    }

    return data ? rowToProfile(data as ProfileRow) : null;
  }

  private async mergeWithAI(
    messages: ChatMessage[],
    existingProfile: AthleteProfile | null,
    activeGoal: Goal | null,
    rollup?: MemoryRollupInput,
  ): Promise<EdgeMergeResponse> {
    const response = await fetch(this.getEdgeFunctionUrl(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: messages.map(m => ({ id: m.id, role: m.role, content: m.content })),
        existingProfile: existingProfile
          ? {
              constraints: existingProfile.constraints,
              preferences: existingProfile.preferences,
              notablePatterns: existingProfile.notablePatterns,
              narrative: existingProfile.narrative,
              confidenceScores: existingProfile.confidenceScores,
            }
          : null,
        activeGoal: activeGoal
          ? {
              title: activeGoal.title,
              description: activeGoal.description,
              targetDate: activeGoal.targetDate,
              blockStartDate: activeGoal.blockStartDate,
              blockEndDate: activeGoal.blockEndDate,
            }
          : null,
        rollup: rollup ?? null,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to update profile');
    }

    return response.json();
  }

  /**
   * Re-reads the current DB row right before merging so a user's manual
   * edits (or another tab's update) are always the baseline the LLM merges from.
   * Applies additive recentActivityNotes and a narrow activeGoalPatch (if any)
   * as side effects, but never creates/closes a goal — those stay user-confirmed.
   */
  async mergeFromSession(
    sessionId: string,
    messages: ChatMessage[],
    rollup?: MemoryRollupInput,
  ): Promise<MergeFromSessionResult> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const [existingProfile, activeGoal] = await Promise.all([
      this.getProfile(),
      goalsService.getActiveGoal(),
    ]);

    const merged = await this.mergeWithAI(messages, existingProfile, activeGoal, rollup);

    const sourceSessionIds = Array.from(
      new Set([...(existingProfile?.sourceSessionIds ?? []), sessionId]),
    ).slice(-20);

    const { data, error } = await supabase
      .from('athlete_profile')
      .upsert({
        user_id: user.id,
        constraints: merged.profile.constraints,
        preferences: merged.profile.preferences,
        notable_patterns: merged.profile.notablePatterns,
        narrative: merged.profile.narrative,
        previous_narrative: existingProfile?.narrative ?? null,
        confidence_scores: merged.profile.confidenceScores,
        source_session_ids: sourceSessionIds,
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) {
      console.error('Error upserting athlete profile:', error);
      throw error;
    }

    const { error: auditError } = await supabase.from('user_memory_audit').insert({
      user_id: user.id,
      session_id: sessionId,
      change_summary: merged.changeSummary || 'Profile updated',
    });
    if (auditError) {
      console.error('Error inserting profile audit row:', auditError);
    }

    // Only recorded once the merge above has actually succeeded, so a failed
    // merge leaves the previous watermark in place for the caller to retry —
    // see chatMemorySyncStateService for why this can't be advanced up front.
    const syncedUserMessageCount = messages.filter(m => m.role === 'user').length;
    await chatMemorySyncStateService.setSyncedMessageCount(sessionId, syncedUserMessageCount).catch(err =>
      console.error('Error persisting memory sync watermark:', err),
    );

    if (merged.recentActivityNotes && merged.recentActivityNotes.length > 0) {
      await Promise.all(
        merged.recentActivityNotes.map(n =>
          recentActivityNotesService.add(n.note, n.noteDate, 'chat', sessionId).catch(err =>
            console.error('Error adding recent activity note:', err),
          ),
        ),
      );
    }

    if (activeGoal && merged.activeGoalPatch && Object.keys(merged.activeGoalPatch).length > 0) {
      await goalsService.updateActiveGoal(activeGoal.id, merged.activeGoalPatch).catch(err =>
        console.error('Error applying active goal patch:', err),
      );
    }

    return {
      profile: rowToProfile(data as ProfileRow),
      goalCompletionSuggested: merged.goalCompletionSuggested ?? null,
      ftpReportSuggested: merged.ftpReportSuggested ?? null,
    };
  }

  /**
   * Builds a one-time draft profile from the user's full chat history plus a
   * recent recovery rollup, without persisting anything. The caller (Settings
   * UI) shows this draft for review/edit before calling applyDraft().
   */
  async generateDraftFromHistory(): Promise<MergedProfile> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const sessions = await supabaseChatService.getSessions();
    const allMessages: ChatMessage[] = sessions
      .flatMap(s => s.messages)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .slice(-HISTORY_BACKFILL_MESSAGE_CAP);

    if (allMessages.length === 0) {
      throw new Error('No chat history found to generate profile from');
    }

    const [existingProfile, activeGoal, dailyMetrics] = await Promise.all([
      this.getProfile(),
      goalsService.getActiveGoal(),
      dailyMetricsService.getRecentMetrics(HISTORY_BACKFILL_ROLLUP_DAYS).catch(() => []),
    ]);

    const rollup = await memoryRollupService.buildRollup(dailyMetrics, HISTORY_BACKFILL_ROLLUP_DAYS);
    const merged = await this.mergeWithAI(allMessages, existingProfile, activeGoal, rollup);
    return merged.profile;
  }

  /**
   * Persists a previously generated (and possibly user-edited) draft as the
   * user's active profile, after they've reviewed it in Settings.
   */
  async applyDraft(draft: MergedProfile, sourceSessionIds: string[] = []): Promise<AthleteProfile> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const existingProfile = await this.getProfile();

    const { data, error } = await supabase
      .from('athlete_profile')
      .upsert({
        user_id: user.id,
        constraints: draft.constraints,
        preferences: draft.preferences,
        notable_patterns: draft.notablePatterns,
        narrative: draft.narrative,
        previous_narrative: existingProfile?.narrative ?? null,
        confidence_scores: draft.confidenceScores,
        source_session_ids: sourceSessionIds.slice(-20),
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) {
      console.error('Error applying profile draft:', error);
      throw error;
    }

    const { error: auditError } = await supabase.from('user_memory_audit').insert({
      user_id: user.id,
      session_id: null,
      change_summary: draft.changeSummary || 'Initial profile generated from chat history',
    });
    if (auditError) {
      console.error('Error inserting profile audit row:', auditError);
    }

    return rowToProfile(data as ProfileRow);
  }

  async editProfile(partial: {
    constraints?: AthleteProfile['constraints'];
    preferences?: AthleteProfile['preferences'];
    notablePatterns?: AthleteProfile['notablePatterns'];
    narrative?: string;
  }): Promise<AthleteProfile> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (partial.constraints !== undefined) update.constraints = partial.constraints;
    if (partial.preferences !== undefined) update.preferences = partial.preferences;
    if (partial.notablePatterns !== undefined) update.notable_patterns = partial.notablePatterns;
    if (partial.narrative !== undefined) update.narrative = partial.narrative;

    const { data, error } = await supabase
      .from('athlete_profile')
      .upsert({ user_id: user.id, ...update })
      .select('*')
      .single();

    if (error) {
      console.error('Error editing athlete profile:', error);
      throw error;
    }

    return rowToProfile(data as ProfileRow);
  }

  async clearProfile(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('athlete_profile')
      .delete()
      .eq('user_id', user.id);

    if (error) {
      console.error('Error clearing athlete profile:', error);
      throw error;
    }
  }
}

export const athleteProfileService = new AthleteProfileService();
