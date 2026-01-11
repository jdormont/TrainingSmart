import React from 'react';
import { Calendar, Clock, MapPin, TrendingUp } from 'lucide-react';
import type { StravaActivity } from '../../types';
import { formatDistance, formatDuration, formatPace, formatDate, getActivityIcon, getActivityColor } from '../../utils/formatters';

interface ActivityCardProps {
  activity: StravaActivity;
  onClick?: () => void;
}

export const ActivityCard: React.FC<ActivityCardProps> = ({ activity, onClick }) => {
  const activityColor = getActivityColor(activity.type);
  const activityIcon = getActivityIcon(activity.type);

  const isOutdoorRide = activity.type === 'Ride' ||
                        (activity.sport_type && activity.sport_type.includes('Ride') &&
                         !activity.sport_type.includes('Virtual'));

  return (
    <div
      className="bg-slate-800/40 backdrop-blur-sm rounded-lg shadow-lg shadow-black/20 border-b border-slate-700/50 p-4 hover:bg-slate-800/80 transition-all cursor-pointer group"
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center space-x-3 min-w-0 flex-1">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center font-semibold flex-shrink-0 shadow-md bg-slate-700"
          >
            <span className="text-lg" style={{ color: activityColor }}>{activityIcon}</span>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-slate-50 truncate group-hover:text-orange-500 transition-colors">
              {activity.name}
            </h3>
            <div className="flex items-center text-sm text-slate-400">
              <Calendar className="w-4 h-4 mr-1 flex-shrink-0" />
              {formatDate(activity.start_date_local)}
            </div>
          </div>
        </div>
        <span className="text-xs font-medium px-2 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 whitespace-nowrap flex-shrink-0">
          {activity.type}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="flex items-center text-slate-300">
          <MapPin className="w-4 h-4 mr-2 text-slate-500" />
          <span className="font-medium">{formatDistance(activity.distance)}</span>
        </div>
        <div className="flex items-center text-slate-300">
          <Clock className="w-4 h-4 mr-2 text-slate-500" />
          <span className="font-medium">{formatDuration(activity.moving_time)}</span>
        </div>
        <div className="flex items-center text-slate-300">
          <TrendingUp className="w-4 h-4 mr-2 text-slate-500" />
          <span className="font-medium">{formatPace(activity.average_speed, activity.type)}</span>
        </div>
        {activity.total_elevation_gain > 0 && (
          <div className="flex items-center text-slate-300">
            <span className="text-slate-500 mr-2">⛰️</span>
            <span className="font-medium">{Math.round(activity.total_elevation_gain * 3.28084)}ft</span>
          </div>
        )}
      </div>

      {activity.kudos_count > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-800">
          <div className="flex items-center text-sm text-slate-500">
            <span className="mr-1">👍</span>
            <span>{activity.kudos_count} kudos</span>
          </div>
        </div>
      )}

      {isOutdoorRide && (
        <div className="mt-3 pt-3 border-t border-slate-800">
          <p className="text-xs text-slate-600 italic">
            Insights derived in part from Garmin device-sourced data.
          </p>
        </div>
      )}
    </div>
  );
};