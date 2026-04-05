import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { ActivityType, Workout } from '../../types';
import { Info, Snowflake, CheckCircle } from 'lucide-react';
import { UserStreak, streakService } from '../../services/streakService';

interface ConsistencyHeatmapProps {
  isDemoMode?: boolean;
  streak?: UserStreak | null;
  isRestDay?: boolean;
  onStreakUpdate?: (newStreak: UserStreak) => void;
  userId?: string;
}

// 16 weeks = 112 days
const WEEKS_TO_SHOW = 16;
const DAYS_TO_SHOW = WEEKS_TO_SHOW * 7;

const getColorForActivity = (type: ActivityType | string) => {
  switch (type) {
    case 'bike':
    case 'cycling':
      return 'bg-blue-500'; // Brand blue
    case 'run':
    case 'running':
      return 'bg-green-500';
    case 'strength':
      return 'bg-orange-500';
    case 'yoga':
      return 'bg-purple-500';
    case 'hiking':
      return 'bg-teal-500';
    case 'rest':
      return 'bg-amber-600'; // Neutral warm tone
    default:
      return 'bg-slate-500'; // Other
  }
};

interface HeatmapCell {
  date: Date;
  dateStr: string;
  hasWorkout: boolean;
  workouts: Workout[];
  primaryActivity?: ActivityType | string;
}

export const ConsistencyHeatmap: React.FC<ConsistencyHeatmapProps> = ({ 
  isDemoMode = false,
  streak,
  isRestDay,
  onStreakUpdate,
  userId
}) => {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loadingCheckIn, setLoadingCheckIn] = useState(false);
  const [optimisticStreak, setOptimisticStreak] = useState<UserStreak | null>(null);

  useEffect(() => { setOptimisticStreak(null); }, [streak]);
  
  const displayStreak = optimisticStreak || streak;
  const todayDateStr = new Date().toLocaleDateString('en-CA');
  const isActiveToday = displayStreak?.last_activity_date === todayDateStr;

  const handleCheckIn = async () => {
      if (!userId) return;
      setLoadingCheckIn(true);
      try {
          const updated = await streakService.checkInRestDay(userId, todayDateStr);
          if (updated) {
              setOptimisticStreak(updated);
              onStreakUpdate?.(updated);
          }
      } catch (err) {
          console.error(err);
      } finally {
          setLoadingCheckIn(false);
      }
  };

  useEffect(() => {
    const fetchWorkouts = async () => {
      setLoading(true);
      
      const endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
      
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - DAYS_TO_SHOW + 1);
      startDate.setHours(0, 0, 0, 0);

      if (isDemoMode) {
        // Generate mock data for 16 weeks
        const mockWorkouts: Workout[] = [];
        const activityTypes: ActivityType[] = ['run', 'bike', 'swim', 'strength', 'yoga', 'rest', 'hiking'];
        
        for (let i = 0; i < DAYS_TO_SHOW; i++) {
          // ~60% chance of a workout on a given day to show streaks and gaps
          if (Math.random() > 0.4) {
             const wDate = new Date(startDate);
             wDate.setDate(startDate.getDate() + i);
             const rType = activityTypes[Math.floor(Math.random() * activityTypes.length)];
             
             mockWorkouts.push({
               id: `mock-${i}`,
               name: `Mock ${rType}`,
               type: rType,
               description: 'Demo description',
               duration: Math.floor(Math.random() * 60) + 30,
               intensity: Math.random() > 0.8 ? 'hard' : 'moderate',
               scheduledDate: wDate,
               completed: true,
               status: 'completed'
             });
          }
        }
        setWorkouts(mockWorkouts);
        setLoading(false);
        return;
      }

      if (!userProfile?.user_id) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('workouts')
          .select('*')
          .eq('user_id', userProfile.user_id)
          .eq('completed', true)
          .gte('scheduled_date', startDate.toISOString().split('T')[0])
          .lte('scheduled_date', endDate.toISOString().split('T')[0]);

        if (data && !error) {
          const mapped = data.map(d => ({
            ...d,
            type: d.type as ActivityType,
            scheduledDate: new Date(d.scheduled_date + 'T00:00:00'),
          })) as Workout[];
          setWorkouts(mapped);
        }
      } catch (err) {
        console.warn('Failed to fetch consistency heatmap data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkouts();
  }, [userProfile?.user_id, isDemoMode]);

  // Compute grid data
  const gridData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find the Sunday that starts the 16-week window
    // This aligns the grid standard GitHub way (Sunday top to Sat bottom vs Mon-Sun)
    // We'll just build exactly DAYS_TO_SHOW days ending on Today
    const cells: HeatmapCell[] = [];
    
    // Create an array of exactly 16 * 7 days ending with today's week
    // Let's standardise the GitHub style: Columns are weeks, rows are Mon-Sun.
    // If today is Wednesday, the last column ends on Sunday, and future days are empty.
    
    // Find the most recent Sunday as the end of the current week column.
    // If we want today to be the very last day (non-aligned weeks), it's easier, but
    // a standard heatmap is week-aligned.
    const currentDayOfWeek = today.getDay(); // 0(Sun) - 6(Sat)
    // For ISO weeks (Mon = 0... Sun = 6), let's map: Mon=1, Tue=2... Sun=0 -> Sun=7.
    // Standard Github uses Sunday=0 row to Sat=6 row.
    // Let's make the last visible column end on the *upcoming* Saturday to align full weeks.
    const daysUntilNextSat = 6 - currentDayOfWeek;
    
    const endDateAligned = new Date(today);
    endDateAligned.setDate(today.getDate() + daysUntilNextSat);
    
    const startDateAligned = new Date(endDateAligned);
    startDateAligned.setDate(endDateAligned.getDate() - DAYS_TO_SHOW + 1);

    const workoutMap = new Map<string, Workout[]>();
    for (const w of workouts) {
      const dateStr = w.scheduledDate.toISOString().split('T')[0];
      if (!workoutMap.has(dateStr)) {
        workoutMap.set(dateStr, []);
      }
      workoutMap.get(dateStr)!.push(w);
    }

    for (let i = 0; i < DAYS_TO_SHOW; i++) {
        const cellDate = new Date(startDateAligned);
        cellDate.setDate(startDateAligned.getDate() + i);
        const cellDateStr = cellDate.toISOString().split('T')[0];
        
        const dayWorkouts = workoutMap.get(cellDateStr) || [];
        
        let primaryActivity;
        if (dayWorkouts.length > 0) {
            // Priority: longest duration or first logged
            const sorted = [...dayWorkouts].sort((a,b) => b.duration - a.duration);
            primaryActivity = sorted[0].type;
        }

        cells.push({
            date: cellDate,
            dateStr: cellDateStr,
            hasWorkout: dayWorkouts.length > 0,
            workouts: dayWorkouts,
            primaryActivity
        });
    }

    // Now organize into columns of 7 (each column is a week)
    const cols: HeatmapCell[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
        cols.push(cells.slice(i, i + 7));
    }

    return { cols, allCells: cells, lastValidDate: today };
  }, [workouts]);

  // Compute stats based on workouts up to today
  const stats = useMemo(() => {
     let currentStreak = 0;
     let maxStreak = 0;
     let tempStreak = 0;
     let totalSessions = 0;
     
     // Evaluate from oldest to newest explicitly, skipping future days
     for(let i = 0; i < gridData.allCells.length; i++) {
        const cell = gridData.allCells[i];
        if (cell.date > gridData.lastValidDate) continue;

        if (cell.hasWorkout) {
            totalSessions += cell.workouts.length;
            tempStreak++;
            if (tempStreak > maxStreak) {
                maxStreak = tempStreak;
            }
        } else {
            // Check if it was explicitly a missing day vs a planned future day?
            // Already guarding against future days above.
            tempStreak = 0;
        }
     }
     
     // currentStreak is the tempStreak at the very end (Today)
     // But if today is empty, check yesterday. If both are empty, streak is 0.
     let endIdx = gridData.allCells.findIndex(c => c.dateStr === gridData.lastValidDate.toISOString().split('T')[0]);
     if (endIdx === -1) endIdx = gridData.allCells.length - 1;

     const todayCell = gridData.allCells[endIdx];
     const yesterdayCell = gridData.allCells[endIdx - 1];

     if (todayCell && todayCell.hasWorkout) {
         currentStreak = tempStreak;
     } else if (yesterdayCell && yesterdayCell.hasWorkout) {
         currentStreak = tempStreak; // Still active if only today is missed
     } else {
         currentStreak = 0;
     }

     return { currentStreak, maxStreak, totalSessions };
  }, [gridData]);

  if (loading) {
    return (
      <div className="flex animate-pulse flex-col p-6 items-center">
        <div className="w-full h-32 bg-slate-800 rounded-lg mb-4"></div>
        <div className="flex space-x-6">
           <div className="w-20 h-6 bg-slate-800 rounded"></div>
           <div className="w-20 h-6 bg-slate-800 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full p-2">
      <div className="flex flex-col mb-4">
          <div className="flex justify-between items-center mb-6 px-2">
            <div className="flex items-center gap-4">
              <h3 className="text-slate-300 font-medium whitespace-nowrap">Activity History</h3>
              {displayStreak && isRestDay && !isActiveToday && (
                <button 
                  onClick={handleCheckIn}
                  disabled={loadingCheckIn}
                  className="px-2 py-1 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-600/50 rounded text-[11px] font-medium transition-colors"
                >
                  {loadingCheckIn ? '...' : 'Rest Day Check-in'}
                </button>
              )}
              {displayStreak && isActiveToday && isRestDay && (
                 <span className="px-2 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded text-[11px] font-medium flex items-center">
                   <CheckCircle className="w-3 h-3 mr-1" /> Check-in logged
                 </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {displayStreak && (
                <div title="Available Freezes" className="flex items-center space-x-1 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full text-blue-400 text-xs font-medium">
                  <Snowflake className="w-3 h-3" />
                  <span>{displayStreak.streak_freezes}</span>
                </div>
              )}
              <div className="text-slate-500 text-xs hidden sm:flex items-center">
                  <Info className="w-3 h-3 mr-1" /> Last 16 Weeks
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto pb-6 scrollbar-hide">
            <div className="inline-block min-w-max">
               {/* Month labels header */}
               <div className="flex relative h-5 ml-[36px]">
                   {gridData.cols.map((col, colIdx) => {
                       const firstDayOfCol = col[0];
                       const isFirstWeekOfMonth = firstDayOfCol.date.getDate() <= 7;
                       if (!isFirstWeekOfMonth) return null;
                       
                       const monthLabel = firstDayOfCol.date.toLocaleString('default', { month: 'short' });
                       // Each col is 14px wide + 3px gap = 17px
                       const leftOffset = colIdx * 17;
                       
                       return (
                           <span 
                             key={`month-${colIdx}`}
                             className="absolute top-0 text-[10px] text-slate-500 font-medium"
                             style={{ left: `${leftOffset}px` }}
                           >
                              {monthLabel}
                           </span>
                       );
                   })}
               </div>

               <div className="flex">
                 {/* Fixed left axis for days (M, W, F) */}
                 <div className="flex flex-col text-[10px] text-slate-500 font-medium uppercase mr-2 text-right w-[28px]" style={{ gap: '3px' }}>
                   <div style={{ height: '14px' }}></div>
                   <div style={{ height: '14px' }} className="flex items-center justify-end">Mon</div>
                   <div style={{ height: '14px' }}></div>
                   <div style={{ height: '14px' }} className="flex items-center justify-end">Wed</div>
                   <div style={{ height: '14px' }}></div>
                   <div style={{ height: '14px' }} className="flex items-center justify-end">Fri</div>
                   <div style={{ height: '14px' }}></div>
                 </div>

                 {/* Matrix */}
                 <div className="grid grid-rows-7 grid-flow-col" style={{ gap: '3px' }}>
                   {gridData.allCells.map((cell, idx) => {
                       const isFuture = cell.date > gridData.lastValidDate;
                       let bgClass = 'bg-slate-800'; // Default filled empty cell
                       
                       if (isFuture) {
                           bgClass = 'bg-transparent';
                       } else if (cell.hasWorkout) {
                           bgClass = getColorForActivity(cell.primaryActivity || 'rest');
                       }

                       const tooltipContent = isFuture 
                          ? "" 
                          : cell.hasWorkout 
                              ? `${cell.workouts.map(w => w.type).join(', ')} on ${(cell.date).toLocaleDateString()}` 
                              : `No activity on ${(cell.date).toLocaleDateString()}`;

                       return (
                           <div 
                             key={idx} 
                             title={tooltipContent}
                             className={`w-[14px] h-[14px] rounded-[2px] cursor-pointer transition-colors hover:ring-1 hover:ring-slate-400 hover:ring-offset-1 hover:ring-offset-slate-900 ${bgClass}`}
                           ></div>
                       );
                   })}
                 </div>
               </div>
            </div>
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-t border-slate-800 pt-6 mt-2 px-2">
          <div>
             <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Current Streak</div>
             <div className="text-xl font-bold text-slate-200 mt-1">
                 {displayStreak ? displayStreak.current_streak : stats.currentStreak} <span className="text-sm font-normal text-slate-400">days</span>
             </div>
          </div>
         <div>
            <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Longest Streak</div>
            <div className="text-xl font-bold text-orange-500 mt-1">
                {stats.maxStreak} <span className="text-sm font-normal text-slate-400">days</span>
            </div>
         </div>
         <div>
            <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Total Sessions</div>
            <div className="text-xl font-bold text-slate-200 mt-1">
                {stats.totalSessions} <span className="text-sm font-normal text-slate-400">workouts</span>
            </div>
         </div>
      </div>
      
      {/* Legend */}
      <div className="mt-8 px-2 flex justify-start flex-wrap gap-x-6 gap-y-3 pb-2">
         {[
           { type: 'cycling', color: 'bg-blue-500' },
           { type: 'running', color: 'bg-green-500' },
           { type: 'strength', color: 'bg-orange-500' },
           { type: 'yoga', color: 'bg-purple-500' },
           { type: 'hiking', color: 'bg-teal-500' },
           { type: 'rest', color: 'bg-amber-600' },
         ].map(leg => (
             <div key={leg.type} className="flex items-center text-xs text-slate-400 font-medium cursor-default transition-colors hover:text-slate-200">
                 <div className={`w-3 h-3 rounded-[3px] ${leg.color} opacity-90 mr-2`}></div>
                 <span className="capitalize">{leg.type}</span>
             </div>
         ))}
      </div>
    </div>
  );
};
