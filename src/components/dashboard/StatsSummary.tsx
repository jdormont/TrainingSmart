import React from 'react';
import { Activity, Clock, MapPin, TrendingUp } from 'lucide-react';
import type { WeeklyStats } from '../../types';
import { formatDistance, formatDuration } from '../../utils/formatters';

interface StatsSummaryProps {
  weeklyStats: WeeklyStats;
  loading?: boolean;
}

export const StatsSummary: React.FC<StatsSummaryProps> = ({ weeklyStats, loading = false }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="animate-pulse">
              <div className="w-8 h-8 bg-gray-200 rounded-full mb-2"></div>
              <div className="h-4 bg-gray-200 rounded mb-1"></div>
              <div className="h-6 bg-gray-200 rounded"></div>
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
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      label: 'Time',
      value: formatDuration(weeklyStats.totalTime),
      icon: Clock,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      label: 'Activities',
      value: weeklyStats.activityCount.toString(),
      icon: Activity,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    },
    {
      label: 'Elevation',
      value: `${Math.round(weeklyStats.totalElevation * 3.28084)}ft`,
      icon: TrendingUp,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    }
  ];

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
                <div className={`p-2 rounded-full ${stat.bgColor}`}>
                  <Icon className={`w-5 h-5 ${stat.color}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-gray-500 text-center mb-4">Powered by Strava</p>
    </div>
  );
};