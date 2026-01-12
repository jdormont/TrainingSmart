
import { describe, it, expect } from 'vitest';
import { healthMetricsService } from './healthMetricsService';
import type { StravaActivity } from '../types';

describe('HealthMetricsService', () => {
  const createActivity = (date: string, movingTimeMinutes: number, distanceMeters: number, type = 'Ride', avgHr = 150, maxHr = 180): StravaActivity => ({
    id: Math.random(),
    name: 'Test Activity',
    distance: distanceMeters,
    moving_time: movingTimeMinutes * 60,
    elapsed_time: movingTimeMinutes * 60,
    total_elevation_gain: 100,
    type,
    sport_type: type,
    start_date: `${date}T10:00:00Z`,
    start_date_local: `${date}T10:00:00`,
    timezone: '(GMT-05:00) America/New_York',
    average_speed: 8.0, // m/s
    max_speed: 10.0,
    average_heartrate: avgHr,
    max_heartrate: maxHr,
    kudos_count: 0,
    comment_count: 0,
    athlete_count: 1,
    photo_count: 0,
    map: { id: '1', summary_polyline: '', resource_state: 2 }
  });

  const getRelativeDate = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().split('T')[0];
  };

  it('calculates Load (ACWR) - Growth Phase', () => {
    const activities: StravaActivity[] = [];
    
    // Chronic Load: 60 mins/day for last 6 weeks
    for (let i = 8; i < 42; i++) {
        if (i % 7 < 5) { // 5 days a week
            activities.push(createActivity(getRelativeDate(i), 60, 20000));
        }
    }
    // Acute Load: Increased to ~75 mins/day to hit Ratio ~1.25
    for (let i = 0; i < 7; i++) {
        if (i % 7 < 5) {
            activities.push(createActivity(getRelativeDate(i), 75, 25000));
        }
    }

    const metrics = healthMetricsService.calculateHealthMetrics({} as any, activities);
    
    // Chronic approx 300 mins/week. Acute approx 375 mins. Ratio ~1.25.
    // Score 100 range: 1.10 - 1.30
    expect(metrics.load).toBe(100);
    expect(metrics.details.load.suggestion).toContain("Perfect Growth Zone");
  });

  it('calculates Load (ACWR) - Maintenance', () => {
      const activities: StravaActivity[] = [];
      // Sready state 60 mins/day
      for (let i = 0; i < 42; i++) {
        if (i % 7 < 5) activities.push(createActivity(getRelativeDate(i), 60, 20000));
      }

      const metrics = healthMetricsService.calculateHealthMetrics({} as any, activities);
      // Ratio 1.0 -> Score 85
      expect(metrics.load).toBe(85);
      expect(metrics.details.load.suggestion).toContain("Maintenance Mode");
  });


  it('flags Danger Zone (ACWR > 1.45)', () => {
      const activities: StravaActivity[] = [];
      
      // Low chronic baseline
      for(let i=10; i<42; i+=7) {
          activities.push(createActivity(getRelativeDate(i), 30, 10000));
      }
      // Big sudden spike
      for(let i=0; i<7; i++) {
          activities.push(createActivity(getRelativeDate(i), 120, 40000));
      }

      const metrics = healthMetricsService.calculateHealthMetrics({} as any, activities);
      expect(metrics.details.load.score).toBe(50);
      expect(metrics.details.load.suggestion).toContain("Danger Zone");
  });

  it('calculates Consistency (Std Dev) correctly', () => {
      const activities: StravaActivity[] = [];
      // 4 days a week perfectly
      for(let w=0; w<8; w++) {
          for(let d=0; d<4; d++) {
              activities.push(createActivity(getRelativeDate(w*7 + d), 60, 20000));
          }
      }

      const metrics = healthMetricsService.calculateHealthMetrics({} as any, activities);
      expect(metrics.consistency).toBe(100);
      expect(metrics.details.consistency.suggestion).toContain("Machine-like");
  });

  it('detects Erratic Consistency', () => {
      const activities: StravaActivity[] = [];
      // Alternating 7 days then 0 days
      for(let w=0; w<8; w++) {
          if (w % 2 === 0) {
              for(let d=0; d<7; d++) activities.push(createActivity(getRelativeDate(w*7 + d), 30, 10000));
          }
      }

      const metrics = healthMetricsService.calculateHealthMetrics({} as any, activities);
      expect(metrics.consistency).toBe(50);
      expect(metrics.details.consistency.suggestion).toContain("Erratic");
  });

  it('calculates Endurance (Long Ride Progression)', () => {
      const activities: StravaActivity[] = [];
      // Baseline 60 min long rides
      for(let w=1; w<=4; w++) {
          activities.push(createActivity(getRelativeDate(w*7 + 2), 60, 20000));
      }
      // Current 90 min (1.5x)
      activities.push(createActivity(getRelativeDate(2), 90, 30000));

      const metrics = healthMetricsService.calculateHealthMetrics({} as any, activities);
      expect(metrics.endurance).toBe(100);
      expect(metrics.details.endurance.suggestion).toContain("Excellent! Pushing boundaries");
  });

  it('calculates Intensity (Perfect Polarization)', () => {
      const activities: StravaActivity[] = [];
      const today = new Date().toISOString().split('T')[0];
      
      // 2 Hard rides (Avg HR 165 - Z4) -> 20%
      activities.push(createActivity(today, 60, 20000, 'Ride', 165, 180));
      activities.push(createActivity(today, 60, 20000, 'Ride', 165, 180));
      
      // 8 Easy rides (Avg HR 130 - Z2) -> 80% (Z3 is 0%)
      for(let i=0; i<8; i++) {
           activities.push(createActivity(today, 60, 20000, 'Ride', 130, 145));
      }

      const metrics = healthMetricsService.calculateHealthMetrics({} as any, activities);
      
      // Z4% = 18% (approx). Z3% = 0%.
      // Rule: Z4 > 15% AND Z3 < 20% -> Score 100.
      expect(metrics.intensity).toBe(100);
      expect(metrics.details.intensity.suggestion).toContain("Perfect Polarization");
  });

   it('penalizes Junk Miles (Zone 3 > 30%)', () => {
      const activities: StravaActivity[] = [];
      const today = new Date().toISOString().split('T')[0];
      
      // 5 Tempo rides (Avg HR 145 - Z3 range [135-159])
      for(let i=0; i<5; i++) activities.push(createActivity(today, 60, 20000, 'Ride', 145, 160));
      
      // 5 Easy rides
      for(let i=0; i<5; i++) activities.push(createActivity(today, 60, 20000, 'Ride', 130, 145));

      const metrics = healthMetricsService.calculateHealthMetrics({} as any, activities);

      // Total 10h. 5h Z3. 50% Z3.
      expect(metrics.intensity).toBe(60);
      expect(metrics.details.intensity.suggestion).toContain("Junk Mile Penalty");
  });

  it('calculates Rider Profile Levels correctly', () => {
      const activities: StravaActivity[] = [];

      // Scenario:
      // 1. Consistency: 4 days/week (Level 6: 4 * 1.5 = 6)
      // 2. Endurance: Longest ride 90 mins (Level 4: 1 + floor(1.5*2) = 4)
      // 3. Intensity: 10% Z4 (Level 6: 2 + 10/2.5 = 6)
      
      // Create 4 days/week pattern, starting from yesterday to ensure they fall in windows
      for(let w=0; w<8; w++) {
          for(let d=0; d<4; d++) {
             // 90 min rides to satisfy endurance
             activities.push(createActivity(getRelativeDate(w*7 + d + 1), 90, 30000, 'Ride', 145, 170)); 
             // Avg HR 145 (Z3), Max 170 (Z4 start is 160).
             // Since Avg < 160, it falls into Z3 bucket logic? 
             // Logic: Avg >= 160 -> Z4. Avg >= 135 -> Z3.
             // We want 10% Z4.
             // If we rely on intervals? "Max HR > 170" adds 15% Z4 per ride?
             // Let's force Avg HR 165 for 1 ride out of 10?
          }
      }
      
      // The above loop creates 32 rides. All 90 mins.
      // Longest ride = 90m -> Lvl 4.
      // Consistency = 4 days/wk -> Lvl 6.
      
      // Intensity: 
      // Current logic: Sum of Est Z4 / Total Time.
      // Rides have Avg 145. 
      // check code: if avg >= 135 (Z3 min), estZ4 += 0.1 * duration.
      // So every ride contributes 10% to Z4?
      // Yes. So Z4% = 10%.
      // Level = 2 + (10 / 2.5) = 6.
      
      const metrics = healthMetricsService.calculateHealthMetrics({} as any, activities);
      
      expect(metrics.profile.discipline.level).toBe(6);
      expect(metrics.profile.stamina.level).toBe(4);
      expect(metrics.profile.punch.level).toBe(6);
  });

  it('calculates Efficiency Trend', () => {
      const activities: StravaActivity[] = [];

      // Create activity helper with explicit watts
      const createPowerActivity = (date: string, watts: number, hr: number) => {
         const act = createActivity(date, 60, 30000, 'Ride', hr, 180);
         act.weighted_average_watts = watts;
         return act;
      }

      // Baseline: 4 weeks ago. EF = 200w / 150bpm = 1.33
      for(let i=20; i<35; i++) {
          activities.push(createPowerActivity(getRelativeDate(i), 200, 150));
      }

      // Current: EF = 210w / 150bpm = 1.40 (+5% improvement)
      // > 2% target
      for(let i=0; i<5; i++) {
          activities.push(createPowerActivity(getRelativeDate(i), 210, 150));
      }

      const metrics = healthMetricsService.calculateHealthMetrics({} as any, activities);
      expect(metrics.efficiency).toBe(100);
      expect(metrics.details.efficiency.suggestion).toContain("Strong Efficiency Gains");
  });
});
