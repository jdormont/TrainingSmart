import { useMemo, useState } from 'react';
import { Workout } from '../../types';
import WorkoutCard from './WorkoutCard';
import { addDays, startOfWeek, format, isSameDay } from 'date-fns';
import { Wand2, Calendar } from 'lucide-react';
import { Button } from '../common/Button';
import { googleCalendarService } from '../../services/googleCalendarService';

interface WeeklyPlanViewProps {
  workouts: Workout[];
  startDate: Date;
  onToggleComplete?: (workoutId: string) => void;
  onModifyWeek?: (weekIndex: number, weekWorkouts: Workout[]) => void;
  onWorkoutsExported?: () => void;
}

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function WeeklyPlanView({ workouts, startDate, onToggleComplete, onModifyWeek, onWorkoutsExported }: WeeklyPlanViewProps) {
  const [exportingWeek, setExportingWeek] = useState<number | null>(null);
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
    <div className="space-y-8">
      {weeks.map((week, weekIndex) => {
        const weekWorkouts = week.days.flatMap(day => day.workouts);
        const alreadyExportedCount = weekWorkouts.filter(w => w.google_calendar_event_id).length;
        const isExporting = exportingWeek === weekIndex;

        return (
        <div key={weekIndex} className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
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
            <div className="flex items-center space-x-2">
              {weekWorkouts.length > 0 && (
                <Button
                  variant="secondary"
                  onClick={() => handleExportWeek(weekIndex, weekWorkouts)}
                  loading={isExporting}
                  className="flex items-center space-x-2"
                >
                  <Calendar className="w-4 h-4" />
                  <span>Export to Calendar</span>
                </Button>
              )}
              {onModifyWeek && weekWorkouts.length > 0 && (
                <Button
                  variant="secondary"
                  onClick={() => onModifyWeek(weekIndex + 1, weekWorkouts)}
                  className="flex items-center space-x-2"
                >
                  <Wand2 className="w-4 h-4" />
                  <span>Modify Week</span>
                </Button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
            {week.days.map((day, dayIndex) => (
              <div key={dayIndex} className="flex flex-col">
                <div className="text-sm font-medium text-gray-700 mb-2 text-center">
                  {DAYS_OF_WEEK[dayIndex]}
                  <div className="text-xs text-gray-500">
                    {format(day.date, 'MMM d')}
                  </div>
                </div>
                <div className="space-y-2 flex-1">
                  {day.workouts.length > 0 ? (
                    day.workouts.map(workout => (
                      <div key={workout.id} className="h-full">
                        <WorkoutCard
                          workout={workout}
                          onToggleComplete={onToggleComplete}
                          showDate={false}
                          compact={true}
                        />
                      </div>
                    ))
                  ) : (
                    <div className="h-full min-h-[80px] bg-gray-50 rounded-lg border border-dashed border-gray-300 flex items-center justify-center">
                      <span className="text-xs text-gray-400">Rest</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
      })}
    </div>
  );
}
