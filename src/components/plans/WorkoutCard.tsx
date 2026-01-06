import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Bike, CheckCircle2, Circle, Clock, MapPin, Activity, Heart, Calendar, MoreVertical, XCircle, Trash2, Check } from 'lucide-react';
import { Workout } from '../../types';
import { convertMarkdownToHtml } from '../../utils/markdownToHtml';
import { googleCalendarService } from '../../services/googleCalendarService';

interface WorkoutCardProps {
  workout: Workout;
  onStatusChange?: (workoutId: string, status: 'planned' | 'completed' | 'skipped') => void;
  onDelete?: (workoutId: string) => void;
  showDate?: boolean;
  compact?: boolean;
  className?: string; // Support for DragOverlay styling
  onWorkoutExported?: () => void;
  onToggleComplete?: (workoutId: string) => void;
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

export default function WorkoutCard({
  workout,
  onStatusChange,
  onDelete,
  onWorkoutExported,
  showDate = true,
  compact = false,
  className = ''
}: WorkoutCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const menuDropdownRef = useRef<HTMLDivElement>(null);
  const Icon = TYPE_ICONS[workout.type] || Activity;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuDropdownRef.current &&
        !menuDropdownRef.current.contains(event.target as Node) &&
        menuTriggerRef.current &&
        !menuTriggerRef.current.contains(event.target as Node)
      ) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Update menu position on scroll to ensure it stays anchored if page scrolls
  useEffect(() => {
    if (!showMenu) return;

    function handleScroll() {
      setShowMenu(false); // Simplest approach: close menu on scroll
    }

    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [showMenu]);

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

  const handleFormatDistance = (meters?: number) => {
    if (!meters) return null;
    const miles = meters / 1609.34;
    return miles.toFixed(1);
  };

  const handleFormatDuration = (minutes: number) => {
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

  const status = workout.status || (workout.completed ? 'completed' : 'planned');

  const getCardStyle = () => {
    if (status === 'completed') return 'border-green-300 bg-green-50/30';
    if (status === 'skipped') return 'border-gray-200 bg-gray-50 opacity-75';
    return 'border-gray-200 hover:border-orange-300 hover:shadow-md';
  };

  const getTitleStyle = () => {
    if (status === 'skipped') return 'text-gray-500 line-through decoration-gray-400';
    if (status === 'completed') return 'text-gray-900';
    return 'text-gray-900';
  };

  const handleAction = (action: () => void, e: React.MouseEvent) => {
    e.stopPropagation();
    action();
    setShowMenu(false);
  };

  const handleToggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (showMenu) {
      setShowMenu(false);
      return;
    }

    if (menuTriggerRef.current) {
      const rect = menuTriggerRef.current.getBoundingClientRect();
      const menuWidth = 192; // approximate width of w-48 (12rem * 16px)

      setMenuPosition({
        top: rect.bottom + window.scrollY,
        left: rect.right - menuWidth + window.scrollX
      });
      setShowMenu(true);
    }
  };

  const renderMenu = () => {
    if (!showMenu) return null;

    return createPortal(
      <div
        ref={menuDropdownRef}
        style={{
          position: 'absolute',
          top: `${menuPosition.top}px`,
          left: `${menuPosition.left}px`,
          zIndex: 9999
        }}
        className="w-48 bg-white rounded-md shadow-lg border border-gray-200 py-1"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={(e) => handleAction(() => onStatusChange?.(workout.id, 'completed'), e)}
          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center"
        >
          <Check className="w-4 h-4 mr-2 text-green-600" /> Mark as Completed
        </button>
        <button
          onClick={(e) => handleAction(() => onStatusChange?.(workout.id, 'skipped'), e)}
          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center"
        >
          <XCircle className="w-4 h-4 mr-2 text-gray-500" /> Mark as Skipped
        </button>
        <button
          onClick={(e) => handleAction(() => onStatusChange?.(workout.id, 'planned'), e)}
          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center"
        >
          <Circle className="w-4 h-4 mr-2 text-blue-500" /> Mark as Planned
        </button>
        <div className="border-t border-gray-100 my-1"></div>
        <button
          onClick={(e) => handleAction(() => onDelete?.(workout.id), e)}
          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"
        >
          <Trash2 className="w-4 h-4 mr-2" /> Delete from Plan
        </button>
      </div>,
      document.body
    );
  };

  if (compact) {
    return (
      <div
        className={`bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow h-full flex flex-col ${getCardStyle()} ${className} ${expanded ? 'shadow-lg' : ''}`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="p-3 relative">
          <div className="flex items-start justify-between mb-2">
            <div
              className={`p-1.5 rounded-md ${status === 'skipped' ? 'bg-gray-100 text-gray-400' : INTENSITY_COLORS[workout.intensity]} flex-shrink-0`}
            >
              <Icon className="w-4 h-4" />
            </div>

            <div className="flex items-center space-x-1" onClick={e => e.stopPropagation()}>
              <div className="relative">
                <button
                  ref={menuTriggerRef}
                  onClick={handleToggleMenu}
                  className="p-1 hover:bg-gray-100 rounded-md text-gray-400 hover:text-gray-600"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
                {renderMenu()}
              </div>
            </div>
          </div>
          <h3 className={`font-medium text-sm mb-2 line-clamp-2 leading-tight ${getTitleStyle()}`}>
            {workout.name}
          </h3>
          <div className="space-y-1 text-xs text-gray-600">
            {workout.duration > 0 && (
              <div className="flex items-center">
                <Clock className="w-3 h-3 mr-1 flex-shrink-0" />
                <span className="truncate">{handleFormatDuration(workout.duration)}</span>
              </div>
            )}
            {workout.distance && (
              <div className="flex items-center">
                <MapPin className="w-3 h-3 mr-1 flex-shrink-0" />
                <span className="truncate">{handleFormatDistance(workout.distance)} mi</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status === 'skipped' ? 'bg-gray-100 text-gray-500' : INTENSITY_COLORS[workout.intensity]}`}>
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
      className={`bg-white rounded-lg border-2 transition-all ${getCardStyle()} ${expanded ? 'shadow-lg' : ''}`}
    >
      <div
        className="p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-start space-x-3 flex-1">
            <div
              className={`p-2 rounded-lg ${status === 'skipped' ? 'bg-gray-100 text-gray-400' : INTENSITY_COLORS[workout.intensity]} flex-shrink-0`}
            >
              <Icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className={`font-semibold mb-1 flex items-center ${getTitleStyle()}`}>
                {workout.name}
                {status === 'completed' && (
                  <CheckCircle2 className="w-4 h-4 ml-2 text-green-600" />
                )}
                {status === 'skipped' && (
                  <span className="ml-2 text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full">Skipped</span>
                )}
                {workout.google_calendar_event_id && (
                  <div title="In Google Calendar">
                    <Calendar className="w-4 h-4 ml-2 text-green-600" />
                  </div>
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
                    {handleFormatDuration(workout.duration)}
                  </div>
                )}
                {workout.distance && (
                  <div className="flex items-center">
                    <MapPin className="w-4 h-4 mr-1" />
                    {handleFormatDistance(workout.distance)} mi
                  </div>
                )}
                <div className="flex items-center">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${status === 'skipped' ? 'bg-gray-100 text-gray-500' : INTENSITY_COLORS[workout.intensity]
                      }`}
                  >
                    {workout.intensity}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2 ml-2" onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
            <div className="relative">
              <button
                ref={menuTriggerRef}
                onClick={handleToggleMenu}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
              {renderMenu()}
            </div>
            <button
              onClick={handleExportToCalendar}
              disabled={exporting || !!workout.google_calendar_event_id}
              className={`p-2 rounded-lg transition-colors flex-shrink-0 ${workout.google_calendar_event_id
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
