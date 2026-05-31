import { describe, it, expect } from 'vitest';
import { trainingPlansService } from './trainingPlansService';
import type { Workout } from '../types';

describe('calculateMatchConfidence', () => {
  const baseWorkout: Workout = {
    id: 'workout-123',
    name: 'Tempo Ride',
    type: 'bike',
    description: 'Sweet spot intervals',
    duration: 60, // 60 minutes = 3600 seconds
    distance: 30000, // 30km = 30000 meters
    intensity: 'hard',
    scheduledDate: new Date('2026-06-01T00:00:00'),
    completed: false,
    status: 'planned'
  };

  it('calculates 100 for a perfect match', () => {
    const activity = {
      type: 'Ride',
      start_date_local: '2026-06-01T10:00:00',
      moving_time: 3600, // exactly 60 mins
      distance: 30000 // exactly 30km
    };

    const score = trainingPlansService.calculateMatchConfidence(baseWorkout, activity);
    expect(score).toBe(100);
  });

  it('penalizes date differences correctly', () => {
    // 1 day difference -> 30/40 date score (loses 10 points)
    const activity1Day = {
      type: 'Ride',
      start_date_local: '2026-06-02T10:00:00',
      moving_time: 3600,
      distance: 30000
    };
    expect(trainingPlansService.calculateMatchConfidence(baseWorkout, activity1Day)).toBe(90);

    // 3 days difference -> 10/40 date score (loses 30 points)
    const activity3Day = {
      type: 'Ride',
      start_date_local: '2026-05-29T18:00:00',
      moving_time: 3600,
      distance: 30000
    };
    expect(trainingPlansService.calculateMatchConfidence(baseWorkout, activity3Day)).toBe(70);

    // 4 days difference -> 0/40 date score (loses 40 points)
    const activity4Day = {
      type: 'Ride',
      start_date_local: '2026-06-05T09:00:00',
      moving_time: 3600,
      distance: 30000
    };
    expect(trainingPlansService.calculateMatchConfidence(baseWorkout, activity4Day)).toBe(60);
  });

  it('normalizes activity types and penalizes mismatch', () => {
    // Workout type is 'bike', Strava activity is 'VirtualRide' -> matches
    const virtualRide = {
      type: 'VirtualRide',
      start_date_local: '2026-06-01T10:00:00',
      moving_time: 3600,
      distance: 30000
    };
    expect(trainingPlansService.calculateMatchConfidence(baseWorkout, virtualRide)).toBe(100);

    // Mismatched type ('Run') -> loses 30 points
    const runningActivity = {
      type: 'Run',
      start_date_local: '2026-06-01T10:00:00',
      moving_time: 3600,
      distance: 30000
    };
    expect(trainingPlansService.calculateMatchConfidence(baseWorkout, runningActivity)).toBe(70);
  });

  it('scales duration similarity correctly', () => {
    // Moving time is 45 mins (planned 60 mins) -> 25% deviation.
    // Duration score: 15 * (1 - 0.25) = 11.25. (Loses 3.75 points)
    const activityShort = {
      type: 'Ride',
      start_date_local: '2026-06-01T10:00:00',
      moving_time: 2700, // 45 mins
      distance: 30000
    };
    expect(trainingPlansService.calculateMatchConfidence(baseWorkout, activityShort)).toBe(96.25);

    // Moving time is double (120 mins) -> 100% deviation.
    // Duration score: 0. (Loses 15 points)
    const activityLong = {
      type: 'Ride',
      start_date_local: '2026-06-01T10:00:00',
      moving_time: 7200, // 120 mins
      distance: 30000
    };
    expect(trainingPlansService.calculateMatchConfidence(baseWorkout, activityLong)).toBe(85);
  });

  it('scales distance similarity within 20% tolerance', () => {
    // Distance is 27000m (10% difference) -> half of 20% tolerance.
    // Distance score: 15 * (1 - 0.10/0.20) = 7.5. (Loses 7.5 points)
    const activityDiffDist = {
      type: 'Ride',
      start_date_local: '2026-06-01T10:00:00',
      moving_time: 3600,
      distance: 27000 // 10% diff
    };
    expect(trainingPlansService.calculateMatchConfidence(baseWorkout, activityDiffDist)).toBe(92.5);

    // Distance is 24000m (20% difference) -> meets 20% tolerance.
    // Distance score: 0. (Loses 15 points)
    const activityLimitDist = {
      type: 'Ride',
      start_date_local: '2026-06-01T10:00:00',
      moving_time: 3600,
      distance: 24000 // 20% diff
    };
    expect(trainingPlansService.calculateMatchConfidence(baseWorkout, activityLimitDist)).toBe(85);
  });

  it('ignores distance if workout is not distance-based', () => {
    const strengthWorkout: Workout = {
      ...baseWorkout,
      type: 'strength',
      distance: undefined // No distance planned
    };

    const activity = {
      type: 'WeightTraining',
      start_date_local: '2026-06-01T10:00:00',
      moving_time: 3600,
      distance: 0 // Activity has no distance
    };

    const score = trainingPlansService.calculateMatchConfidence(strengthWorkout, activity);
    // Since distance is ignored, it defaults to full 15 points for distance matching.
    expect(score).toBe(100);
  });
});
