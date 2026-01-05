// Utility functions for formatting data

export const formatDistance = (meters: number): string => {
  const miles = meters * 0.000621371;
  if (miles < 0.1) {
    const feet = meters * 3.28084;
    return `${Math.round(feet)}ft`;
  }
  return `${miles.toFixed(1)}mi`;
};

export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${remainingSeconds}s`;
};

export const formatPace = (metersPerSecond: number, activityType: string = 'Run'): string => {
  if (activityType === 'Run' || activityType === 'Walk') {
    // Convert to min/mile
    const secondsPerMile = 1609.34 / metersPerSecond;
    const minutes = Math.floor(secondsPerMile / 60);
    const seconds = Math.round(secondsPerMile % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}/mi`;
  } else {
    // Convert to mph for cycling, etc.
    const mph = (metersPerSecond * 2.23694);
    return `${mph.toFixed(1)} mph`;
  }
};

export const formatElevation = (meters: number): string => {
  const feet = meters * 3.28084;
  return `${Math.round(feet)}ft`;
};

export const formatDate = (dateString: string): string => {
  // Strip 'Z' if present to force local time parsing (treat as wall clock time)
  const localDateString = dateString.endsWith('Z') ? dateString.slice(0, -1) : dateString;
  const date = new Date(localDateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const formatTime = (dateString: string): string => {
  // Strip 'Z' if present to force local time parsing (treat as wall clock time)
  const localDateString = dateString.endsWith('Z') ? dateString.slice(0, -1) : dateString;
  const date = new Date(localDateString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

export const getActivityIcon = (activityType: string): string => {
  const iconMap: Record<string, string> = {
    'Run': '🏃',
    'Ride': '🚴',
    'Swim': '🏊',
    'Hike': '🥾',
    'Walk': '🚶',
    'Workout': '💪',
    'Yoga': '🧘',
    'WeightTraining': '🏋️',
  };
  return iconMap[activityType] || '🏃';
};

export const getActivityColor = (activityType: string): string => {
  const colorMap: Record<string, string> = {
    'Run': '#EF4444',
    'Ride': '#3B82F6',
    'Swim': '#06B6D4',
    'Hike': '#10B981',
    'Walk': '#8B5CF6',
    'Workout': '#F59E0B',
    'Yoga': '#EC4899',
  };
  return colorMap[activityType] || '#6B7280';
};