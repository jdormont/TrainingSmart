import { useState } from 'react';
import { Bike, CheckCircle2, Circle, Clock, MapPin, Activity, Heart, Calendar } from 'lucide-react';
import { Workout } from '../../types';
import { convertMarkdownToHtml } from '../../utils/markdownToHtml';
import { googleCalendarService } from '../../services/googleCalendarService';

interface WorkoutCardProps {
  workout: Workout;
  onToggleComplete?: (workoutId: string) => void;
  showDate?: boolean;
  compact?: boolean;
  onWorkoutExported?: () => void;
}

const INTENSITY_COLORS = {
  easy: 'bg-green-50 border-green-200 text-green-700',
  recovery: 'bg-blue-50 border-blue-200 text-blue-700',
  moderate: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  hard: 'bg-red-50 border-red-200 text-red-700',
};

const TYPE_ICONS = {
  bike: Bike,
  run: Activity,
  swim: Activity,
  strength: Heart,
  rest: Circle,
};

export default function WorkoutCard({ workout, onToggleComplete, showDate = true, compact = false, onWorkoutExported }: WorkoutCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [exporting, setExporting] = useState(false);
  const Icon = TYPE_ICONS[workout.type] || Activity;

  const handleToggleComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleComplete?.(workout.id);
  };

  const handleExportToCalendar = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (workout.google_calendar_event_id) {
      alert('This workout has already been exported to Google Calendar.');
      return;
    }

    const isConnected = await googleCalendarService.isConnected();
    if (!isConnected) {
      if (confirm('Google Calendar is not connected. Would you like to go to Settings to connect it?')) {
        window.location.href = '/settings';
      }
      return;
    }

    setExporting(true);
    try {
      await googleCalendarService.exportWorkoutToCalendar(workout);
      alert(`"${workout.name}" has been added to your Google Calendar!`);
      onWorkoutExported?.();
    } catch (error) {
      console.error('Failed to export workout:', error);
      alert(`Failed to export: ${(error as Error).message}`);
    } finally {
      setExporting(false);
    }
  };

  const formatDistance = (meters?: number) => {
    if (!meters) return null;
    const miles = meters / 1609.34;
    return miles.toFixed(1);
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(date);
  };

  if (compact) {
    return (
      <div
        className={`bg-white rounded-lg border-2 transition-all cursor-pointer h-full ${
          workout.completed
            ? 'border-green-300 bg-green-50/30'
            : 'border-gray-200 hover:border-orange-300 hover:shadow-md'
        } ${expanded ? 'shadow-lg' : ''}`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="p-3">
          <div className="flex items-start justify-between mb-2">
            <div
              className={`p-1.5 rounded-md ${INTENSITY_COLORS[workout.intensity]} flex-shrink-0`}
            >
              <Icon className="w-4 h-4" />
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={handleExportToCalendar}
                disabled={exporting || !!workout.google_calendar_event_id}
                className={`p-1 rounded-md transition-colors flex-shrink-0 ${
                  workout.google_calendar_event_id
                    ? 'text-green-600 cursor-default'
                    : 'hover:bg-gray-100 text-gray-600'
                }`}
                title={workout.google_calendar_event_id ? 'Already in calendar' : 'Export to Google Calendar'}
              >
                {exporting ? (
                  <Activity className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Calendar className="w-3.5 h-3.5" />
                )}
              </button>
              {onToggleComplete && (
                <button
                  onClick={handleToggleComplete}
                  className="p-1 hover:bg-gray-100 rounded-md transition-colors flex-shrink-0"
                  title={workout.completed ? 'Mark incomplete' : 'Mark complete'}
                >
                  {workout.completed ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : (
                    <Circle className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              )}
            </div>
          </div>
          <h3 className="font-medium text-sm text-gray-900 mb-2 line-clamp-2 leading-tight">
            {workout.name}
          </h3>
          <div className="space-y-1 text-xs text-gray-600">
            {workout.duration > 0 && (
              <div className="flex items-center">
                <Clock className="w-3 h-3 mr-1 flex-shrink-0" />
                <span className="truncate">{formatDuration(workout.duration)}</span>
              </div>
            )}
            {workout.distance && (
              <div className="flex items-center">
                <MapPin className="w-3 h-3 mr-1 flex-shrink-0" />
                <span className="truncate">{formatDistance(workout.distance)} mi</span>
              </div>
            )}
            <div className="flex items-center">
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  INTENSITY_COLORS[workout.intensity]
                }`}
              >
                {workout.intensity}
              </span>
            </div>
          </div>
          {!expanded && workout.description && (
            <div className="mt-2 text-xs text-gray-500 italic">
              Click to see details...
            </div>
          )}
        </div>
        {expanded && workout.description && (
          <div className="px-3 pb-3 pt-0 border-t border-gray-200 mt-2">
            <div
              className="prose prose-xs max-w-none text-gray-700 text-xs"
              dangerouslySetInnerHTML={{
                __html: convertMarkdownToHtml(workout.description),
              }}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`bg-white rounded-lg border-2 transition-all ${
        workout.completed
          ? 'border-green-300 bg-green-50/30'
          : 'border-gray-200 hover:border-orange-300 hover:shadow-md'
      } ${expanded ? 'shadow-lg' : ''}`}
    >
      <div
        className="p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-start space-x-3 flex-1">
            <div
              className={`p-2 rounded-lg ${INTENSITY_COLORS[workout.intensity]} flex-shrink-0`}
            >
              <Icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 mb-1 flex items-center">
                {workout.name}
                {workout.completed && (
                  <CheckCircle2 className="w-4 h-4 ml-2 text-green-600" />
                )}
                {workout.google_calendar_event_id && (
                  <Calendar className="w-4 h-4 ml-2 text-green-600" title="In Google Calendar" />
                )}
              </h3>
              {showDate && workout.scheduledDate && (
                <div className="text-sm text-gray-600 mb-2">
                  {formatDate(workout.scheduledDate)}
                </div>
              )}
              <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                {workout.duration > 0 && (
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 mr-1" />
                    {formatDuration(workout.duration)}
                  </div>
                )}
                {workout.distance && (
                  <div className="flex items-center">
                    <MapPin className="w-4 h-4 mr-1" />
                    {formatDistance(workout.distance)} mi
                  </div>
                )}
                <div className="flex items-center">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      INTENSITY_COLORS[workout.intensity]
                    }`}
                  >
                    {workout.intensity}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2 ml-2">
            <button
              onClick={handleExportToCalendar}
              disabled={exporting || !!workout.google_calendar_event_id}
              className={`p-2 rounded-lg transition-colors flex-shrink-0 ${
                workout.google_calendar_event_id
                  ? 'text-green-600 cursor-default'
                  : 'hover:bg-gray-100 text-gray-600'
              }`}
              title={workout.google_calendar_event_id ? 'Already in calendar' : 'Export to Google Calendar'}
            >
              {exporting ? (
                <Activity className="w-5 h-5 animate-spin" />
              ) : (
                <Calendar className="w-5 h-5" />
              )}
            </button>
            {onToggleComplete && (
              <button
                onClick={handleToggleComplete}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                title={workout.completed ? 'Mark incomplete' : 'Mark complete'}
              >
                {workout.completed ? (
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                ) : (
                  <Circle className="w-6 h-6 text-gray-400" />
                )}
              </button>
            )}
          </div>
        </div>

        {expanded && workout.description && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div
              className="prose prose-sm max-w-none text-gray-700"
              dangerouslySetInnerHTML={{
                __html: convertMarkdownToHtml(workout.description),
              }}
            />
          </div>
        )}

        {!expanded && workout.description && (
          <div className="mt-2 text-sm text-gray-500">
            Click to see details...
          </div>
        )}
      </div>
    </div>
  );
}
