import { supabase } from './supabaseClient';
import type { RecentActivityNote } from '../types';

const DEFAULT_WINDOW_DAYS = 30;

interface NoteRow {
  id: string;
  note: string;
  note_date: string;
  source: 'chat' | 'system';
  created_at: string;
}

function rowToNote(row: NoteRow): RecentActivityNote {
  return {
    id: row.id,
    note: row.note,
    noteDate: row.note_date,
    source: row.source,
    createdAt: new Date(row.created_at),
  };
}

function cutoffDateString(days: number): string {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return cutoff.toISOString().split('T')[0];
}

class RecentActivityNotesService {
  async list(days = DEFAULT_WINDOW_DAYS): Promise<RecentActivityNote[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('recent_activity_notes')
      .select('*')
      .eq('user_id', user.id)
      .gte('note_date', cutoffDateString(days))
      .order('note_date', { ascending: false });

    if (error) {
      console.error('Error fetching recent activity notes:', error);
      throw error;
    }

    return (data ?? []).map(row => rowToNote(row as NoteRow));
  }

  async add(
    note: string,
    noteDate?: string,
    source: 'chat' | 'system' = 'chat',
    sourceSessionId?: string,
  ): Promise<RecentActivityNote> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('recent_activity_notes')
      .insert({
        user_id: user.id,
        note,
        note_date: noteDate ?? new Date().toISOString().split('T')[0],
        source,
        source_session_id: sourceSessionId ?? null,
      })
      .select('*')
      .single();

    if (error) {
      console.error('Error adding recent activity note:', error);
      throw error;
    }

    return rowToNote(data as NoteRow);
  }

  /** Opportunistic storage hygiene — the 30-day filter in list() is the correctness guarantee. */
  async pruneExpired(days = DEFAULT_WINDOW_DAYS): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('recent_activity_notes')
      .delete()
      .eq('user_id', user.id)
      .lt('note_date', cutoffDateString(days));

    if (error) {
      console.error('Error pruning expired activity notes:', error);
    }
  }
}

export const recentActivityNotesService = new RecentActivityNotesService();
