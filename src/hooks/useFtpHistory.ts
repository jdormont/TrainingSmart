import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ftpHistoryService, type RecordFtpInput } from '../services/ftpHistoryService';

export const FTP_HISTORY_KEY = ['ftp-history'] as const;
export const CURRENT_FTP_KEY = ['current-ftp'] as const;

export const useFtpHistory = (limit?: number) => {
  return useQuery({
    queryKey: [...FTP_HISTORY_KEY, limit],
    queryFn: () => ftpHistoryService.listHistory(limit),
    staleTime: 300000,
  });
};

export const useCurrentFtp = () => {
  return useQuery({
    queryKey: CURRENT_FTP_KEY,
    queryFn: () => ftpHistoryService.getCurrentFtp(),
    staleTime: 300000,
  });
};

export function useRecordFtp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (entry: RecordFtpInput) => ftpHistoryService.recordFtp(entry),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FTP_HISTORY_KEY, exact: false });
      queryClient.invalidateQueries({ queryKey: CURRENT_FTP_KEY, exact: false });
    },
  });
}
