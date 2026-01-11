import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recommendationService } from './recommendationService';
import { trainingPlansService } from './trainingPlansService';
import { Workout } from '../types';

// Mock trainingPlansService
vi.mock('./trainingPlansService', () => ({
  trainingPlansService: {
    updateWorkout: vi.fn(),
  },
}));

describe('recommendationService', () => {
  const mockWorkout: Workout = {
    id: 'test-workout-1',
    name: 'Standard Intervals',
    type: 'bike',
    description: '3x10min threshold',
    duration: 60,
    distance: 20000,
    intensity: 'moderate',
    scheduledDate: new Date('2024-01-01'),
    completed: false,
    status: 'planned',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('adjustDailyWorkout', () => {
    it('should replace with active recovery when adjustment is "rest"', async () => {
      await recommendationService.adjustDailyWorkout(mockWorkout, 'rest');

      expect(trainingPlansService.updateWorkout).toHaveBeenCalledWith(
        mockWorkout.id,
        'Active Recovery Spin',
        expect.stringContaining('Light spin'),
        45,
        undefined,
        'recovery',
        mockWorkout.scheduledDate
      );
    });

    it('should shorten duration and update title when adjustment is "shorten"', async () => {
      await recommendationService.adjustDailyWorkout(mockWorkout, 'shorten');

      const expectedDuration = 36; // 60 * 0.6
      expect(trainingPlansService.updateWorkout).toHaveBeenCalledWith(
        mockWorkout.id,
        'Standard Intervals [Short]',
        mockWorkout.description,
        expectedDuration,
        12000, // 20000 * 0.6
        mockWorkout.intensity,
        mockWorkout.scheduledDate
      );
    });

    it('should not shorten below 20 minutes', async () => {
      const shortWorkout = { ...mockWorkout, duration: 20 };
      await recommendationService.adjustDailyWorkout(shortWorkout, 'shorten');

      expect(trainingPlansService.updateWorkout).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        20, // Should stay 20
        expect.any(Number),
        expect.any(String),
        expect.any(Date)
      );
    });

    it('should upgrade to high intensity when adjustment is "challenge"', async () => {
      await recommendationService.adjustDailyWorkout(mockWorkout, 'challenge');

      expect(trainingPlansService.updateWorkout).toHaveBeenCalledWith(
        mockWorkout.id,
        expect.stringMatching(/VO2 Max Intervals|Threshold Builder/),
        expect.any(String),
        expect.any(Number),
        undefined,
        'hard',
        mockWorkout.scheduledDate
      );
    });
  });
});
