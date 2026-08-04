import { useQuery } from '@tanstack/react-query';
import { recentActivityNotesService } from '../services/recentActivityNotesService';

export const RECENT_ACTIVITY_NOTES_KEY = ['recent-activity-notes'] as const;

export const useRecentActivityNotes = (days?: number) => {
  return useQuery({
    queryKey: [...RECENT_ACTIVITY_NOTES_KEY, days],
    queryFn: () => recentActivityNotesService.list(days),
    staleTime: 300000,
  });
};
