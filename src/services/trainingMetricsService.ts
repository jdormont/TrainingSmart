import type { StravaActivity } from '../types';

export interface MetricDetail {
    score: number;
    components: Array<{
        name: string;
        value: string | number;
        contribution: number;
    }>;
    trend: 'improving' | 'stable' | 'declining';
    suggestion: string;
}

export interface StravaOnlyMetrics {
    power: number; // Power/intensity capacity
    endurance: number; // Volume and long ride capacity
    consistency: number; // Training regularity
    speed: number; // Average speed trends
    trainingLoad: number; // Overall training stress
    overallScore: number;
    details: {
        power: MetricDetail;
        endurance: MetricDetail;
        consistency: MetricDetail;
        speed: MetricDetail;
        trainingLoad: MetricDetail;
    };
}

class TrainingMetricsService {
    public calculateStravaMetrics(activities: StravaActivity[]): StravaOnlyMetrics {
        // If no activities, return zeroed metrics
        if (!activities || activities.length === 0) {
            return this.getZeroMetrics();
        }

        const recentActivities = activities.slice(0, Math.min(28, activities.length));

        const power = this.calculatePowerMetric(recentActivities);
        const endurance = this.calculateEnduranceMetric(recentActivities);
        const consistency = this.calculateConsistencyMetric(recentActivities);
        const speed = this.calculateSpeedMetric(recentActivities);
        const trainingLoad = this.calculateTrainingLoadMetric(recentActivities);

        const overallScore = Math.round(
            (power.score * 0.2) +
            (endurance.score * 0.25) +
            (consistency.score * 0.2) +
            (speed.score * 0.15) +
            (trainingLoad.score * 0.2)
        );

        return {
            power: power.score,
            endurance: endurance.score,
            consistency: consistency.score,
            speed: speed.score,
            trainingLoad: trainingLoad.score,
            overallScore,
            details: {
                power,
                endurance,
                consistency,
                speed,
                trainingLoad
            }
        };
    }

    private getZeroMetrics(): StravaOnlyMetrics {
        const zeroDetail: MetricDetail = {
            score: 0,
            components: [],
            trend: 'stable',
            suggestion: 'No data available'
        };
        return {
            power: 0,
            endurance: 0,
            consistency: 0,
            speed: 0,
            trainingLoad: 0,
            overallScore: 0,
            details: {
                power: zeroDetail,
                endurance: zeroDetail,
                consistency: zeroDetail,
                speed: zeroDetail,
                trainingLoad: zeroDetail
            }
        };
    }

    private calculatePowerMetric(activities: StravaActivity[]): MetricDetail {
        const components = [];
        let totalScore = 0;

        const hardRides = activities.filter(a => a.average_speed * 2.237 >= 18);
        const hardRidePercentage = (hardRides.length / activities.length) * 100;

        const powerScore = Math.min(40, hardRidePercentage * 2);
        components.push({
            name: 'High Intensity Rides',
            value: `${hardRides.length} rides (${Math.round(hardRidePercentage)}%)`,
            contribution: Math.round(powerScore)
        });
        totalScore += powerScore;

        const elevationGains = activities.map(a => a.total_elevation_gain);
        const avgElevation = elevationGains.reduce((sum, e) => sum + e, 0) / elevationGains.length;
        const elevationScore = Math.min(30, (avgElevation / 1000) * 30);
        components.push({
            name: 'Climbing Volume',
            value: `${Math.round(avgElevation * 3.28084)} ft avg`,
            contribution: Math.round(elevationScore)
        });
        totalScore += elevationScore;

        const maxEffort = Math.max(...activities.map(a => a.average_speed));
        const effortScore = Math.min(30, (maxEffort * 2.237 / 25) * 30);
        components.push({
            name: 'Peak Performance',
            value: `${(maxEffort * 2.237).toFixed(1)} mph max avg`,
            contribution: Math.round(effortScore)
        });
        totalScore += effortScore;

        const finalScore = Math.min(100, Math.round(totalScore));

        return {
            score: finalScore,
            components,
            trend: this.calculateTrendFromActivities(activities, 'speed'),
            suggestion: finalScore < 60
                ? 'Add 1-2 high-intensity interval sessions per week'
                : finalScore < 80
                    ? 'Good power development - maintain intensity work'
                    : 'Excellent power capacity - focus on maintaining and varying stimuli'
        };
    }

    private calculateEnduranceMetric(activities: StravaActivity[]): MetricDetail {
        const components = [];
        let totalScore = 0;

        const totalDistance = activities.reduce((sum, a) => sum + a.distance, 0);
        const avgWeeklyDistance = (totalDistance / activities.length) * 7 * 0.000621371;

        let volumeScore = 0;
        if (avgWeeklyDistance >= 150) volumeScore = 40;
        else if (avgWeeklyDistance >= 100) volumeScore = 32;
        else if (avgWeeklyDistance >= 75) volumeScore = 25;
        else if (avgWeeklyDistance >= 50) volumeScore = 20;
        else volumeScore = avgWeeklyDistance * 0.4;

        components.push({
            name: 'Weekly Volume',
            value: `${avgWeeklyDistance.toFixed(1)} mi/week`,
            contribution: Math.round(volumeScore)
        });
        totalScore += volumeScore;

        const longestRide = Math.max(...activities.map(a => a.distance)) * 0.000621371;
        let longRideScore = 0;
        if (longestRide >= 100) longRideScore = 35;
        else if (longestRide >= 75) longRideScore = 28;
        else if (longestRide >= 50) longRideScore = 22;
        else longRideScore = longestRide * 0.4;

        components.push({
            name: 'Longest Ride',
            value: `${longestRide.toFixed(1)} miles`,
            contribution: Math.round(longRideScore)
        });
        totalScore += longRideScore;

        const avgDuration = activities.reduce((sum, a) => sum + a.moving_time, 0) / activities.length / 3600;
        const durationScore = Math.min(25, avgDuration * 8);
        components.push({
            name: 'Ride Duration',
            value: `${avgDuration.toFixed(1)}h avg`,
            contribution: Math.round(durationScore)
        });
        totalScore += durationScore;

        const finalScore = Math.min(100, Math.round(totalScore));

        return {
            score: finalScore,
            components,
            trend: this.calculateTrendFromActivities(activities, 'distance'),
            suggestion: finalScore < 60
                ? 'Build aerobic base with longer, easier rides'
                : finalScore < 80
                    ? 'Solid endurance base - gradually increase volume'
                    : 'Excellent endurance capacity - maintain consistency'
        };
    }

    private calculateConsistencyMetric(activities: StravaActivity[]): MetricDetail {
        const components = [];
        let totalScore = 0;

        const activityDates = activities.map(a => new Date(a.start_date_local).toDateString());
        const uniqueDays = new Set(activityDates).size;
        const dayRange = Math.ceil((new Date(activities[0].start_date_local).getTime() -
            new Date(activities[activities.length - 1].start_date_local).getTime()) / (1000 * 60 * 60 * 24));

        // Avoid division by zero
        const frequency = dayRange > 0 ? (uniqueDays / dayRange) * 7 : 0;
        let frequencyScore = 0;
        if (frequency >= 4 && frequency <= 6) frequencyScore = 40;
        else if (frequency >= 3 && frequency <= 7) frequencyScore = 30;
        else if (frequency >= 2) frequencyScore = 20;
        else frequencyScore = frequency * 10;

        components.push({
            name: 'Training Frequency',
            value: `${frequency.toFixed(1)} days/week`,
            contribution: Math.round(frequencyScore)
        });
        totalScore += frequencyScore;

        const distances = activities.map(a => a.distance);
        const mean = distances.reduce((sum, d) => sum + d, 0) / distances.length;
        const variance = Math.sqrt(
            distances.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / distances.length
        );
        const coefficientOfVariation = mean > 0 ? (variance / mean) * 100 : 0;
        const consistencyScore = Math.max(0, Math.min(35, 35 - coefficientOfVariation * 0.5));

        components.push({
            name: 'Volume Consistency',
            value: `${(100 - coefficientOfVariation).toFixed(0)}% consistent`,
            contribution: Math.round(consistencyScore)
        });
        totalScore += consistencyScore;

        const gapScores = [];
        for (let i = 0; i < activities.length - 1; i++) {
            const gap = Math.abs(
                new Date(activities[i].start_date_local).getTime() -
                new Date(activities[i + 1].start_date_local).getTime()
            ) / (1000 * 60 * 60 * 24);
            gapScores.push(gap <= 3 ? 1 : 0);
        }
        const regularityScore = gapScores.length > 0
            ? (gapScores.reduce((sum, s) => sum + s, 0) / gapScores.length) * 25
            : 0;

        components.push({
            name: 'Schedule Regularity',
            value: `${Math.round((regularityScore / 25) * 100)}% regular`,
            contribution: Math.round(regularityScore)
        });
        totalScore += regularityScore;

        const finalScore = Math.min(100, Math.round(totalScore));

        return {
            score: finalScore,
            components,
            trend: 'stable',
            suggestion: finalScore < 60
                ? 'Aim for 3-4 rides per week with consistent gaps'
                : finalScore < 80
                    ? 'Good consistency - maintain regular training schedule'
                    : 'Excellent training consistency - key to long-term improvement'
        };
    }

    private calculateSpeedMetric(activities: StravaActivity[]): MetricDetail {
        const components = [];
        let totalScore = 0;

        const speeds = activities.map(a => a.average_speed * 2.237);
        const avgSpeed = speeds.reduce((sum, s) => sum + s, 0) / speeds.length;

        let speedScore = 0;
        if (avgSpeed >= 20) speedScore = 40;
        else if (avgSpeed >= 18) speedScore = 35;
        else if (avgSpeed >= 16) speedScore = 30;
        else if (avgSpeed >= 14) speedScore = 25;
        else speedScore = avgSpeed * 1.5;

        components.push({
            name: 'Average Speed',
            value: `${avgSpeed.toFixed(1)} mph`,
            contribution: Math.round(speedScore)
        });
        totalScore += speedScore;

        const midpoint = Math.floor(activities.length / 2);
        const recentAvg = speeds.slice(0, midpoint).reduce((sum, s) => sum + s, 0) / midpoint;
        const olderAvg = speeds.slice(midpoint).reduce((sum, s) => sum + s, 0) / (activities.length - midpoint);

        // Check for division by zero if olderAvg is 0
        const improvement = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;
        const trendScore = Math.min(30, Math.max(0, 15 + improvement * 1.5));

        components.push({
            name: 'Speed Progression',
            value: improvement > 0 ? `+${improvement.toFixed(1)}%` : `${improvement.toFixed(1)}%`,
            contribution: Math.round(trendScore)
        });
        totalScore += trendScore;

        const maxSpeed = Math.max(...speeds);
        const peakScore = Math.min(30, (maxSpeed / 25) * 30);
        components.push({
            name: 'Peak Speed Capacity',
            value: `${maxSpeed.toFixed(1)} mph`,
            contribution: Math.round(peakScore)
        });
        totalScore += peakScore;

        const finalScore = Math.min(100, Math.round(totalScore));

        return {
            score: finalScore,
            components,
            trend: improvement > 5 ? 'improving' : improvement < -5 ? 'declining' : 'stable',
            suggestion: finalScore < 60
                ? 'Work on leg strength and cadence efficiency'
                : finalScore < 80
                    ? 'Good speed - add tempo work to continue improving'
                    : 'Excellent speed capacity - focus on sustaining at race pace'
        };
    }

    private calculateTrainingLoadMetric(activities: StravaActivity[]): MetricDetail {
        const components = [];
        let totalScore = 0;

        const totalTime = activities.reduce((sum, a) => sum + a.moving_time, 0) / 3600;
        const avgWeeklyHours = (totalTime / activities.length) * 7;

        let hoursScore = 0;
        if (avgWeeklyHours >= 10) hoursScore = 35;
        else if (avgWeeklyHours >= 8) hoursScore = 30;
        else if (avgWeeklyHours >= 6) hoursScore = 25;
        else if (avgWeeklyHours >= 4) hoursScore = 20;
        else hoursScore = avgWeeklyHours * 5;

        components.push({
            name: 'Weekly Hours',
            value: `${avgWeeklyHours.toFixed(1)}h/week`,
            contribution: Math.round(hoursScore)
        });
        totalScore += hoursScore;

        const intensityDist = this.calculateIntensityDistribution(activities);
        const balanceScore = intensityDist.easy >= 70 && intensityDist.easy <= 85 ? 35 :
            intensityDist.easy >= 60 && intensityDist.easy <= 90 ? 25 : 15;

        components.push({
            name: 'Easy/Hard Balance',
            value: `${intensityDist.easy}% easy`,
            contribution: balanceScore
        });
        totalScore += balanceScore;

        const workloadVariation = this.calculateWorkloadProgression(activities);
        components.push({
            name: 'Load Management',
            value: workloadVariation,
            contribution: 30
        });
        totalScore += 30;

        const finalScore = Math.min(100, Math.round(totalScore));

        return {
            score: finalScore,
            components,
            trend: 'stable',
            suggestion: finalScore < 60
                ? 'Balance training load with 80% easy, 20% hard rides'
                : finalScore < 80
                    ? 'Good training load balance - avoid sudden increases'
                    : 'Excellent load management - sustainable long-term'
        };
    }

    private calculateIntensityDistribution(activities: StravaActivity[]) {
        let easy = 0, moderate = 0, hard = 0;

        activities.forEach(a => {
            const speedMph = a.average_speed * 2.237;
            if (speedMph < 15) easy++;
            else if (speedMph < 18) moderate++;
            else hard++;
        });

        const total = activities.length;
        return {
            easy: total > 0 ? Math.round((easy / total) * 100) : 0,
            moderate: total > 0 ? Math.round((moderate / total) * 100) : 0,
            hard: total > 0 ? Math.round((hard / total) * 100) : 0
        };
    }

    private calculateWorkloadProgression(activities: StravaActivity[]): string {
        if (activities.length < 6) return 'Appropriate';

        const distances = activities.map(a => a.distance);
        const recent = distances.slice(0, 3).reduce((sum, d) => sum + d, 0) / 3;
        const older = distances.slice(3, 6).reduce((sum, d) => sum + d, 0) / 3;

        if (older === 0) return 'Appropriate';
        const change = ((recent - older) / older) * 100;

        if (change > 15) return 'Too aggressive';
        if (change < -15) return 'Decreasing';
        return 'Appropriate';
    }

    private calculateTrendFromActivities(
        activities: StravaActivity[],
        metric: 'speed' | 'distance'
    ): 'improving' | 'stable' | 'declining' {
        if (activities.length < 6) return 'stable';

        const midpoint = Math.floor(activities.length / 2);
        const recentData = activities.slice(0, midpoint);
        const olderData = activities.slice(midpoint);

        let recentAvg = 0, olderAvg = 0;

        if (metric === 'speed') {
            recentAvg = recentData.reduce((sum, a) => sum + a.average_speed, 0) / recentData.length;
            olderAvg = olderData.reduce((sum, a) => sum + a.average_speed, 0) / olderData.length;
        } else {
            recentAvg = recentData.reduce((sum, a) => sum + a.distance, 0) / recentData.length;
            olderAvg = olderData.reduce((sum, a) => sum + a.distance, 0) / olderData.length;
        }

        if (olderAvg === 0) return 'stable';

        const change = ((recentAvg - olderAvg) / olderAvg) * 100;

        if (change > 5) return 'improving';
        if (change < -5) return 'declining';
        return 'stable';
    }
}

export const trainingMetricsService = new TrainingMetricsService();
