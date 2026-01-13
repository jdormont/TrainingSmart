import { useMemo, useState, useEffect, useRef } from 'react';
import { Workout, WeeklyStats } from '../../types';
import WorkoutCard from './WorkoutCard';
import { addDays, startOfWeek, format, isSameDay, isWithinInterval, endOfWeek } from 'date-fns';
import { Wand2, Plus } from 'lucide-react';
import { Button } from '../common/Button';
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
import { WeekGroup } from './WeekGroup';
import { UserStreak } from '../../services/streakService';

interface WeeklyPlanViewProps {
  workouts: Workout[];
  startDate: Date;
  onToggleComplete?: (workoutId: string) => void;
  onStatusChange?: (workoutId: string, status: 'planned' | 'completed' | 'skipped') => void;
  onDelete?: (workoutId: string) => void;
  onAddWorkout?: (date: Date) => void;
  onModifyWeek?: (weekIndex: number, weekWorkouts: Workout[]) => void;
  onMoveWorkout?: (workoutId: string, newDate: Date, strategy: 'move' | 'swap' | 'replace') => void;
  onWorkoutClick?: (workout: Workout) => void;
  weeklyStats?: WeeklyStats | null;
  streak?: UserStreak | null;
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
  onMoveWorkout,
  onWorkoutClick,
  weeklyStats,
  streak
}: WeeklyPlanViewProps) {
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

  const [expandedWeekIndex, setExpandedWeekIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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
      const currentWeekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
      
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
        weekEnd: currentWeekEnd,
        days: weekDays,
      });
      currentWeek = addDays(currentWeek, 7);
    }

    return weeksArray;
  }, [workouts]);

  // Determine current week and auto-expand
  useEffect(() => {
    const today = new Date();
    const currentWeekIdx = weeks.findIndex(w => 
      isWithinInterval(today, { start: w.weekStart, end: w.weekEnd })
    );

    if (currentWeekIdx !== -1) {
      // Only set if we haven't manually interacted yet? Or always on load.
      // Since weeks is memoized, this might run once or when workouts change.
      // Better to have a separate 'initialized' state if we don't want to override user interaction.
      // But user requirement says "When the user loads the page".
      // Let's just set it.
      setExpandedWeekIndex(currentWeekIdx);
      
      // Auto-scroll after a short delay to allow rendering
      setTimeout(() => {
        const element = document.getElementById(`week-${currentWeekIdx + 1}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 500);
    } else {
       if (expandedWeekIndex === null && weeks.length > 0) {
           setExpandedWeekIndex(0);
       }
    }
  }, [weeks.length]); // Depend on weeks length so it runs when data is ready.


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
      <div className="bg-slate-900 rounded-lg border border-slate-800 p-8 text-center">
        <p className="text-slate-400">No workouts scheduled yet</p>
      </div>
    );
  }



  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-4" ref={scrollRef}>
        {weeks.map((week, weekIndex) => {
          const weekWorkouts = week.days.flatMap(day => day.workouts);
          
          const today = new Date();
          let status: 'completed' | 'current' | 'upcoming' = 'upcoming';
          if (isWithinInterval(today, { start: week.weekStart, end: week.weekEnd })) {
            status = 'current';
          } else if (today > week.weekEnd) {
            status = 'completed';
          }

          return (
            <WeekGroup
              key={weekIndex}
              weekNumber={weekIndex + 1}
              status={status}
              dateRange={{ start: week.weekStart, end: week.weekEnd }}
              workouts={weekWorkouts}
              isOpen={expandedWeekIndex === weekIndex}
              onToggle={() => setExpandedWeekIndex(expandedWeekIndex === weekIndex ? null : weekIndex)}
              weeklyStats={status === 'current' ? weeklyStats : null}
              streak={status === 'current' ? streak : null}
            >
              {/* Inner Content (Actions + Grid) */}
              <div className="space-y-6">
                 {/* Week Actions */}
                 <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4">
                    <div className="text-sm text-slate-400">
                    </div>
                    <div className="flex items-center space-x-2">
                      {onModifyWeek && weekWorkouts.length > 0 && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => onModifyWeek(weekIndex + 1, weekWorkouts)}
                          className="flex items-center space-x-2 text-xs"
                        >
                          <Wand2 className="w-3 h-3" />
                          <span>AI Coach Adjust</span>
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
                      <div className="text-sm font-medium text-slate-300 mb-2 text-center pointer-events-none select-none">
                        {DAYS_OF_WEEK[dayIndex]}
                        <div className="text-xs text-slate-500">
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
                                onClick={() => onWorkoutClick?.(workout)}
                              />
                            </div>
                          ))
                        ) : (
                          <div className="h-full min-h-[60px] md:min-h-[80px] bg-transparent rounded-lg border-2 border-dashed border-white/5 flex flex-col items-center justify-center space-y-2 p-2 group hover:border-blue-500/50 hover:bg-blue-500/5 transition-colors">
                            <span className="text-xs text-slate-500 group-hover:text-blue-400 pointer-events-none">Rest Day</span>
                            {onAddWorkout && (
                              <button
                                onClick={() => onAddWorkout(day.date)}
                                className="p-1 rounded-full bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors opacity-0 group-hover:opacity-100"
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
            </WeekGroup>
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
