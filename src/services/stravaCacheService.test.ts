import { describe, it, expect } from 'vitest';
import { 
  calculateNormalizedPower, 
  calculatePowerCurve,
  calculateHeartRateEfficiencyBins,
  calculateCardiacDecoupling 
} from './stravaCacheService';

describe('StravaCacheService Algorithms', () => {
  describe('calculateNormalizedPower', () => {
    it('returns 0 for empty or short watts streams', () => {
      expect(calculateNormalizedPower([])).toBe(0);
      expect(calculateNormalizedPower(Array(29).fill(200))).toBe(0);
    });

    it('calculates NP correctly for steady state watts', () => {
      // 30 seconds of 200W
      expect(calculateNormalizedPower(Array(30).fill(200))).toBe(200);
      // 100 seconds of 200W
      expect(calculateNormalizedPower(Array(100).fill(200))).toBe(200);
    });

    it('calculates NP correctly for variable watts', () => {
      // Create a variable pattern
      const watts = [
        ...Array(30).fill(100),
        ...Array(30).fill(300),
        ...Array(30).fill(100),
        ...Array(30).fill(300),
      ];
      const np = calculateNormalizedPower(watts);
      // We expect NP to be higher than average power (average is 200W)
      expect(np).toBeGreaterThan(200);
      // Verify math value
      expect(np).toBeCloseTo(222, 1);
    });
  });

  describe('calculatePowerCurve', () => {
    it('calculates peak power curve values correctly', () => {
      const watts = Array(1500).fill(200);
      
      // Inject peaks
      // 5s peak at 800W
      for (let i = 100; i < 105; i++) {
        watts[i] = 800;
      }
      
      // 1m (60s) peak at 400W (including the 5s of 800W)
      for (let i = 105; i < 160; i++) {
        watts[i] = 364;
      }

      const curve = calculatePowerCurve(watts);
      expect(curve['1s']).toBe(800);
      expect(curve['5s']).toBe(800);
      expect(curve['1m']).toBe(400); // 5*800 + 55*364 = 24020 / 60 = 400
      expect(curve['5m']).toBe(240); // (24020 + 240*200) / 300 = 72020 / 300 = 240
    });
  });

  describe('calculateHeartRateEfficiencyBins', () => {
    it('returns empty array for mismatched or empty streams', () => {
      expect(calculateHeartRateEfficiencyBins([], [])).toEqual([]);
      expect(calculateHeartRateEfficiencyBins([100], [])).toEqual([]);
      expect(calculateHeartRateEfficiencyBins([100], [120, 130])).toEqual([]);
    });

    it('calculates efficiency factor for valid buckets with >= 30 samples', () => {
      // 30 seconds of 150W at 120 bpm
      const watts = Array(30).fill(150);
      const hr = Array(30).fill(120);

      const bins = calculateHeartRateEfficiencyBins(watts, hr);
      expect(bins).toHaveLength(1);
      expect(bins[0]).toEqual({
        bucket: '130-160W',
        avg_hr: 120,
        seconds: 30,
        efficiency_factor: 1.25 // 150 / 120 = 1.25
      });
    });

    it('ignores buckets with less than 30 samples', () => {
      // 29 seconds of 150W at 120 bpm
      const watts = Array(29).fill(150);
      const hr = Array(29).fill(120);

      const bins = calculateHeartRateEfficiencyBins(watts, hr);
      expect(bins).toEqual([]);
    });
  });

  describe('calculateCardiacDecoupling', () => {
    it('returns null for short workouts < 600 seconds', () => {
      const watts = Array(599).fill(200);
      const hr = Array(599).fill(150);
      expect(calculateCardiacDecoupling(watts, hr)).toBeNull();
    });

    it('calculates positive drift (aerobic decoupling) correctly', () => {
      // 300 seconds of first half: 200W at 150 bpm (EF = 1.33)
      // 300 seconds of second half: 200W at 165 bpm (EF = 1.21)
      const watts = Array(600).fill(200);
      const hr = [
        ...Array(300).fill(150),
        ...Array(300).fill(165)
      ];

      const decoupling = calculateCardiacDecoupling(watts, hr);
      expect(decoupling).not.toBeNull();
      // EF1 = 200 / 150 = 1.3333
      // EF2 = 200 / 165 = 1.2121
      // drift = ((1.3333 - 1.2121) / 1.3333) * 100 = (0.1212 / 1.3333) * 100 = 9.09% ~ 9.1%
      expect(decoupling!.drift_percentage).toBeCloseTo(9.1, 1);
      expect(decoupling!.first_half_avg_hr).toBe(150);
      expect(decoupling!.second_half_avg_hr).toBe(165);
    });

    it('calculates negative drift correctly when heart rate drops', () => {
      // 300 seconds of first half: 200W at 160 bpm (EF = 1.25)
      // 300 seconds of second half: 200W at 150 bpm (EF = 1.33)
      const watts = Array(600).fill(200);
      const hr = [
        ...Array(300).fill(160),
        ...Array(300).fill(150)
      ];

      const decoupling = calculateCardiacDecoupling(watts, hr);
      expect(decoupling).not.toBeNull();
      // EF1 = 200 / 160 = 1.25
      // EF2 = 200 / 150 = 1.3333
      // drift = ((1.25 - 1.3333) / 1.25) * 100 = (-0.0833 / 1.25) * 100 = -6.66% ~ -6.7%
      expect(decoupling!.drift_percentage).toBeCloseTo(-6.7, 1);
    });
  });
});
