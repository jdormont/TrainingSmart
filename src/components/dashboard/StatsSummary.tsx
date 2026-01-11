import React from 'react';
import { Activity, Clock, MapPin, TrendingUp, Flame } from 'lucide-react';
import type { WeeklyStats } from '../../types';
import { UserStreak } from '../../services/streakService';
import { formatDistance, formatDuration } from '../../utils/formatters';

interface StatsSummaryProps {
  weeklyStats: WeeklyStats;
  streak?: UserStreak | null;
  loading?: boolean;
}

export const StatsSummary: React.FC<StatsSummaryProps> = ({ weeklyStats, streak, loading = false }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-slate-900 rounded-lg shadow-sm border border-slate-800 p-4">
            <div className="animate-pulse">
              <div className="w-8 h-8 bg-slate-800 rounded-full mb-2"></div>
              <div className="h-4 bg-slate-800 rounded mb-1"></div>
              <div className="h-6 bg-slate-800 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  const stats = [
    {
      label: 'Distance',
      value: formatDistance(weeklyStats.totalDistance),
      icon: MapPin,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10 border border-blue-500/20'
    },
    {
      label: 'Time',
      value: formatDuration(weeklyStats.totalTime),
      icon: Clock,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10 border border-green-500/20'
    },
    {
      label: 'Activities',
      value: weeklyStats.activityCount.toString(),
      icon: Activity,
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/10 border border-orange-500/20'
    },
    {
      label: 'Elevation',
      value: `${Math.round(weeklyStats.totalElevation * 3.28084)}ft`,
      icon: TrendingUp,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10 border border-purple-500/20'
    }
  ];

  if (streak) {
    stats.push({
      label: 'Streak',
      value: `${streak.current_streak} Day${streak.current_streak !== 1 ? 's' : ''}`,
      icon: Flame,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10 border border-orange-500/20'
    });
  }

  return (
    <div>
      <div className={`grid grid-cols-2 ${streak ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-4 mb-8`}>
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-slate-900 rounded-lg shadow-sm border border-slate-800 p-4 hover:border-slate-700 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-400">{stat.label}</p>
                  <p className="text-2xl font-bold text-slate-50">{stat.value}</p>
                </div>
                <div className={`p-2 rounded-full ${stat.bgColor}`}>
                  <Icon className={`w-5 h-5 ${stat.color}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-slate-600 text-center mb-4">Powered by Strava</p>
    </div>
  );
};