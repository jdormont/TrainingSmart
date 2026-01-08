import React from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { MessageCircle, Calendar, RefreshCw, ChevronRight, Activity, Clock, Zap } from 'lucide-react';
import { Button } from '../common/Button';
import type { StravaAthlete, WeeklyStats } from '../../types';
import type { WeeklyInsight } from '../../services/weeklyInsightService';
import { formatDistance, formatDuration } from '../../utils/formatters';
import { ROUTES } from '../../utils/constants';
import { analytics } from '../../lib/analytics';

interface DashboardHeroProps {
    athlete: StravaAthlete | null;
    weeklyInsight: WeeklyInsight | null;
    weeklyStats: WeeklyStats | null;
    onRefreshInsight?: () => void;
    insightLoading?: boolean;
}

export const DashboardHero: React.FC<DashboardHeroProps> = ({
    athlete,
    weeklyInsight,
    weeklyStats,
    onRefreshInsight,
    insightLoading = false
}) => {
    const navigate = useNavigate();
    const currentDate = format(new Date(), 'EEEE, MMMM do');

    // Insight colors based on type or readiness
    const getInsightStyles = () => {
        if (!weeklyInsight) return { bg: 'bg-gray-50', border: 'border-gray-100', text: 'text-gray-700', icon: 'text-gray-400' };

        // Use readiness score if available for color coding
        if (weeklyInsight.readinessScore !== undefined) {
            if (weeklyInsight.readinessScore >= 80) return { bg: 'bg-green-50', border: 'border-green-100', text: 'text-green-800', icon: 'text-green-600' };
            if (weeklyInsight.readinessScore <= 50) return { bg: 'bg-red-50', border: 'border-red-100', text: 'text-red-800', icon: 'text-red-600' };
            return { bg: 'bg-orange-50', border: 'border-orange-100', text: 'text-orange-800', icon: 'text-orange-600' };
        }

        // Fallback to type-based coloring
        switch (weeklyInsight.type) {
            case 'recovery': return { bg: 'bg-green-50', border: 'border-green-100', text: 'text-green-800', icon: 'text-green-600' };
            case 'training': return { bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-800', icon: 'text-blue-600' };
            case 'pattern': return { bg: 'bg-purple-50', border: 'border-purple-100', text: 'text-purple-800', icon: 'text-purple-600' };
            default: return { bg: 'bg-orange-50', border: 'border-orange-100', text: 'text-orange-800', icon: 'text-orange-600' };
        }
    };

    const styles = getInsightStyles();

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-orange-100 overflow-hidden relative">
            {/* Decorative gradient background opacity */}
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-orange-400 to-orange-100"></div>

            <div className="p-6 md:p-8">
                {/* Top Row: Welcome & Date */}
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                            Welcome back, {athlete?.firstname || 'Athlete'}!
                        </h1>
                        <p className="text-gray-500 font-medium mt-1">{currentDate}</p>
                    </div>
                    {/* Optional: Add user avatar or streak logic here later */}
                </div>

                {/* Middle Row: Insight & Stats Split */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">

                    {/* Left: Weekly Insight (Bio-Aware) - Spans 7 cols */}
                    <div className={`lg:col-span-7 rounded-xl border ${styles.border} ${styles.bg} p-5 relative transition-all duration-300`}>
                        <div className="flex flex-col h-full justify-between">
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center space-x-2">
                                        <Zap className={`w-5 h-5 ${styles.icon}`} fill="currentColor" fillOpacity={0.2} />
                                        <span className={`text-sm font-bold uppercase tracking-wide ${styles.text}`}>Weekly Insight</span>
                                    </div>
                                    {onRefreshInsight && (
                                        <button onClick={onRefreshInsight} className={`p-1 rounded-full hover:bg-white/50 transition-colors ${insightLoading ? 'animate-spin' : ''}`}>
                                            <RefreshCw className={`w-3.5 h-3.5 ${styles.text}`} />
                                        </button>
                                    )}
                                </div>

                                {insightLoading ? (
                                    <div className="h-16 flex items-center justify-center">
                                        <div className="w-6 h-6 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
                                    </div>
                                ) : weeklyInsight ? (
                                    <>
                                        <h3 className="font-bold text-gray-900 mb-1">{weeklyInsight.title}</h3>
                                        <p className="text-gray-700 text-sm leading-relaxed">{weeklyInsight.message}</p>
                                    </>
                                ) : (
                                    <div className="text-sm text-gray-500 italic">Analysis pending more data...</div>
                                )}
                            </div>

                            {weeklyInsight?.actionLabel && (
                                <div className="mt-4 pt-3 border-t border-black/5 flex justify-end">
                                    <button
                                        onClick={() => navigate(weeklyInsight.actionLink || ROUTES.CHAT)}
                                        className={`text-xs font-semibold uppercase flex items-center ${styles.text} hover:opacity-80 transition-opacity`}
                                    >
                                        {weeklyInsight.actionLabel} <ChevronRight className="w-3 h-3 ml-1" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: "This Week" Compact Stats - Spans 5 cols */}
                    <div className="lg:col-span-5 flex flex-col justify-center">
                        <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 pl-1">This Week</h4>

                        <div className="grid grid-cols-2 gap-3">
                            {/* Distance */}
                            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                <div className="flex items-center gap-2 mb-1">
                                    <Activity className="w-4 h-4 text-blue-500" />
                                    <span className="text-xs text-gray-500 font-medium">Distance</span>
                                </div>
                                <div className="text-xl font-bold text-gray-900">
                                    {weeklyStats ? formatDistance(weeklyStats.totalDistance) : '0mi'}
                                </div>
                            </div>

                            {/* Time */}
                            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                <div className="flex items-center gap-2 mb-1">
                                    <Clock className="w-4 h-4 text-orange-500" />
                                    <span className="text-xs text-gray-500 font-medium">Time</span>
                                </div>
                                <div className="text-xl font-bold text-gray-900">
                                    {weeklyStats ? formatDuration(weeklyStats.totalTime) : '0h 0m'}
                                </div>
                            </div>

                            {/* Activity Count - Optional/Hidden to match Reference Image compactness if needed, but useful */}
                            {/* Using Reference Image style: It has Distance, Time, and Readiness vertical list... 
                  But grid is also good. I'll stick to a clean grid. 
                  Let's add Readiness if available in the insight, otherwise Activities count.
              */}

                            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 col-span-2 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Zap className="w-4 h-4 text-purple-500" />
                                    <span className="text-xs text-gray-500 font-medium">
                                        {weeklyInsight?.readinessScore !== undefined ? 'Readiness Score' : 'Activities'}
                                    </span>
                                </div>
                                <div className="text-xl font-bold text-gray-900">
                                    {weeklyInsight?.readinessScore !== undefined
                                        ? weeklyInsight.readinessScore
                                        : (weeklyStats?.activityCount || 0)}
                                    {weeklyInsight?.readinessScore !== undefined && (
                                        <span className="text-xs font-normal text-gray-400 ml-1">/ 100</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Row: Action Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Button
                        variant="primary"
                        size="lg"
                        onClick={() => {
                            analytics.track('insight_action_taken', { type: 'chat' });
                            navigate(ROUTES.CHAT);
                        }}
                        className="w-full justify-center shadow-orange-100 shadow-lg hover:shadow-xl transition-all"
                    >
                        <MessageCircle className="w-5 h-5 mr-2" />
                        Chat with AI Coach
                    </Button>
                    <Button
                        variant="outline"
                        size="lg"
                        onClick={() => {
                            analytics.track('insight_action_taken', { type: 'plans' });
                            navigate(ROUTES.PLANS);
                        }}
                        className="w-full justify-center bg-white hover:bg-gray-50"
                    >
                        <Calendar className="w-5 h-5 mr-2" />
                        View Training Plans
                    </Button>
                </div>
            </div>
        </div>
    );
};
