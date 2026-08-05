import { describe, it, expect, vi, beforeEach } from 'vitest';
import { assignCoachSpecialization, seedCoachMemoryFromOnboarding, GOAL_OPTIONS } from './onboardingService';
import { goalsService } from './goalsService';
import { athleteProfileService } from './athleteProfileService';

vi.mock('./goalsService', () => ({
  goalsService: {
    createActiveGoal: vi.fn(),
  },
}));

vi.mock('./athleteProfileService', () => ({
  athleteProfileService: {
    editProfile: vi.fn(),
  },
}));

describe('assignCoachSpecialization', () => {
  it('assigns comeback + re_engager for beginner fitness level regardless of activities', () => {
    const result = assignCoachSpecialization({
      fitness_level: 'beginner',
      activity_mix: [{ type: 'bike', priority: 1 }],
      weekly_availability_days: 5,
    });
    expect(result).toEqual({ coach_specialization: 'comeback', fitness_mode: 're_engager' });
  });

  it('assigns re_engager mode for low availability even at higher fitness levels', () => {
    const result = assignCoachSpecialization({
      fitness_level: 'intermediate',
      activity_mix: [{ type: 'bike', priority: 1 }],
      weekly_availability_days: 2,
    });
    expect(result.fitness_mode).toBe('re_engager');
  });

  it('assigns endurance specialization when the top-priority activity is cycling', () => {
    const result = assignCoachSpecialization({
      fitness_level: 'advanced',
      activity_mix: [{ type: 'strength', priority: 2 }, { type: 'bike', priority: 1 }],
      weekly_availability_days: 5,
    });
    expect(result.coach_specialization).toBe('endurance');
  });

  it('assigns strength_mobility specialization when the top-priority activity is strength', () => {
    const result = assignCoachSpecialization({
      fitness_level: 'advanced',
      activity_mix: [{ type: 'strength', priority: 1 }, { type: 'bike', priority: 2 }],
      weekly_availability_days: 5,
    });
    expect(result.coach_specialization).toBe('strength_mobility');
  });

  it('falls back to general_fitness for an unrecognized top activity', () => {
    const result = assignCoachSpecialization({
      fitness_level: 'advanced',
      activity_mix: [{ type: 'swim', priority: 1 }],
      weekly_availability_days: 5,
    });
    expect(result.coach_specialization).toBe('general_fitness');
  });
});

describe('seedCoachMemoryFromOnboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(goalsService.createActiveGoal).mockResolvedValue({} as any);
    vi.mocked(athleteProfileService.editProfile).mockResolvedValue({} as any);
  });

  it('creates an active goal titled with the human-readable label, not the raw option id', async () => {
    await seedCoachMemoryFromOnboarding({
      primary_goal: 'train_for_event',
      optional_event: '',
      activity_mix: [{ type: 'bike', priority: 1 }],
      weekly_availability_days: 4,
      weekly_availability_duration: 45,
      fitness_level: 'intermediate',
    });

    expect(goalsService.createActiveGoal).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Train for an event', source: 'onboarding' }),
    );
  });

  it('uses the optional freeform event text as the goal description when provided', async () => {
    await seedCoachMemoryFromOnboarding({
      primary_goal: 'train_for_event',
      optional_event: '10K in June',
      activity_mix: [{ type: 'run', priority: 1 }],
      weekly_availability_days: 4,
      weekly_availability_duration: 45,
      fitness_level: 'intermediate',
    });

    expect(goalsService.createActiveGoal).toHaveBeenCalledWith(
      expect.objectContaining({ description: '10K in June' }),
    );
  });

  it('omits description when no optional event text was given', async () => {
    await seedCoachMemoryFromOnboarding({
      primary_goal: 'stay_consistent',
      optional_event: '',
      activity_mix: [{ type: 'bike', priority: 1 }],
      weekly_availability_days: 4,
      weekly_availability_duration: 45,
      fitness_level: 'intermediate',
    });

    expect(goalsService.createActiveGoal).toHaveBeenCalledWith(
      expect.objectContaining({ description: undefined }),
    );
  });

  it('falls back to the raw primary_goal value as title if it does not match a known GOAL_OPTIONS entry', async () => {
    await seedCoachMemoryFromOnboarding({
      primary_goal: 'some_future_option',
      optional_event: '',
      activity_mix: [{ type: 'bike', priority: 1 }],
      weekly_availability_days: 4,
      weekly_availability_duration: 45,
      fitness_level: 'intermediate',
    });

    expect(goalsService.createActiveGoal).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'some_future_option' }),
    );
  });

  it('seeds athlete_profile constraints.timeAvailability and preferences.workoutTypes from availability/activity answers', async () => {
    await seedCoachMemoryFromOnboarding({
      primary_goal: 'build_strength',
      optional_event: '',
      activity_mix: [{ type: 'strength', priority: 1 }, { type: 'yoga', priority: 2 }],
      weekly_availability_days: 3,
      weekly_availability_duration: 30,
      fitness_level: 'beginner',
    });

    expect(athleteProfileService.editProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        constraints: { timeAvailability: '3 days/week, 30 min/session' },
        preferences: { workoutTypes: ['Strength training', 'Yoga'] },
      }),
    );
  });

  it('sorts activity_mix by priority before mapping to workout type labels', async () => {
    await seedCoachMemoryFromOnboarding({
      primary_goal: 'build_strength',
      optional_event: '',
      activity_mix: [{ type: 'yoga', priority: 2 }, { type: 'strength', priority: 1 }],
      weekly_availability_days: 3,
      weekly_availability_duration: 30,
      fitness_level: 'beginner',
    });

    expect(athleteProfileService.editProfile).toHaveBeenCalledWith(
      expect.objectContaining({ preferences: { workoutTypes: ['Strength training', 'Yoga'] } }),
    );
  });

  it('writes a narrative mentioning fitness level, availability, and top activities', async () => {
    await seedCoachMemoryFromOnboarding({
      primary_goal: 'build_strength',
      optional_event: '',
      activity_mix: [{ type: 'strength', priority: 1 }],
      weekly_availability_days: 4,
      weekly_availability_duration: 45,
      fitness_level: 'advanced',
    });

    const call = vi.mocked(athleteProfileService.editProfile).mock.calls[0][0];
    expect(call.narrative).toContain('well-trained and performance-focused');
    expect(call.narrative).toContain('4x/week');
    expect(call.narrative).toContain('45 min/session');
    expect(call.narrative).toContain('Strength training');
  });

  it('does not throw when goalsService.createActiveGoal fails — onboarding completion must not be blocked', async () => {
    vi.mocked(goalsService.createActiveGoal).mockRejectedValueOnce(new Error('db error'));

    await expect(
      seedCoachMemoryFromOnboarding({
        primary_goal: 'build_strength',
        optional_event: '',
        activity_mix: [{ type: 'strength', priority: 1 }],
        weekly_availability_days: 4,
        weekly_availability_duration: 45,
        fitness_level: 'advanced',
      }),
    ).resolves.toBeUndefined();

    // The profile seed should still be attempted even though the goal creation failed.
    expect(athleteProfileService.editProfile).toHaveBeenCalled();
  });

  it('does not throw when athleteProfileService.editProfile fails', async () => {
    vi.mocked(athleteProfileService.editProfile).mockRejectedValueOnce(new Error('db error'));

    await expect(
      seedCoachMemoryFromOnboarding({
        primary_goal: 'build_strength',
        optional_event: '',
        activity_mix: [{ type: 'strength', priority: 1 }],
        weekly_availability_days: 4,
        weekly_availability_duration: 45,
        fitness_level: 'advanced',
      }),
    ).resolves.toBeUndefined();
  });
});

describe('GOAL_OPTIONS', () => {
  it('is the single source of truth shared between the onboarding UI and goal-title generation', () => {
    expect(GOAL_OPTIONS.map(o => o.value)).toEqual([
      'get_back_into_it',
      'train_for_event',
      'build_strength',
      'stay_consistent',
      'explore_activities',
    ]);
  });
});
