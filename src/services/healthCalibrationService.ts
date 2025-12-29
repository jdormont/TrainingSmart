interface HRVReference {
  min: number;
  target: number;
  max: number;
}

interface RestingHRReference {
  min: number;
  target: number;
  max: number;
}

export interface DemographicInfo {
  gender?: string;
  ageBucket?: string;
}

class HealthCalibrationService {
  private getHRVReference(gender: string, ageBucket: string): HRVReference {
    const genderKey = gender === 'female' ? 'female' : 'male';

    const hrvRanges: Record<string, Record<string, HRVReference>> = {
      male: {
        '18-24': { min: 55, target: 78, max: 105 },
        '25-34': { min: 48, target: 70, max: 95 },
        '35-44': { min: 42, target: 60, max: 85 },
        '45-54': { min: 35, target: 48, max: 70 },
        '55-64': { min: 25, target: 40, max: 60 },
        '65+': { min: 20, target: 35, max: 50 },
      },
      female: {
        '18-24': { min: 50, target: 75, max: 100 },
        '25-34': { min: 45, target: 67, max: 92 },
        '35-44': { min: 40, target: 58, max: 82 },
        '45-54': { min: 33, target: 46, max: 68 },
        '55-64': { min: 25, target: 38, max: 58 },
        '65+': { min: 20, target: 33, max: 48 },
      },
    };

    return hrvRanges[genderKey]?.[ageBucket] || { min: 30, target: 55, max: 80 };
  }

  private getRestingHRReference(gender: string, ageBucket: string): RestingHRReference {
    const genderKey = gender === 'female' ? 'female' : 'male';

    const hrRanges: Record<string, Record<string, RestingHRReference>> = {
      male: {
        '18-24': { min: 56, target: 62, max: 73 },
        '25-34': { min: 57, target: 64, max: 74 },
        '35-44': { min: 58, target: 65, max: 76 },
        '45-54': { min: 59, target: 66, max: 77 },
        '55-64': { min: 60, target: 68, max: 79 },
        '65+': { min: 62, target: 70, max: 80 },
      },
      female: {
        '18-24': { min: 61, target: 68, max: 78 },
        '25-34': { min: 62, target: 70, max: 79 },
        '35-44': { min: 63, target: 71, max: 81 },
        '45-54': { min: 64, target: 73, max: 82 },
        '55-64': { min: 65, target: 75, max: 84 },
        '65+': { min: 67, target: 77, max: 86 },
      },
    };

    return hrRanges[genderKey]?.[ageBucket] || { min: 60, target: 70, max: 80 };
  }

  calibrateHRVScore(hrvValue: number, demographic?: DemographicInfo): number {
    if (!demographic?.gender || !demographic?.ageBucket) {
      return this.getDefaultHRVScore(hrvValue);
    }

    const reference = this.getHRVReference(demographic.gender, demographic.ageBucket);

    if (hrvValue >= reference.target) {
      const percentAboveTarget = Math.min((hrvValue - reference.target) / (reference.max - reference.target), 1);
      return Math.round(80 + (percentAboveTarget * 20));
    } else if (hrvValue >= reference.min) {
      const percentOfTarget = (hrvValue - reference.min) / (reference.target - reference.min);
      return Math.round(60 + (percentOfTarget * 20));
    } else {
      const percentBelowMin = Math.max(0, hrvValue / reference.min);
      return Math.round(percentBelowMin * 60);
    }
  }

  calibrateRestingHRScore(restingHR: number, demographic?: DemographicInfo): number {
    if (!demographic?.gender || !demographic?.ageBucket) {
      return this.getDefaultRestingHRScore(restingHR);
    }

    const reference = this.getRestingHRReference(demographic.gender, demographic.ageBucket);

    // If RHR is below or equal to the minimum of the range, that's excellent (100)
    if (restingHR <= reference.min) {
      return 100;
    }

    // If within the optimal range (between min and target)
    if (restingHR <= reference.target) {
      const range = reference.target - reference.min;
      const position = restingHR - reference.min;
      // Scale linearly from 100 (at min) to 80 (at target)
      const score = 100 - ((position / range) * 20);
      return Math.round(score);
    }

    // If above target but within max
    if (restingHR <= reference.max) {
      const percentAboveTarget = (restingHR - reference.target) / (reference.max - reference.target);
      return Math.round(80 - (percentAboveTarget * 30));
    }

    // If above max
    const percentAboveMax = Math.min((restingHR - reference.max) / 20, 1);
    return Math.round(50 - (percentAboveMax * 30));
  }

  private getDefaultHRVScore(hrvValue: number): number {
    if (hrvValue >= 65) return Math.min(100, Math.round(80 + (hrvValue - 65) * 0.5));
    if (hrvValue >= 40) return Math.round(60 + ((hrvValue - 40) / 25) * 20);
    if (hrvValue >= 20) return Math.round(40 + ((hrvValue - 20) / 20) * 20);
    return Math.round((hrvValue / 20) * 40);
  }

  private getDefaultRestingHRScore(restingHR: number): number {
    if (restingHR <= 60) return 100;
    if (restingHR <= 70) return Math.round(90 - (restingHR - 60));
    if (restingHR <= 80) return Math.round(80 - (restingHR - 70) * 1.5);
    if (restingHR <= 90) return Math.round(65 - (restingHR - 80) * 1.5);
    return Math.max(20, Math.round(50 - (restingHR - 90)));
  }

  calibrateRecoveryScore(
    sleepMinutes: number,
    hrvValue: number | null,
    restingHR: number | null,
    demographic?: DemographicInfo
  ): number {
    const scores: number[] = [];

    if (sleepMinutes > 0) {
      const sleepScore = Math.min(100, (sleepMinutes / 480) * 100);
      scores.push(sleepScore);
    }

    if (hrvValue && hrvValue > 0) {
      const hrvScore = this.calibrateHRVScore(hrvValue, demographic);
      scores.push(hrvScore);
    }

    if (restingHR && restingHR > 0) {
      const hrScore = this.calibrateRestingHRScore(restingHR, demographic);
      scores.push(hrScore);
    }

    if (scores.length === 0) return 0;
    return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  }

  getHRVInterpretation(hrvValue: number, demographic?: DemographicInfo): string {
    if (!demographic?.gender || !demographic?.ageBucket) {
      if (hrvValue >= 65) return 'Excellent';
      if (hrvValue >= 50) return 'Good';
      if (hrvValue >= 35) return 'Fair';
      return 'Below Average';
    }

    const reference = this.getHRVReference(demographic.gender, demographic.ageBucket);

    if (hrvValue >= reference.target) return 'Excellent';
    if (hrvValue >= reference.min) return 'Good';
    if (hrvValue >= reference.min * 0.7) return 'Fair';
    return 'Below Average';
  }

  getRestingHRInterpretation(restingHR: number, demographic?: DemographicInfo): string {
    if (!demographic?.gender || !demographic?.ageBucket) {
      if (restingHR <= 60) return 'Excellent';
      if (restingHR <= 70) return 'Good';
      if (restingHR <= 80) return 'Fair';
      return 'Above Average';
    }

    const reference = this.getRestingHRReference(demographic.gender, demographic.ageBucket);

    if (restingHR <= reference.target) return 'Excellent';
    if (restingHR <= reference.max) return 'Good';
    if (restingHR <= reference.max + 10) return 'Fair';
    return 'Above Average';
  }
}

export const healthCalibrationService = new HealthCalibrationService();
