import { supabase } from './supabaseClient';
import type { FtpConfidence, FtpHistoryEntry, FtpSource } from '../types';

interface FtpHistoryRow {
  id: string;
  ftp_watts: number;
  effective_date: string;
  source: FtpSource;
  confidence: FtpConfidence;
  note: string | null;
  created_at: string;
}

function rowToEntry(row: FtpHistoryRow): FtpHistoryEntry {
  return {
    id: row.id,
    ftpWatts: row.ftp_watts,
    effectiveDate: row.effective_date,
    source: row.source,
    confidence: row.confidence,
    note: row.note ?? undefined,
    createdAt: new Date(row.created_at),
  };
}

export interface RecordFtpInput {
  ftpWatts: number;
  effectiveDate: string;
  source: FtpSource;
  confidence?: FtpConfidence;
  note?: string;
  sourceSessionId?: string;
}

class FtpHistoryService {
  async listHistory(limit = 50): Promise<FtpHistoryEntry[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('ftp_history')
      .select('*')
      .eq('user_id', user.id)
      .order('effective_date', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching FTP history:', error);
      throw error;
    }

    return (data ?? []).map(row => rowToEntry(row as FtpHistoryRow));
  }

  /**
   * Latest FTP by effective_date, preferring a confirmed value over an
   * estimated one when both share the same most-recent date.
   */
  async getCurrentFtp(): Promise<FtpHistoryEntry | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('ftp_history')
      .select('*')
      .eq('user_id', user.id)
      .order('effective_date', { ascending: false })
      .order('confidence', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching current FTP:', error);
      throw error;
    }

    return data ? rowToEntry(data as FtpHistoryRow) : null;
  }

  async recordFtp(entry: RecordFtpInput): Promise<FtpHistoryEntry> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('ftp_history')
      .upsert(
        {
          user_id: user.id,
          ftp_watts: entry.ftpWatts,
          effective_date: entry.effectiveDate,
          source: entry.source,
          confidence: entry.confidence ?? 'confirmed',
          note: entry.note ?? null,
          source_session_id: entry.sourceSessionId ?? null,
        },
        { onConflict: 'user_id,effective_date,source' },
      )
      .select('*')
      .single();

    if (error) {
      console.error('Error recording FTP entry:', error);
      throw error;
    }

    return rowToEntry(data as FtpHistoryRow);
  }
}

export const ftpHistoryService = new FtpHistoryService();
