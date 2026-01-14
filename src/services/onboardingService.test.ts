
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getUserOnboardingStatus } from './onboardingService';
import { userProfileService } from './userProfileService';
import { supabase } from './supabaseClient';

// Mock dependencies
vi.mock('./supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: vi.fn()
    }
  }
}));

vi.mock('./userProfileService', () => ({
  userProfileService: {
    getUserProfile: vi.fn()
  }
}));

describe('getUserOnboardingStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return true if no user is authenticated', async () => {
    // Mock no user
    vi.mocked(supabase.auth.getUser).mockResolvedValue({ 
      data: { user: null }, 
      error: null 
    } as any);

    const result = await getUserOnboardingStatus();
    expect(result).toBe(true);
  });

  it('should return false if profile exists but has no onboarding data', async () => {
    // Mock authenticated user
    vi.mocked(supabase.auth.getUser).mockResolvedValue({ 
      data: { user: { id: 'user-123' } }, 
      error: null 
    } as any);

    // Mock profile with no relevant fields
    vi.mocked(userProfileService.getUserProfile).mockResolvedValue({
      gender: 'male'
      // Missing training_goal and coach_persona
    } as any);

    const result = await getUserOnboardingStatus();
    expect(result).toBe(false);
  });

  it('should return true if profile has training_goal', async () => {
    // Mock authenticated user
    vi.mocked(supabase.auth.getUser).mockResolvedValue({ 
      data: { user: { id: 'user-123' } }, 
      error: null 
    } as any);

    // Mock completed profile
    vi.mocked(userProfileService.getUserProfile).mockResolvedValue({
      training_goal: 'performance',
      gender: 'male'
    } as any);

    const result = await getUserOnboardingStatus();
    expect(result).toBe(true);
  });

  it('should return true if profile has coach_persona', async () => {
     // Mock authenticated user
     vi.mocked(supabase.auth.getUser).mockResolvedValue({ 
      data: { user: { id: 'user-123' } }, 
      error: null 
    } as any);

    // Mock completed profile
    vi.mocked(userProfileService.getUserProfile).mockResolvedValue({
      coach_persona: 'supportive',
      gender: 'male'
    } as any);

    const result = await getUserOnboardingStatus();
    expect(result).toBe(true);
  });
  
  it('should return false if userProfileService returns null (no profile)', async () => {
      // Mock authenticated user
      vi.mocked(supabase.auth.getUser).mockResolvedValue({ 
       data: { user: { id: 'user-123' } }, 
       error: null 
     } as any);
 
     // Mock no profile found
     vi.mocked(userProfileService.getUserProfile).mockResolvedValue(null);
 
     const result = await getUserOnboardingStatus();
     expect(result).toBe(false);
   });

  it('should return true (safe default) if an error occurs', async () => {
     // Mock authenticated user
     vi.mocked(supabase.auth.getUser).mockResolvedValue({ 
      data: { user: { id: 'user-123' } }, 
      error: null 
    } as any);

    // Mock error
    vi.mocked(userProfileService.getUserProfile).mockRejectedValue(new Error('Database error'));

    const result = await getUserOnboardingStatus();
    expect(result).toBe(true);
  });
});
