import React from 'react';
import { X, Calendar, Clock, MapPin, TrendingUp, Heart, Zap, Mountain, Trophy, Users, ThumbsUp } from 'lucide-react';
import type { StravaActivity } from '../../types';
import { formatDistance, formatDuration, formatPace, formatDate, formatTime, getActivityIcon } from '../../utils/formatters';

interface ActivityDetailModalProps {
  activity: StravaActivity;
  similarActivities: StravaActivity[];
  onClose: () => void;
}

interface HRZone {
  zone: number;
  name: string;
  min: number;
  max: number;
  color: string;
  percentage: number;
}

export const ActivityDetailModal: React.FC<ActivityDetailModalProps> = ({
  activity,
  similarActivities,
  onClose
}) => {
  // Calculate HR zones (standard 5-zone model)
  const calculateHRZones = (avgHR: number): HRZone[] => {
    if (!avgHR || avgHR === 0) return [];
    
    // Estimate max HR (220 - age, but we'll use 190 as reasonable default)
    const estimatedMaxHR = 190;
    
    const zones: HRZone[] = [
      { zone: 1, name: 'Recovery', min: 0.5, max: 0.6, color: '#10B981', percentage: 0 },
      { zone: 2, name: 'Aerobic', min: 0.6, max: 0.7, color: '#3B82F6', percentage: 0 },
      { zone: 3, name: 'Tempo', min: 0.7, max: 0.8, color: '#F59E0B', percentage: 0 },
      { zone: 4, name: 'Threshold', min: 0.8, max: 0.9, color: '#EF4444', percentage: 0 },
      { zone: 5, name: 'VO2 Max', min: 0.9, max: 1.0, color: '#8B5CF6', percentage: 0 }
    ];

    // Simple estimation: assume normal distribution around average HR
    const currentZone = zones.find(z => 
      avgHR >= (z.min * estimatedMaxHR) && avgHR <= (z.max * estimatedMaxHR)
    );

    if (currentZone) {
      // Simulate time distribution (in real app, this would come from detailed HR data)
      zones.forEach(zone => {
        if (zone.zone === currentZone.zone) {
          zone.percentage = 60; // Most time in current zone
        } else if (Math.abs(zone.zone - currentZone.zone) === 1) {
          zone.percentage = 20; // Some time in adjacent zones
        } else {
          zone.percentage = 0;
        }
      });
    }

    return zones.map(zone => ({
      ...zone,
      min: Math.round(zone.min * estimatedMaxHR),
      max: Math.round(zone.max * estimatedMaxHR)
    }));
  };

  // Find personal records
  const findPRs = () => {
    const prs = [];
    
    // Longest distance
    const longestRide = similarActivities.reduce((longest, ride) => 
      ride.distance > longest.distance ? ride : longest, activity);
    if (longestRide.id === activity.id) {
      prs.push({ type: 'Distance PR', value: formatDistance(activity.distance) });
    }

    // Fastest average speed
    const fastestRide = similarActivities.reduce((fastest, ride) => 
      ride.average_speed > fastest.average_speed ? ride : fastest, activity);
    if (fastestRide.id === activity.id) {
      prs.push({ type: 'Speed PR', value: formatPace(activity.average_speed, activity.type) });
    }

    // Most elevation
    const hilliest = similarActivities.reduce((highest, ride) => 
      (ride.total_elevation_gain || 0) > (highest.total_elevation_gain || 0) ? ride : highest, activity);
    if (hilliest.id === activity.id && activity.total_elevation_gain > 0) {
      prs.push({ type: 'Elevation PR', value: `${Math.round(activity.total_elevation_gain * 3.28084)}ft` });
    }

    return prs;
  };

  // Calculate comparisons with similar rides
  const calculateComparisons = () => {
    if (similarActivities.length === 0) return null;

    const avgDistance = similarActivities.reduce((sum, a) => sum + a.distance, 0) / similarActivities.length;
    const avgSpeed = similarActivities.reduce((sum, a) => sum + a.average_speed, 0) / similarActivities.length;
    const avgElevation = similarActivities.reduce((sum, a) => sum + (a.total_elevation_gain || 0), 0) / similarActivities.length;

    return {
      distance: {
        current: activity.distance,
        average: avgDistance,
        percentDiff: ((activity.distance - avgDistance) / avgDistance) * 100
      },
      speed: {
        current: activity.average_speed,
        average: avgSpeed,
        percentDiff: ((activity.average_speed - avgSpeed) / avgSpeed) * 100
      },
      elevation: {
        current: activity.total_elevation_gain || 0,
        average: avgElevation,
        percentDiff: avgElevation > 0 ? (((activity.total_elevation_gain || 0) - avgElevation) / avgElevation) * 100 : 0
      }
    };
  };

  const hrZones = activity.average_heartrate ? calculateHRZones(activity.average_heartrate) : [];
  const personalRecords = findPRs();
  const comparisons = calculateComparisons();

  // Generate static map URL (using a simple service)
  const getStaticMapUrl = () => {
    if (!activity.map?.summary_polyline) return null;
    
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey || apiKey.includes('your_google_maps_api_key')) {
      return null; // No valid API key
    }
    
    // Security warning for production
    if (import.meta.env.PROD) {
      console.warn('🚨 SECURITY WARNING: Google Maps API key is exposed in frontend! Consider using a backend proxy.');
    }
    
    return `https://maps.googleapis.com/maps/api/staticmap?size=400x200&path=enc:${activity.map.summary_polyline}&key=${apiKey}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="text-2xl">{getActivityIcon(activity.type)}</div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{activity.name}</h2>
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <div className="flex items-center">
                  <Calendar className="w-4 h-4 mr-1" />
                  {formatDate(activity.start_date_local)}
                </div>
                <div className="flex items-center">
                  <Clock className="w-4 h-4 mr-1" />
                  {formatTime(activity.start_date_local)}
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <MapPin className="w-6 h-6 text-blue-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-gray-900">{formatDistance(activity.distance)}</div>
              <div className="text-sm text-gray-600">Distance</div>
            </div>
            
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <Clock className="w-6 h-6 text-green-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-gray-900">{formatDuration(activity.moving_time)}</div>
              <div className="text-sm text-gray-600">Moving Time</div>
            </div>
            
            <div className="bg-orange-50 rounded-lg p-4 text-center">
              <TrendingUp className="w-6 h-6 text-orange-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-gray-900">{formatPace(activity.average_speed, activity.type)}</div>
              <div className="text-sm text-gray-600">Avg Speed</div>
            </div>
            
            {activity.total_elevation_gain > 0 && (
              <div className="bg-purple-50 rounded-lg p-4 text-center">
                <Mountain className="w-6 h-6 text-purple-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-gray-900">
                  {Math.round(activity.total_elevation_gain * 3.28084)}ft
                </div>
                <div className="text-sm text-gray-600">Elevation</div>
              </div>
            )}
            
            {activity.average_heartrate && (
              <div className="bg-red-50 rounded-lg p-4 text-center">
                <Heart className="w-6 h-6 text-red-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-gray-900">{Math.round(activity.average_heartrate)}</div>
                <div className="text-sm text-gray-600">Avg HR</div>
              </div>
            )}
            
            {activity.max_speed && (
              <div className="bg-yellow-50 rounded-lg p-4 text-center">
                <Zap className="w-6 h-6 text-yellow-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-gray-900">{formatPace(activity.max_speed, activity.type)}</div>
                <div className="text-sm text-gray-600">Max Speed</div>
              </div>
            )}
          </div>

          {/* Heart Rate Zones */}
          {hrZones.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                <Heart className="w-5 h-5 mr-2 text-red-500" />
                Heart Rate Zones
              </h3>
              <div className="space-y-3">
                {hrZones.map((zone) => (
                  <div key={zone.zone} className="flex items-center space-x-3">
                    <div className="w-16 text-sm font-medium text-gray-700">
                      Zone {zone.zone}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-600">{zone.name}</span>
                        <span className="text-sm text-gray-600">{zone.min}-{zone.max} bpm</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all duration-300"
                          style={{
                            width: `${zone.percentage}%`,
                            backgroundColor: zone.color
                          }}
                        />
                      </div>
                    </div>
                    <div className="w-12 text-sm text-gray-600 text-right">
                      {zone.percentage}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Route Map */}
          {activity.map?.summary_polyline && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                <MapPin className="w-5 h-5 mr-2 text-blue-500" />
                Route
              </h3>
              {getStaticMapUrl() ? (
                <div className="bg-gray-200 rounded-lg h-48 overflow-hidden">
                  <img
                    src={getStaticMapUrl()!}
                    alt="Activity route map"
                    className="w-full h-full object-cover rounded-lg"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        parent.innerHTML = `
                          <div class="w-full h-full flex items-center justify-center">
                            <div class="text-center text-gray-600">
                              <div class="w-8 h-8 mx-auto mb-2">🗺️</div>
                              <p class="text-sm">Failed to load route map</p>
                              <p class="text-xs">Check your Google Maps API key</p>
                            </div>
                          </div>
                        `;
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="bg-gray-200 rounded-lg h-48 flex items-center justify-center">
                  <div className="text-center text-gray-600">
                    <MapPin className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-sm">Route map would display here</p>
                    <p className="text-xs">(Requires Google Maps API key)</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Personal Records */}
          {personalRecords.length > 0 && (
            <div className="bg-yellow-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                <Trophy className="w-5 h-5 mr-2 text-yellow-600" />
                Personal Records
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {personalRecords.map((pr, index) => (
                  <div key={index} className="bg-white rounded-md p-3 text-center">
                    <div className="text-lg font-bold text-yellow-600">{pr.value}</div>
                    <div className="text-sm text-gray-600">{pr.type}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comparisons */}
          {comparisons && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-4">
                Compared to Similar Rides ({similarActivities.length} rides)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-md p-3">
                  <div className="text-sm text-gray-600 mb-1">Distance</div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{formatDistance(comparisons.distance.current)}</span>
                    <span className={`text-sm ${comparisons.distance.percentDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {comparisons.distance.percentDiff >= 0 ? '+' : ''}{comparisons.distance.percentDiff.toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    Avg: {formatDistance(comparisons.distance.average)}
                  </div>
                </div>

                <div className="bg-white rounded-md p-3">
                  <div className="text-sm text-gray-600 mb-1">Speed</div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{formatPace(comparisons.speed.current, activity.type)}</span>
                    <span className={`text-sm ${comparisons.speed.percentDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {comparisons.speed.percentDiff >= 0 ? '+' : ''}{comparisons.speed.percentDiff.toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    Avg: {formatPace(comparisons.speed.average, activity.type)}
                  </div>
                </div>

                {comparisons.elevation.average > 0 && (
                  <div className="bg-white rounded-md p-3">
                    <div className="text-sm text-gray-600 mb-1">Elevation</div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{Math.round(comparisons.elevation.current * 3.28084)}ft</span>
                      <span className={`text-sm ${comparisons.elevation.percentDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {comparisons.elevation.percentDiff >= 0 ? '+' : ''}{comparisons.elevation.percentDiff.toFixed(1)}%
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      Avg: {Math.round(comparisons.elevation.average * 3.28084)}ft
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Social Stats */}
          {(activity.kudos_count > 0 || activity.comment_count > 0) && (
            <div className="flex items-center justify-center space-x-6 py-4 border-t border-gray-200">
              {activity.kudos_count > 0 && (
                <div className="flex items-center space-x-2 text-gray-600">
                  <ThumbsUp className="w-4 h-4" />
                  <span>{activity.kudos_count} kudos</span>
                </div>
              )}
              {activity.comment_count > 0 && (
                <div className="flex items-center space-x-2 text-gray-600">
                  <Users className="w-4 h-4" />
                  <span>{activity.comment_count} comments</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};