
import React from 'react';
import { UserStreak } from '../../services/streakService';
import { format, subDays } from 'date-fns';
import { Flame, Snowflake } from 'lucide-react';

interface StreakHistoryProps {
    streak: UserStreak;
}

export const StreakHistory: React.FC<StreakHistoryProps> = ({ streak }) => {
    const today = new Date();
    const last30Days = Array.from({ length: 30 }, (_, i) => {
        const date = subDays(today, 29 - i);
        return {
            date,
            formatted: format(date, 'yyyy-MM-dd'),
            dayStr: format(date, 'EEE'), // Mon, Tue...
            dayNum: format(date, 'd')
        };
    });

    // Helper to find history item or infer status
    const getDayStatus = (dateStr: string) => {
        const historyItem = streak.streak_history.find(h => h.date === dateStr);
        if (historyItem) return historyItem.type;

        // If not in history, check if it was covered by a streak update that implied it? 
        // Our service pushes to history for every processed day (activity/rest/freeze).
        // So if missing, likely no activity tracked or gap.
        return 'none';
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">30-Day Streak History</h3>
                <div className="flex items-center space-x-4 text-xs text-gray-500">
                    <div className="flex items-center">
                        <div className="w-3 h-3 bg-orange-500 rounded-sm mr-1"></div>
                        <span>Active</span>
                    </div>
                    <div className="flex items-center">
                        <div className="w-3 h-3 bg-emerald-500 rounded-sm mr-1"></div>
                        <span>Rest Check-in</span>
                    </div>
                    <div className="flex items-center">
                        <div className="w-3 h-3 bg-blue-400 rounded-sm mr-1"></div>
                        <span>Freeze Used</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-7 gap-1">
                {/* Weekday Headers */}
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                    <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">
                        {d}
                    </div>
                ))}

                {/* Empty cells for alignment if needed? We assume 30 days ending today. 
                     We should probably align to week start usually, but simple list is fine.
                     Let's just dump 30 days. Actually a calendar view is better. 
                     Let's strictly map to weeks.
                 */}
            </div>
            <div className="grid grid-cols-7 gap-2 mt-2">
                {/* Adjust offset for first day */}
                {Array.from({ length: last30Days[0].date.getDay() }).map((_, i) => (
                    <div key={`empty-${i}`} />
                ))}

                {last30Days.map(({ formatted, dayNum }) => {
                    const status = getDayStatus(formatted);

                    let bgClass = 'bg-gray-100 text-gray-400';
                    let icon = null;

                    if (status === 'activity') {
                        bgClass = 'bg-orange-100 border border-orange-200 text-orange-600';
                        icon = <Flame className="w-3 h-3" fill="currentColor" />;
                    } else if (status === 'rest_checkin') {
                        bgClass = 'bg-emerald-100 border border-emerald-200 text-emerald-600';
                        icon = <div className="w-2 h-2 rounded-full bg-emerald-500" />;
                    } else if (status === 'freeze_used') {
                        bgClass = 'bg-blue-100 border border-blue-200 text-blue-600';
                        icon = <Snowflake className="w-3 h-3" />;
                    }

                    return (
                        <div key={formatted} className={`aspect-square rounded-lg flex flex-col items-center justify-center relative group ${bgClass}`}>
                            <span className="text-xs font-medium">{dayNum}</span>
                            {icon && <div className="mt-1">{icon}</div>}

                            {/* Tooltip */}
                            <div className="absolute bottom-full mb-2 hidden group-hover:block z-10 w-32 bg-gray-900 text-white text-xs rounded p-2 text-center">
                                {formatted}: {status === 'none' ? 'No Activity' : status.replace('_', ' ')}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="mt-6 flex justify-between items-center bg-gray-50 p-4 rounded-lg">
                <div>
                    <p className="text-sm text-gray-500">Current Streak</p>
                    <p className="text-2xl font-bold text-gray-900">{streak.current_streak} days</p>
                </div>
                <div className="text-right">
                    <p className="text-sm text-gray-500">Longest Streak</p>
                    <p className="text-xl font-semibold text-gray-700">{streak.longest_streak} days</p>
                </div>
            </div>
        </div>
    );
};
