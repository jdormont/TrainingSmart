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
  onClick?: () => void;
}



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
  className = '',
  onClick
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

  // Dynamic Theme Logic
  const getTheme = (intensity: string) => {
    const i = intensity.toLowerCase();
    
    // Hard / Very Hard / Race Pace / Anaerobic / VO2 Max
    if (['hard', 'very hard', 'race pace', 'vo2 max', 'anaerobic'].some(t => i.includes(t))) {
      return {
        bg: 'bg-purple-500/10',
        border: 'border-purple-500/20',
        hover: 'hover:bg-purple-500/20 hover:border-purple-500/50',
        icon: 'text-purple-400',
        text: 'text-purple-200'
      };
    }
    
    // Moderate / Threshold / Tempo / Sweet Spot
    if (['moderate', 'threshold', 'tempo', 'sweet spot'].some(t => i.includes(t))) {
      return {
        bg: 'bg-orange-500/10',
        border: 'border-orange-500/20',
        hover: 'hover:bg-orange-500/20 hover:border-orange-500/50',
        icon: 'text-orange-400',
        text: 'text-orange-200'
      };
    }
    
    // Easy / Recovery / Endurance / Foundation
    if (['easy', 'recovery', 'endurance', 'foundation'].some(t => i.includes(t))) {
      return {
        bg: 'bg-teal-500/10',
        border: 'border-teal-500/20',
        hover: 'hover:bg-teal-500/20 hover:border-teal-500/50',
        icon: 'text-teal-400',
        text: 'text-teal-200'
      };
    }

    // Default Fallback
    return {
      bg: 'bg-slate-800/40',
      border: 'border-white/5',
      hover: 'hover:bg-slate-800/60 hover:border-white/20',
      icon: 'text-slate-400',
      text: 'text-slate-200'
    };
  };

  const theme = getTheme(workout.intensity);

  // Status Overrides
  const getCardStyle = () => {
    if (status === 'completed') return 'border-green-500/30 bg-green-900/10 opacity-75 hover:opacity-100 backdrop-blur-sm';
    if (status === 'skipped') return 'border-red-500/20 bg-slate-900/40 opacity-50 backdrop-blur-sm';
    
    // Default Active Style (Glass Heatmap)
    return `${theme.bg} ${theme.border} backdrop-blur-md ${theme.hover} transition-all duration-300`;
  };

  const getTitleStyle = () => {
    if (status === 'skipped') return 'text-slate-500 line-through decoration-slate-600';
    if (status === 'completed') return 'text-slate-50';
    return 'text-white';
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
      const menuWidth = 192;

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
        className="w-48 bg-slate-900 rounded-md shadow-lg border border-slate-700 py-1"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={(e) => handleAction(() => onStatusChange?.(workout.id, 'completed'), e)}
          className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 flex items-center"
        >
          <Check className="w-4 h-4 mr-2 text-green-600" /> Mark as Completed
        </button>
        <button
          onClick={(e) => handleAction(() => onStatusChange?.(workout.id, 'skipped'), e)}
          className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 flex items-center"
        >
          <XCircle className="w-4 h-4 mr-2 text-gray-500" /> Mark as Skipped
        </button>
        <button
          onClick={(e) => handleAction(() => onStatusChange?.(workout.id, 'planned'), e)}
          className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 flex items-center"
        >
          <Circle className="w-4 h-4 mr-2 text-blue-500" /> Mark as Planned
        </button>
        <div className="border-t border-gray-100 my-1"></div>
        <button
          onClick={(e) => handleAction(() => onDelete?.(workout.id), e)}
          className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 flex items-center"
        >
          <Trash2 className="w-4 h-4 mr-2" /> Delete from Plan
        </button>
      </div>,
      document.body
    );
  };

  // Compact Card - This is the primary tile view
  if (compact) {
    return (
      <div
        className={`rounded-lg overflow-hidden h-full flex flex-col justify-between ${getCardStyle()} ${className} ${expanded ? 'shadow-lg shadow-black/20' : ''} cursor-pointer hover:scale-[1.02] relative`}
        onClick={onClick ? onClick : () => setExpanded(!expanded)}
      >
        <div className="p-3 relative flex-grow flex flex-col">
          <div className="flex items-start justify-between mb-2">
            {/* Minimal Icon sans pill container for cleaner look */}
            <Icon className={`w-5 h-5 ${status === 'skipped' ? 'text-slate-600' : theme.icon} opacity-90`} />

            <div className="flex items-center space-x-2" onClick={e => e.stopPropagation()}>
              {status === 'completed' && (
                <div className="text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.5)]" title="Completed">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              )}
              <div className="relative">
                <button
                  ref={menuTriggerRef}
                  onClick={handleToggleMenu}
                  className="p-1 hover:bg-white/10 rounded-md text-slate-400 hover:text-white transition-colors"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
                {renderMenu()}
              </div>
            </div>
          </div>
          
          <h3 className={`font-semibold text-sm mb-3 line-clamp-2 leading-snug ${getTitleStyle()}`}>
            {workout.name}
          </h3>
          
          {/* Metadata Footer */}
          <div className="mt-auto flex items-center gap-3 text-xs opacity-90">
             {workout.duration > 0 && (
              <div className={`flex items-center font-medium ${status === 'skipped' ? 'text-slate-500' : theme.icon}`}>
                <Clock className="w-3 h-3 mr-1" />
                <span>{handleFormatDuration(workout.duration)}</span>
              </div>
            )}
             {workout.distance && (
              <div className={`flex items-center font-medium ${status === 'skipped' ? 'text-slate-500' : theme.icon}`}>
                <MapPin className="w-3 h-3 mr-1" />
                <span>{handleFormatDistance(workout.distance)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Expanded / List View (kept similar logic but updated themes)
  return (
    <div
      className={`rounded-lg transition-all duration-300 ${getCardStyle()} ${expanded ? 'shadow-lg shadow-black/20' : ''}`}
    >
      <div
        className="p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-start space-x-3 flex-1">
            <div
              className={`p-2 rounded-lg ${status === 'skipped' ? 'bg-slate-800 text-slate-500' : theme.bg + ' ' + theme.icon} flex-shrink-0`}
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
                <div className="text-sm text-slate-400 mb-2">
                  {formatDate(workout.scheduledDate)}
                </div>
              )}
              <div className="flex flex-wrap gap-3 text-sm text-slate-200">
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
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${status === 'skipped' ? 'bg-gray-100 text-gray-500' : theme.bg + ' ' + theme.icon}`}
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
                className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-200"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
              {renderMenu()}
            </div>
            <button
              onClick={handleExportToCalendar}
              disabled={exporting || !!workout.google_calendar_event_id}
              className={`p-2 rounded-lg transition-colors flex-shrink-0 ${workout.google_calendar_event_id
                ? 'text-green-500 cursor-default'
                : 'hover:bg-slate-700/50 text-slate-400 hover:text-slate-200'
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
          <div className="mt-4 pt-4 border-t border-slate-700">
            <div
              className="prose prose-sm prose-invert max-w-none text-slate-200 prose-p:text-slate-200 prose-li:text-slate-200"
              dangerouslySetInnerHTML={{
                __html: convertMarkdownToHtml(workout.description),
              }}
            />
          </div>
        )}

        {!expanded && workout.description && (
          <div className="mt-2 text-sm text-slate-500/80 italic">
            Click to expand...
          </div>
        )}
      </div>
    </div>
  );
}
