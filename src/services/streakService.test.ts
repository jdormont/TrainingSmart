
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { streakService, UserStreak } from './streakService';
import { supabase } from './supabaseClient';
import { format, subDays } from 'date-fns';

// Create a chainable mock object
const mockChain = {
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
    limit: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
};

// Mock Supabase client
vi.mock('./supabaseClient', () => ({
    supabase: {
        from: vi.fn(() => mockChain),
    },
}));

describe('StreakService', () => {
    const mockUserId = 'user-123';
    const today = format(new Date(), 'yyyy-MM-dd');
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

    beforeEach(() => {
        vi.clearAllMocks();
        mockChain.select.mockReturnValue(mockChain);
        mockChain.update.mockReturnValue(mockChain);
        mockChain.eq.mockReturnValue(mockChain);
        mockChain.insert.mockReturnValue(mockChain);
    });

    describe('getStreak', () => {
        it('should initialize and return new streak if no record exists', async () => {
            // 1. getStreak query -> Not Found
            mockChain.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });

            // 2. initializeStreak -> Insert -> Success
            // The service calls .from().insert().select().single()
            // We need to return expected data for the single() call after insert.

            const newStreak = {
                user_id: mockUserId,
                current_streak: 0,
                longest_streak: 0,
                streak_freezes: 0,
                last_activity_date: null,
                streak_history: [],
            };

            mockChain.single.mockResolvedValueOnce({ data: newStreak, error: null });

            const result = await streakService.getStreak(mockUserId);
            expect(result).toEqual(newStreak);
            expect(mockChain.insert).toHaveBeenCalled();
        });

        it('should return streak record if it exists', async () => {
            const mockStreak: UserStreak = {
                user_id: mockUserId,
                current_streak: 5,
                longest_streak: 10,
                streak_freezes: 2,
                last_activity_date: yesterday,
                streak_history: [],
            };

            mockChain.single.mockResolvedValueOnce({ data: mockStreak, error: null });

            const result = await streakService.getStreak(mockUserId);
            expect(result).toEqual(mockStreak);
        });
    });

    describe('validateAndSyncLikely', () => {
        it('should consume freezes to bridge a gap', async () => {
            // Gap of 2 days: Last activity 3 days ago (Gap = 2 missed days)
            const threeDaysAgo = format(subDays(new Date(), 3), 'yyyy-MM-dd');

            const mockStreak: UserStreak = {
                user_id: mockUserId,
                current_streak: 10,
                longest_streak: 10,
                streak_freezes: 3,
                last_activity_date: threeDaysAgo,
                streak_history: [],
            };

            // validateAndSyncLikely calls:
            // 1. getStreak -> single()
            // 2. update -> eq -> single()

            mockChain.single
                .mockResolvedValueOnce({ data: mockStreak, error: null }) // getStreak
                .mockResolvedValueOnce({
                    data: { ...mockStreak, streak_freezes: 1, last_activity_date: yesterday },
                    error: null
                }); // update()...single()

            // We run validateAndSyncLikely with TODAY
            const result = await streakService.validateAndSyncLikely(mockUserId, today);

            // Verify update was called. 
            expect(mockChain.update).toHaveBeenCalledWith(expect.objectContaining({
                streak_freezes: 1
            }));
        });

        it('should reset streak if gap is too large and not enough freezes', async () => {
            // Gap of 5 days, 1 freeze
            const sixDaysAgo = format(subDays(new Date(), 6), 'yyyy-MM-dd');

            const mockStreak: UserStreak = {
                user_id: mockUserId,
                current_streak: 10,
                longest_streak: 10,
                streak_freezes: 1,
                last_activity_date: sixDaysAgo,
                streak_history: [],
            };

            mockChain.single
                .mockResolvedValueOnce({ data: mockStreak, error: null }) // getStreak
                .mockResolvedValueOnce({
                    data: { ...mockStreak, current_streak: 0 },
                    error: null
                }); // update()...single()

            await streakService.validateAndSyncLikely(mockUserId, today);

            expect(mockChain.update).toHaveBeenCalledWith(expect.objectContaining({
                current_streak: 0
            }));
        });
    });
});
