import { describe, it, expect } from 'vitest';
import { calculateNormalizedPower, calculatePowerCurve } from './stravaCacheService';

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
});
