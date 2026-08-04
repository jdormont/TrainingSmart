/**
 * Confirm-first suggestions surfaced by the AI memory merge (goal completion,
 * FTP reports mentioned in chat) — never auto-applied. Persisted to
 * localStorage so the Settings UI can show them for accept/dismiss on next
 * visit, independent of which page triggered the chat session sync.
 */
import { STORAGE_KEYS } from './constants';

export interface PendingGoalCompletionSuggestion {
  id: string;
  type: 'goal_completion';
  createdAt: string;
  goalId: string;
  goalTitle: string;
  reason: string;
}

export interface PendingFtpReportSuggestion {
  id: string;
  type: 'ftp_report';
  createdAt: string;
  watts: number;
  effectiveDate: string;
  note?: string;
}

export type PendingMemorySuggestion = PendingGoalCompletionSuggestion | PendingFtpReportSuggestion;

// Distributes Omit across the union's members individually — a plain
// `Omit<PendingMemorySuggestion, 'id' | 'createdAt'>` collapses to the
// intersection of common keys instead, losing the discriminated-union shape.
type NewSuggestion<T> = T extends PendingMemorySuggestion ? Omit<T, 'id' | 'createdAt'> : never;

function read(): PendingMemorySuggestion[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PENDING_MEMORY_SUGGESTIONS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(suggestions: PendingMemorySuggestion[]): void {
  localStorage.setItem(STORAGE_KEYS.PENDING_MEMORY_SUGGESTIONS, JSON.stringify(suggestions));
}

export function getPendingSuggestions(): PendingMemorySuggestion[] {
  return read();
}

export function addPendingSuggestion(suggestion: NewSuggestion<PendingMemorySuggestion>): void {
  const existing = read();
  const next: PendingMemorySuggestion = {
    ...suggestion,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  } as PendingMemorySuggestion;
  write([...existing, next]);
}

export function removePendingSuggestion(id: string): void {
  write(read().filter(s => s.id !== id));
}
