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
      className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center space-x-3 min-w-0 flex-1">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0"
            style={{ backgroundColor: activityColor }}
          >
            <span className="text-lg">{activityIcon}</span>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-gray-900 truncate">
              {activity.name}
            </h3>
            <div className="flex items-center text-sm text-gray-500">
              <Calendar className="w-4 h-4 mr-1 flex-shrink-0" />
              {formatDate(activity.start_date_local)}
            </div>
          </div>
        </div>
        <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-600 whitespace-nowrap flex-shrink-0">
          {activity.type}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="flex items-center text-gray-600">
          <MapPin className="w-4 h-4 mr-2 text-gray-400" />
          <span className="font-medium">{formatDistance(activity.distance)}</span>
        </div>
        <div className="flex items-center text-gray-600">
          <Clock className="w-4 h-4 mr-2 text-gray-400" />
          <span className="font-medium">{formatDuration(activity.moving_time)}</span>
        </div>
        <div className="flex items-center text-gray-600">
          <TrendingUp className="w-4 h-4 mr-2 text-gray-400" />
          <span className="font-medium">{formatPace(activity.average_speed, activity.type)}</span>
        </div>
        {activity.total_elevation_gain > 0 && (
          <div className="flex items-center text-gray-600">
            <span className="text-gray-400 mr-2">⛰️</span>
            <span className="font-medium">{Math.round(activity.total_elevation_gain * 3.28084)}ft</span>
          </div>
        )}
      </div>

      {activity.kudos_count > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center text-sm text-gray-500">
            <span className="mr-1">👍</span>
            <span>{activity.kudos_count} kudos</span>
          </div>
        </div>
      )}

      {isOutdoorRide && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-400 italic">
            Insights derived in part from Garmin device-sourced data.
          </p>
        </div>
      )}
    </div>
  );
};