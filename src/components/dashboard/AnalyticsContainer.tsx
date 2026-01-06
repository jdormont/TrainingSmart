import React, { useState } from 'react';
import { BarChart2, Activity, Heart } from 'lucide-react';
import { TrainingTrendsChart } from './TrainingTrendsChart';
import { HealthSpiderChart } from './HealthSpiderChart';
import { StravaOnlySpiderChart } from './StravaOnlySpiderChart';
import { RecoveryCard } from './RecoveryCard';
import type { StravaActivity, StravaAthlete, OuraSleepData, OuraReadinessData, DailyMetric } from '../../types';
import type { HealthMetrics } from '../../services/weeklyInsightService';

interface AnalyticsContainerProps {
    activities: StravaActivity[];
    athlete: StravaAthlete | null;
    healthMetrics: HealthMetrics | null;
    sleepData: OuraSleepData | null;
    readinessData: OuraReadinessData | null;
    dailyMetric: DailyMetric | null;
    loading?: boolean;
}

type TabType = 'trends' | 'health' | 'recovery';

export const AnalyticsContainer: React.FC<AnalyticsContainerProps> = ({
    activities,
    athlete,
    healthMetrics,
    sleepData,
    readinessData,
    dailyMetric,
    loading = false
}) => {
    const [activeTab, setActiveTab] = useState<TabType>('trends');

    const hasOuraData = !!(sleepData || readinessData);

    // Tab Definitions
    const tabs = [
        { id: 'trends', label: 'Training Trends', icon: BarChart2 },
        { id: 'health', label: 'Health Balance', icon: Activity },
        { id: 'recovery', label: 'Recovery', icon: Heart },
    ];

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Tabs Header */}
            <div className="border-b border-gray-100 flex items-center px-6 overflow-x-auto scrollbar-hide">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as TabType)}
                            className={`flex items-center space-x-2 py-4 px-4 border-b-2 transition-colors whitespace-nowrap ${isActive
                                ? 'border-orange-500 text-orange-600 font-semibold'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200'
                                }`}
                        >
                            <Icon className={`w-4 h-4 ${isActive ? 'text-orange-500' : 'text-gray-400'}`} />
                            <span>{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Tab Content */}
            <div className="p-6">
                {/* TAB 1: Training Trends */}
                <div className={activeTab === 'trends' ? 'block' : 'hidden'}>
                    <TrainingTrendsChart
                        activities={activities}
                        athlete={athlete}
                        healthMetrics={healthMetrics}
                        todayReadiness={readinessData}
                    />
                </div>

                {/* TAB 2: Health Balance */}
                <div className={activeTab === 'health' ? 'block' : 'hidden'}>
                    {hasOuraData ? (
                        <HealthSpiderChart
                            healthMetrics={healthMetrics}
                            loading={loading}
                        />
                    ) : (
                        <>
                            {athlete && (
                                <StravaOnlySpiderChart
                                    athlete={athlete}
                                    activities={activities}
                                    loading={loading}
                                />
                            )}
                            {/* Suggest Oura if using Strava Only view logic can be handled inside the chart or here */}
                        </>
                    )}
                </div>

                {/* TAB 3: Recovery */}
                <div className={activeTab === 'recovery' ? 'block' : 'hidden'}>
                    <RecoveryCard
                        sleepData={sleepData}
                        readinessData={readinessData}
                        dailyMetric={dailyMetric}
                        loading={loading}
                    />
                </div>
            </div>
        </div>
    );
};
