import { supabase } from './supabaseClient';

/**
 * Tracks how many of a chat session's user messages have already been folded
 * into the athlete's durable profile (see athleteProfileService.mergeFromSession).
 * Persisted server-side (chat_sessions.memory_synced_message_count) rather than
 * kept only in a client ref, so a crashed tab, a session that ended one message
 * short of the sync threshold, or a different device all leave a durable
 * watermark that the next session activation can catch up from.
 */
class ChatMemorySyncStateService {
  async getSyncedMessageCount(sessionId: string): Promise<number> {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('memory_synced_message_count')
      .eq('id', sessionId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching memory sync watermark for session', sessionId, error);
      return 0;
    }

    return data?.memory_synced_message_count ?? 0;
  }

  /**
   * Only ever called after a merge into athlete_profile has actually
   * succeeded — never optimistically before the merge is attempted — so a
   * failed merge leaves the previous watermark in place for retry.
   */
  async setSyncedMessageCount(sessionId: string, count: number): Promise<void> {
    const { error } = await supabase
      .from('chat_sessions')
      .update({ memory_synced_message_count: count })
      .eq('id', sessionId);

    if (error) {
      console.error('Error persisting memory sync watermark for session', sessionId, error);
      throw error;
    }
  }
}

export const chatMemorySyncStateService = new ChatMemorySyncStateService();
