import { useMemo, useState } from 'react';
import { Workout } from '../../types';
import WorkoutCard from './WorkoutCard';
import { addDays, startOfWeek, format, isSameDay } from 'date-fns';
import { Wand2, Calendar, Plus } from 'lucide-react';
import { Button } from '../common/Button';
import { googleCalendarService } from '../../services/googleCalendarService';
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  TouchSensor,
  DragStartEvent,
  DragEndEvent,
  MouseSensor
} from '@dnd-kit/core';
import { DraggableWorkoutCard } from './DraggableWorkoutCard';
import { DroppableDayColumn } from './DroppableDayColumn';
import { ConflictResolutionModal } from './ConflictResolutionModal';
import { analytics } from '../../lib/analytics';

interface WeeklyPlanViewProps {
  workouts: Workout[];
  startDate: Date;
  onToggleComplete?: (workoutId: string) => void;
  onStatusChange?: (workoutId: string, status: 'planned' | 'completed' | 'skipped') => void;
  onDelete?: (workoutId: string) => void;
  onAddWorkout?: (date: Date) => void;
  onModifyWeek?: (weekIndex: number, weekWorkouts: Workout[]) => void;
  onWorkoutsExported?: () => void;
  onMoveWorkout?: (workoutId: string, newDate: Date, strategy: 'move' | 'swap' | 'replace') => void;
}

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function WeeklyPlanView({
  workouts,
  startDate,
  onToggleComplete,
  onStatusChange,
  onDelete,
  onAddWorkout,
  onModifyWeek,
  onWorkoutsExported,
  onMoveWorkout
}: WeeklyPlanViewProps) {
  const [exportingWeek, setExportingWeek] = useState<number | null>(null);
  const [activeDragItem, setActiveDragItem] = useState<Workout | null>(null);
  const [conflictModal, setConflictModal] = useState<{
    isOpen: boolean;
    sourceWorkout: Workout | null;
    targetWorkout: Workout | null;
    targetDate: Date | null;
  }>({
    isOpen: false,
    sourceWorkout: null,
    targetWorkout: null,
    targetDate: null,
  });

  // Configure sensors for mobile/desktop support
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  );

  const weeks = useMemo(() => {
    if (workouts.length === 0) return [];

    const allDates = workouts.map(w => new Date(w.scheduledDate));
    const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));

    const weekStart = startOfWeek(minDate, { weekStartsOn: 1 });
    const weekEnd = startOfWeek(maxDate, { weekStartsOn: 1 });

    const weeksArray = [];
    let currentWeek = weekStart;

    while (currentWeek <= weekEnd) {
      const weekDays = [];
      for (let i = 0; i < 7; i++) {
        const day = addDays(currentWeek, i);
        const dayWorkouts = workouts.filter(w =>
          isSameDay(new Date(w.scheduledDate), day)
        );
        weekDays.push({
          date: day,
          workouts: dayWorkouts,
        });
      }
      weeksArray.push({
        weekStart: currentWeek,
        days: weekDays,
      });
      currentWeek = addDays(currentWeek, 7);
    }

    return weeksArray;
  }, [workouts]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const workout = active.data.current?.workout as Workout;
    setActiveDragItem(workout);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragItem(null);
    const { active, over } = event;

    if (!over) return;

    const sourceWorkoutId = active.id as string;
    const targetDateString = over.id as string;

    // Parse the date strictly from YYYY-MM-DD
    const [year, month, day] = targetDateString.split('-').map(Number);
    const targetDate = new Date(year, month - 1, day);

    const sourceWorkout = workouts.find(w => w.id === sourceWorkoutId);
    if (!sourceWorkout) return;

    // Check if target date is same as source date
    if (isSameDay(new Date(sourceWorkout.scheduledDate), targetDate)) return;

    // Check for existing workout on target date
    const targetWorkout = workouts.find(w =>
      isSameDay(new Date(w.scheduledDate), targetDate)
    );

    if (targetWorkout) {
      // Conflict detected
      setConflictModal({
        isOpen: true,
        sourceWorkout,
        targetWorkout,
        targetDate,
      });
    } else {
      // Simple move
      onMoveWorkout?.(sourceWorkoutId, targetDate, 'move');
      analytics.track('workout_rescheduled', { method: 'drag', type: 'move' });
    }
  };

  const closeConflictModal = () => {
    setConflictModal({ ...conflictModal, isOpen: false });
  };

  const handleSwap = () => {
    if (conflictModal.sourceWorkout && conflictModal.targetDate) {
      onMoveWorkout?.(conflictModal.sourceWorkout.id, conflictModal.targetDate, 'swap');
      analytics.track('workout_rescheduled', { method: 'drag', type: 'swap' });
      closeConflictModal();
    }
  };

  const handleReplace = () => {
    if (conflictModal.sourceWorkout && conflictModal.targetDate) {
      onMoveWorkout?.(conflictModal.sourceWorkout.id, conflictModal.targetDate, 'replace');
      analytics.track('workout_rescheduled', { method: 'drag', type: 'replace' });
      closeConflictModal();
    }
  };

  if (workouts.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <p className="text-gray-500">No workouts scheduled yet</p>
      </div>
    );
  }

  const handleExportWeek = async (weekIndex: number, weekWorkouts: Workout[]) => {
    if (weekWorkouts.length === 0) {
      alert('No workouts to export for this week');
      return;
    }

    const isConnected = await googleCalendarService.isConnected();
    if (!isConnected) {
      if (confirm('Google Calendar is not connected. Would you like to go to Settings to connect it?')) {
        window.location.href = '/settings';
      }
      return;
    }

    const workoutsToExport = weekWorkouts.filter(w => !w.google_calendar_event_id);
    if (workoutsToExport.length === 0) {
      alert('All workouts in this week have already been exported to Google Calendar.');
      return;
    }

    const confirmed = confirm(
      `Export ${workoutsToExport.length} workout(s) to Google Calendar?\n\n` +
      `${workoutsToExport.length === weekWorkouts.length ? 'All workouts' : `${workoutsToExport.length} of ${weekWorkouts.length} workouts`} will be added to your calendar.`
    );

    if (!confirmed) return;

    setExportingWeek(weekIndex);
    try {
      const results = await googleCalendarService.exportWorkoutsToCalendar(workoutsToExport);

      if (results.success > 0) {
        let message = `Successfully exported ${results.success} workout(s) to Google Calendar!`;
        if (results.failed > 0) {
          message += `\n\n${results.failed} workout(s) failed to export:\n` + results.errors.join('\n');
        }
        alert(message);
        onWorkoutsExported?.();
      } else {
        alert(`Failed to export workouts:\n` + results.errors.join('\n'));
      }
    } catch (error) {
      console.error('Failed to export week:', error);
      alert(`Failed to export: ${(error as Error).message}`);
    } finally {
      setExportingWeek(null);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-8">
        {weeks.map((week, weekIndex) => {
          const weekWorkouts = week.days.flatMap(day => day.workouts);
          const alreadyExportedCount = weekWorkouts.filter(w => w.google_calendar_event_id).length;
          const isExporting = exportingWeek === weekIndex;

          return (
            <div key={weekIndex} className="bg-white rounded-lg border border-gray-200 p-6">
              {/* Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Week {weekIndex + 1} - {format(week.weekStart, 'MMM d, yyyy')}
                  </h3>
                  {alreadyExportedCount > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      {alreadyExportedCount} of {weekWorkouts.length} workout(s) already in calendar
                    </p>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
                  {weekWorkouts.length > 0 && (
                    <Button
                      variant="secondary"
                      onClick={() => handleExportWeek(weekIndex, weekWorkouts)}
                      loading={isExporting}
                      className="flex items-center justify-center space-x-2"
                    >
                      <Calendar className="w-4 h-4" />
                      <span>Export to Calendar</span>
                    </Button>
                  )}
                  {onModifyWeek && weekWorkouts.length > 0 && (
                    <Button
                      variant="secondary"
                      onClick={() => onModifyWeek(weekIndex + 1, weekWorkouts)}
                      className="flex items-center justify-center space-x-2"
                    >
                      <Wand2 className="w-4 h-4" />
                      <span>Modify Week</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* Grid */}
              <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
                {week.days.map((day, dayIndex) => (
                  <DroppableDayColumn
                    key={dayIndex}
                    date={day.date}
                    className="flex flex-col"
                  >
                    <div className="text-sm font-medium text-gray-700 mb-2 text-center pointer-events-none select-none">
                      {DAYS_OF_WEEK[dayIndex]}
                      <div className="text-xs text-gray-500">
                        {format(day.date, 'MMM d')}
                      </div>
                    </div>

                    <div className="space-y-2 flex-1 min-h-[60px] md:min-h-[100px]">
                      {day.workouts.length > 0 ? (
                        day.workouts.map(workout => (
                          <div key={workout.id} className="w-full">
                            <DraggableWorkoutCard
                              workout={workout}
                              onToggleComplete={onToggleComplete}
                              onStatusChange={onStatusChange}
                              onDelete={onDelete}
                            />
                          </div>
                        ))
                      ) : (
                        <div className="h-full min-h-[60px] md:min-h-[80px] bg-gray-50/50 rounded-lg border border-dashed border-gray-300 flex flex-col items-center justify-center space-y-2 p-2 group hover:border-blue-300 hover:bg-blue-50/10 transition-colors">
                          <span className="text-xs text-gray-400 group-hover:text-blue-400 pointer-events-none">Rest Day</span>
                          {onAddWorkout && (
                            <button
                              onClick={() => onAddWorkout(day.date)}
                              className="p-1 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors opacity-0 group-hover:opacity-100"
                              title="Add Workout"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </DroppableDayColumn>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <DragOverlay>
        {activeDragItem ? (
          <WorkoutCard
            workout={activeDragItem}
            showDate={false}
            compact={true}
            className="shadow-2xl ring-2 ring-blue-500 rotate-2 scale-105 opacity-90 cursor-grabbing"
          />
        ) : null}
      </DragOverlay>

      <ConflictResolutionModal
        isOpen={conflictModal.isOpen}
        onClose={closeConflictModal}
        sourceWorkout={conflictModal.sourceWorkout}
        targetWorkout={conflictModal.targetWorkout}
        targetDate={conflictModal.targetDate}
        onSwap={handleSwap}
        onReplace={handleReplace}
      />
    </DndContext>
  );
}
