import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ActivityType, Workout, StravaActivity } from '../../types';
import { Info, Snowflake, CheckCircle } from 'lucide-react';
import { UserStreak, streakService } from '../../services/streakService';

interface ConsistencyHeatmapProps {
  isDemoMode?: boolean;
  streak?: UserStreak | null;
  isRestDay?: boolean;
  onStreakUpdate?: (newStreak: UserStreak) => void;
  userId?: string;
  activities?: StravaActivity[];
  onWorkoutClick?: (workout: Workout) => void;
}

// 16 weeks = 112 days
const WEEKS_TO_SHOW = 16;
const DAYS_TO_SHOW = WEEKS_TO_SHOW * 7;

// Layout Grid Constants
const CELL_SIZE = 18; // px
const CELL_GAP = 4; // px
const COL_WIDTH = CELL_SIZE + CELL_GAP; // px

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

const normalizeActivityType = (type: string): ActivityType => {
  const t = type.toLowerCase().trim();
  if (['ride', 'virtualride', 'gravelride', 'mountainbikeride', 'ebikeride', 'bike'].includes(t)) return 'bike';
  if (['run', 'trailrun', 'jog'].includes(t)) return 'run';
  if (['swim'].includes(t)) return 'swim';
  if (['weighttraining', 'workout', 'strength', 'calisthenics'].includes(t)) return 'strength';
  if (['yoga', 'pilates'].includes(t)) return 'yoga';
  if (['hike', 'walk', 'hiking'].includes(t)) return 'hiking';
  return 'rest'; // Fallback
};

const matchesActivityType = (active: string | undefined, legend: string) => {
  if (!active) return false;
  const a = active.toLowerCase();
  const l = legend.toLowerCase();
  if (l === 'cycling' || l === 'bike') return a === 'cycling' || a === 'bike';
  if (l === 'running' || l === 'run') return a === 'running' || a === 'run';
  return a === l;
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
  userId,
  activities = [],
  onWorkoutClick
}) => {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loadingCheckIn, setLoadingCheckIn] = useState(false);
  const [optimisticStreak, setOptimisticStreak] = useState<UserStreak | null>(null);
  
  // Interactive UI States
  const [hoveredActivity, setHoveredActivity] = useState<string | null>(null);
  const [activeTooltip, setActiveTooltip] = useState<{
    x: number;
    y: number;
    data: {
      dateStr: string;
      workouts: Array<{ name: string; type: string; duration: number; completed: boolean }>;
    };
  } | null>(null);

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
        const mapped = await streakService.getWorkoutsInDateRange(
          userProfile.user_id,
          startDate.toISOString().split('T')[0],
          endDate.toISOString().split('T')[0]
        );
        setWorkouts(mapped);
      } catch (err) {
        console.warn('Failed to fetch consistency heatmap data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkouts();
  }, [userProfile?.user_id, isDemoMode]);

  // Compute grid data (Workouts + Strava activities)
  const gridData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find the Sunday that starts the 16-week window
    const currentDayOfWeek = today.getDay(); // 0(Sun) - 6(Sat)
    const daysUntilNextSat = 6 - currentDayOfWeek;
    
    const endDateAligned = new Date(today);
    endDateAligned.setDate(today.getDate() + daysUntilNextSat);
    
    const startDateAligned = new Date(endDateAligned);
    startDateAligned.setDate(endDateAligned.getDate() - DAYS_TO_SHOW + 1);

    // Index DB workouts by YYYY-MM-DD
    const workoutMap = new Map<string, Workout[]>();
    for (const w of workouts) {
      const dateStr = w.scheduledDate.toISOString().split('T')[0];
      if (!workoutMap.has(dateStr)) {
        workoutMap.set(dateStr, []);
      }
      workoutMap.get(dateStr)!.push(w);
    }

    // Index Strava activities by YYYY-MM-DD (exclude demo mode)
    const stravaMap = new Map<string, StravaActivity[]>();
    if (!isDemoMode && activities && activities.length > 0) {
      for (const a of activities) {
        if (!a.start_date_local) continue;
        const dateStr = a.start_date_local.split('T')[0];
        if (!stravaMap.has(dateStr)) {
          stravaMap.set(dateStr, []);
        }
        stravaMap.get(dateStr)!.push(a);
      }
    }

    const cells: HeatmapCell[] = [];
    for (let i = 0; i < DAYS_TO_SHOW; i++) {
        const cellDate = new Date(startDateAligned);
        cellDate.setDate(startDateAligned.getDate() + i);
        const cellDateStr = cellDate.toISOString().split('T')[0];
        
        const dayWorkouts = [...(workoutMap.get(cellDateStr) || [])];
        const dayStrava = stravaMap.get(cellDateStr) || [];
        
        // Filter out Strava activities already linked to workouts (by strava_activity_id) to avoid duplicates
        const linkedStravaIds = new Set(dayWorkouts.map(w => w.strava_activity_id).filter(Boolean));
        
        for (const a of dayStrava) {
            if (!linkedStravaIds.has(a.id)) {
                dayWorkouts.push({
                    id: `strava-${a.id}`,
                    name: a.name,
                    type: normalizeActivityType(a.type || a.sport_type || ''),
                    description: 'Imported from Strava',
                    duration: Math.round(a.moving_time / 60) || 30,
                    intensity: 'moderate',
                    scheduledDate: new Date(a.start_date_local),
                    completed: true,
                    status: 'completed',
                    strava_activity_id: a.id
                });
            }
        }
        
        let primaryActivity;
        if (dayWorkouts.length > 0) {
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

    // Organize into columns of 7 (each column is a week)
    const cols: HeatmapCell[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
        cols.push(cells.slice(i, i + 7));
    }

    return { cols, allCells: cells, lastValidDate: today };
  }, [workouts, activities, isDemoMode]);

  // Compute stats based on workouts and activities up to today
  const stats = useMemo(() => {
     let currentStreak = 0;
     let maxStreak = 0;
     let tempStreak = 0;
     let totalSessions = 0;
     
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
            tempStreak = 0;
        }
     }
     
     let endIdx = gridData.allCells.findIndex(c => c.dateStr === gridData.lastValidDate.toISOString().split('T')[0]);
     if (endIdx === -1) endIdx = gridData.allCells.length - 1;

     const todayCell = gridData.allCells[endIdx];
     const yesterdayCell = gridData.allCells[endIdx - 1];

     if (todayCell && todayCell.hasWorkout) {
         currentStreak = tempStreak;
     } else if (yesterdayCell && yesterdayCell.hasWorkout) {
         currentStreak = tempStreak;
     } else {
         currentStreak = 0;
     }

     return { currentStreak, maxStreak, totalSessions };
  }, [gridData]);

  // Tooltip Interaction Handlers
  const handleCellMouseEnter = (e: React.MouseEvent<HTMLDivElement>, cell: HeatmapCell) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const parent = e.currentTarget.offsetParent;
    const parentRect = parent ? parent.getBoundingClientRect() : { left: 0, top: 0 };
    
    // Position tooltip top-center relative to cell
    const x = rect.left - parentRect.left + rect.width / 2;
    const y = rect.top - parentRect.top;

    setActiveTooltip({
      x,
      y,
      data: {
        dateStr: cell.date.toLocaleDateString(undefined, { 
          weekday: 'long', 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric' 
        }),
        workouts: cell.workouts.map(w => ({
          name: w.name,
          type: w.type,
          duration: w.duration,
          completed: w.completed
        }))
      }
    });
  };

  const handleCellMouseLeave = () => {
    setActiveTooltip(null);
  };

  const handleCellClick = (cell: HeatmapCell) => {
    if (cell.hasWorkout && cell.workouts.length > 0) {
      const sorted = [...cell.workouts].sort((a, b) => b.duration - a.duration);
      onWorkoutClick?.(sorted[0]);
    }
  };

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
          
          <div className="overflow-x-auto pb-6 scrollbar-hide relative">
            <div className="inline-block min-w-max">
               {/* Month labels header */}
               <div className="flex relative h-5" style={{ marginLeft: `${28 + 8}px` }}>
                   {gridData.cols.map((col, colIdx) => {
                       const firstDayOfCol = col[0];
                       const isFirstWeekOfMonth = firstDayOfCol.date.getDate() <= 7;
                       if (!isFirstWeekOfMonth) return null;
                       
                       const monthLabel = firstDayOfCol.date.toLocaleString('default', { month: 'short' });
                       const leftOffset = colIdx * COL_WIDTH;
                       
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
                 <div className="flex flex-col text-[10px] text-slate-500 font-medium uppercase mr-2 text-right w-[28px]" style={{ gap: `${CELL_GAP}px` }}>
                   <div style={{ height: `${CELL_SIZE}px` }}></div>
                   <div style={{ height: `${CELL_SIZE}px` }} className="flex items-center justify-end">Mon</div>
                   <div style={{ height: `${CELL_SIZE}px` }}></div>
                   <div style={{ height: `${CELL_SIZE}px` }} className="flex items-center justify-end">Wed</div>
                   <div style={{ height: `${CELL_SIZE}px` }}></div>
                   <div style={{ height: `${CELL_SIZE}px` }} className="flex items-center justify-end">Fri</div>
                   <div style={{ height: `${CELL_SIZE}px` }}></div>
                 </div>

                 {/* Matrix */}
                 <div className="grid grid-rows-7 grid-flow-col" style={{ gap: `${CELL_GAP}px` }}>
                   {gridData.allCells.map((cell, idx) => {
                       const isFuture = cell.date > gridData.lastValidDate;
                       let bgClass = 'bg-slate-800'; // Default filled empty cell
                       
                       if (isFuture) {
                           bgClass = 'bg-transparent';
                       } else if (cell.hasWorkout) {
                           bgClass = getColorForActivity(cell.primaryActivity || 'rest');
                       }

                       const isToday = cell.dateStr === todayDateStr;
                       
                       // Opacity styling on legend item hover
                       let opacityClass = 'opacity-90';
                       if (hoveredActivity && !isFuture) {
                           const matches = matchesActivityType(cell.primaryActivity, hoveredActivity);
                           opacityClass = matches ? 'opacity-100 scale-105 ring-1 ring-slate-200 shadow-lg' : 'opacity-15';
                       }

                       return (
                           <div 
                             key={idx} 
                             style={{ width: `${CELL_SIZE}px`, height: `${CELL_SIZE}px` }}
                             onMouseEnter={(e) => handleCellMouseEnter(e, cell)}
                             onMouseLeave={handleCellMouseLeave}
                             onClick={() => handleCellClick(cell)}
                             className={`rounded-[3px] transition-all duration-200 ${cell.hasWorkout ? 'cursor-pointer hover:ring-2 hover:ring-slate-400 hover:ring-offset-1 hover:ring-offset-slate-900' : 'cursor-default'} ${bgClass} ${opacityClass} ${isToday ? 'ring-2 ring-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.4)] animate-pulse z-10' : ''}`}
                           ></div>
                       );
                   })}
                 </div>
               </div>
            </div>

            {/* Custom Styled Rich Tooltip */}
            {activeTooltip && (
              <div 
                className="absolute z-50 p-3 text-xs text-slate-200 bg-slate-950/95 backdrop-blur-md border border-slate-800 rounded-xl shadow-2xl pointer-events-none transform -translate-x-1/2 -translate-y-full mb-2.5 flex flex-col gap-1.5 min-w-[200px] transition-all duration-150 ease-out"
                style={{ 
                  left: `${activeTooltip.x}px`, 
                  top: `${activeTooltip.y}px` 
                }}
              >
                <div className="font-semibold text-slate-400 border-b border-slate-800 pb-1.5 mb-0.5 text-[9px] uppercase tracking-wider">
                  {activeTooltip.data.dateStr}
                </div>
                {activeTooltip.data.workouts.length === 0 ? (
                  <div className="text-slate-500 font-medium italic">No workouts logged</div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {activeTooltip.data.workouts.map((w, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 max-w-[130px]">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${getColorForActivity(w.type)}`}></span>
                          <span className="font-medium text-slate-200 truncate">{w.name}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono font-medium">{w.duration}m</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-[1px] border-4 border-transparent border-t-slate-950"></div>
              </div>
            )}
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
      
      {/* Interactive Legend */}
      <div className="mt-8 px-2 flex justify-start flex-wrap gap-x-6 gap-y-3 pb-2">
         {[
           { type: 'cycling', color: 'bg-blue-500' },
           { type: 'running', color: 'bg-green-500' },
           { type: 'strength', color: 'bg-orange-500' },
           { type: 'yoga', color: 'bg-purple-500' },
           { type: 'hiking', color: 'bg-teal-500' },
           { type: 'rest', color: 'bg-amber-600' },
         ].map(leg => (
             <div 
               key={leg.type} 
               onMouseEnter={() => setHoveredActivity(leg.type)}
               onMouseLeave={() => setHoveredActivity(null)}
               className="flex items-center text-xs text-slate-400 font-medium cursor-pointer transition-colors hover:text-slate-200"
             >
                 <div className={`w-3 h-3 rounded-[3px] ${leg.color} opacity-90 mr-2`}></div>
                 <span className="capitalize">{leg.type}</span>
             </div>
         ))}
      </div>
    </div>
  );
};
