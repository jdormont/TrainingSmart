import { describe, it, expect } from 'vitest';
import {
  formatDistance,
  formatDuration,
  formatPace,
  formatElevation,
  formatDate,
  formatTime,
  getActivityIcon,
  getActivityColor,
} from './formatters';

describe('formatDistance', () => {
  it('formats sub-0.1-mile distances in feet', () => {
    expect(formatDistance(0)).toBe('0ft');
    expect(formatDistance(50)).toBe('164ft'); // 50 * 3.28084 ≈ 164
  });

  it('formats distances >= 0.1 miles in miles with 1 decimal', () => {
    expect(formatDistance(1000)).toBe('0.6mi');
    expect(formatDistance(10000)).toBe('6.2mi');
    expect(formatDistance(100000)).toBe('62.1mi');
  });
});

describe('formatDuration', () => {
  it('formats seconds only', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(45)).toBe('45s');
    expect(formatDuration(59)).toBe('59s');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(60)).toBe('1m 0s');
    expect(formatDuration(125)).toBe('2m 5s');
    expect(formatDuration(3599)).toBe('59m 59s');
  });

  it('formats hours and minutes, omitting seconds', () => {
    expect(formatDuration(3600)).toBe('1h 0m');
    expect(formatDuration(5400)).toBe('1h 30m');
    expect(formatDuration(7384)).toBe('2h 3m');
  });
});

describe('formatPace', () => {
  it('formats running pace as min:ss/mi', () => {
    // 3 m/s → 1609.34/3 ≈ 536.4 s/mi → 8:56/mi
    const pace = formatPace(3, 'Run');
    expect(pace).toMatch(/^\d+:\d{2}\/mi$/);
  });

  it('formats walk pace the same as run (min/mi)', () => {
    expect(formatPace(2, 'Walk')).toMatch(/^\d+:\d{2}\/mi$/);
  });

  it('formats cycling and non-run activities as mph', () => {
    // 10 m/s → 10 * 2.23694 = 22.3694 → 22.4 mph
    expect(formatPace(10, 'Ride')).toBe('22.4 mph');
    expect(formatPace(5, 'Ride')).toMatch(/^\d+\.\d mph$/);
  });

  it('defaults to running pace (min/mi) when no activity type is supplied', () => {
    // default activityType = 'Run'
    expect(formatPace(3)).toMatch(/^\d+:\d{2}\/mi$/);
  });
});

describe('formatElevation', () => {
  it('converts meters to feet and rounds', () => {
    expect(formatElevation(0)).toBe('0ft');
    expect(formatElevation(100)).toBe('328ft'); // 100 * 3.28084 = 328.084 → 328
    expect(formatElevation(500)).toBe('1640ft');
  });
});

describe('formatDate', () => {
  it('formats a date string with month, day, and year', () => {
    const result = formatDate('2024-06-15T10:00:00');
    expect(result).toContain('Jun');
    expect(result).toContain('15');
    expect(result).toContain('2024');
  });

  it('strips Z suffix so the date is treated as local wall-clock time', () => {
    expect(formatDate('2024-06-15T10:00:00Z')).toBe(formatDate('2024-06-15T10:00:00'));
  });
});

describe('formatTime', () => {
  it('formats time with hours, minutes, and AM/PM', () => {
    const result = formatTime('2024-01-15T14:30:00');
    expect(result).toMatch(/\d+:\d{2} (AM|PM)/);
  });

  it('strips Z suffix so time is treated as local wall-clock time', () => {
    expect(formatTime('2024-06-15T10:00:00Z')).toBe(formatTime('2024-06-15T10:00:00'));
  });
});

describe('getActivityIcon', () => {
  it('returns the correct emoji for known activity types', () => {
    expect(getActivityIcon('Run')).toBe('🏃');
    expect(getActivityIcon('Ride')).toBe('🚴');
    expect(getActivityIcon('Swim')).toBe('🏊');
    expect(getActivityIcon('Hike')).toBe('🥾');
    expect(getActivityIcon('Walk')).toBe('🚶');
    expect(getActivityIcon('Workout')).toBe('💪');
    expect(getActivityIcon('Yoga')).toBe('🧘');
    expect(getActivityIcon('WeightTraining')).toBe('🏋️');
  });

  it('falls back to the run emoji for unknown types', () => {
    expect(getActivityIcon('Kayaking')).toBe('🏃');
    expect(getActivityIcon('')).toBe('🏃');
  });
});

describe('getActivityColor', () => {
  it('returns the correct hex color for known activity types', () => {
    expect(getActivityColor('Run')).toBe('#EF4444');
    expect(getActivityColor('Ride')).toBe('#3B82F6');
    expect(getActivityColor('Swim')).toBe('#06B6D4');
    expect(getActivityColor('Hike')).toBe('#10B981');
    expect(getActivityColor('Walk')).toBe('#8B5CF6');
    expect(getActivityColor('Workout')).toBe('#F59E0B');
    expect(getActivityColor('Yoga')).toBe('#EC4899');
  });

  it('falls back to the default grey for unknown types', () => {
    expect(getActivityColor('Kayaking')).toBe('#6B7280');
    expect(getActivityColor('')).toBe('#6B7280');
  });
});
