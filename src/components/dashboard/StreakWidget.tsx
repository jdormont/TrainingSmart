
import React, { useState } from 'react';
import { Flame, Snowflake, CheckCircle, Info } from 'lucide-react';
import { UserStreak, streakService } from '../../services/streakService';
import { format } from 'date-fns';
import { analytics } from '../../lib/analytics';

interface StreakWidgetProps {
    streak: UserStreak | null;
    isRestDay: boolean;
    onStreakUpdate: (newStreak: UserStreak) => void;
    userId: string;
}

export const StreakWidget: React.FC<StreakWidgetProps> = ({ streak, isRestDay, onStreakUpdate, userId }) => {
    const [loading, setLoading] = useState(false);
    const [optimisticStreak, setOptimisticStreak] = useState<UserStreak | null>(null);

    // Sync optimistic state when real data arrives from parent
    React.useEffect(() => {
        setOptimisticStreak(null);
    }, [streak]);

    // specific toggle for display
    const displayStreak = optimisticStreak || streak;

    // Determine active state locally
    const today = format(new Date(), 'yyyy-MM-dd');
    const isActiveToday = displayStreak?.last_activity_date === today;

    const handleCheckIn = async () => {
        setLoading(true);
        try {
            const updated = await streakService.checkInRestDay(userId, today);
            if (updated) {
                analytics.track('streak_checkin_completed', { date: today, type: 'active_recovery' });
                setOptimisticStreak(updated); // Instant feedback
                onStreakUpdate(updated);
            }
        } catch (error) {
            console.error('Failed to check in:', error);
            analytics.track('streak_checkin_failed', { error: (error as Error).message });
        } finally {
            setLoading(false);
        }
    };

    if (!displayStreak) return null;

    return (
        <div className="bg-slate-900 rounded-xl shadow-lg shadow-black/20 border border-slate-800 p-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-semibold text-slate-50">Training Streak</h3>
                    <div className="group relative">
                        <Info className="w-4 h-4 text-slate-500 cursor-help" />
                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-2 bg-slate-800 text-slate-200 text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-slate-700">
                            Log a workout or check-in on rest days to keep your streak alive. Frozen days use banked freezes.
                        </div>
                    </div>
                </div>
                <div className="flex items-center space-x-1 bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded-full text-blue-400 text-sm font-medium">
                    <Snowflake className="w-3 h-3" />
                    <span>{displayStreak.streak_freezes}</span>
                </div>
            </div>

            <div className="flex items-end space-x-3 mb-6">
                <div className={`p-3 rounded-xl ${displayStreak.current_streak > 0 ? 'bg-orange-500/20 text-orange-500' : 'bg-slate-800 text-slate-500'}`}>
                    <Flame className={`w-8 h-8 ${displayStreak.current_streak > 0 ? 'animate-pulse' : ''}`} fill={displayStreak.current_streak > 0 ? "currentColor" : "none"} />
                </div>
                <div>
                    <div className="text-4xl font-bold text-slate-50 leading-none">
                        {displayStreak.current_streak}
                    </div>
                    <div className="text-sm text-slate-500 font-medium mt-1">
                        Days
                    </div>
                </div>
            </div>

            {isActiveToday ? (
                <div className="flex items-center justify-center p-3 bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg text-sm font-medium animate-fade-in">
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Streak Extended!
                </div>
            ) : (
                <div className="space-y-3">
                    {isRestDay ? (
                        <button
                            onClick={handleCheckIn}
                            disabled={loading}
                            className="w-full flex items-center justify-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg transition-colors font-medium disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Checking in...' : 'Active Recovery Check-in'}
                        </button>
                    ) : (
                        <div className="text-center text-sm text-slate-500 italic">
                            Log today's workout to extend
                        </div>
                    )}
                </div>
            )}

            {displayStreak.streak_freezes === 0 && displayStreak.current_streak > 0 && !isActiveToday && (
                <p className="text-xs text-orange-500 mt-3 text-center">
                    Warning: No freezes left. Streak at risk!
                </p>
            )}
        </div>
    );
};
