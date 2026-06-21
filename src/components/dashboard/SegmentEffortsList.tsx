import React from 'react';
import { Mountain, Heart, Zap } from 'lucide-react';
import type { DetailedWorkoutMetrics } from '../../types';

interface SegmentEffortsListProps {
  segments: NonNullable<DetailedWorkoutMetrics['segment_efforts']>;
}

const CLIMB_LABELS: Record<number, string> = { 1: 'Cat 4', 2: 'Cat 3', 3: 'Cat 2', 4: 'Cat 1', 5: 'HC' };

export const SegmentEffortsList: React.FC<SegmentEffortsListProps> = ({ segments }) => {
  if (!segments || segments.length === 0) return null;

  return (
    <div className="bg-slate-800/50 border border-slate-800 rounded-xl p-5">
      <h3 className="font-semibold text-slate-200 mb-4 flex items-center">
        <Mountain className="w-5 h-5 mr-2 text-emerald-500" />
        Segment Efforts
      </h3>
      <div className="space-y-3">
        {segments.map((seg, idx) => {
          const min = Math.floor(seg.moving_time / 60);
          const sec = Math.round(seg.moving_time % 60);
          const durStr = min > 0 ? `${min}m ${sec}s` : `${sec}s`;
          const elevGainFt =
            seg.elevation_high !== undefined && seg.elevation_low !== undefined
              ? Math.round((seg.elevation_high - seg.elevation_low) * 3.28084)
              : null;

          return (
            <div key={`${seg.name}-${idx}`} className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2 gap-2">
                <span className="font-medium text-slate-200">{seg.name}</span>
                <span className="text-sm text-slate-400 whitespace-nowrap">{durStr}</span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-400">
                {seg.avg_power !== undefined && (
                  <span className="flex items-center">
                    <Zap className="w-3.5 h-3.5 mr-1 text-violet-400" />
                    {Math.round(seg.avg_power)}W avg
                    {seg.max_power ? ` / ${Math.round(seg.max_power)}W max` : ''}
                  </span>
                )}
                {seg.avg_hr !== undefined && (
                  <span className="flex items-center">
                    <Heart className="w-3.5 h-3.5 mr-1 text-red-400" />
                    {Math.round(seg.avg_hr)} bpm
                  </span>
                )}
                {seg.average_grade !== undefined && (
                  <span>
                    {seg.average_grade.toFixed(1)}% grade
                    {seg.maximum_grade !== undefined ? ` (${seg.maximum_grade.toFixed(1)}% max)` : ''}
                  </span>
                )}
                {elevGainFt !== null && elevGainFt > 0 && <span>+{elevGainFt} ft</span>}
                {seg.climb_category !== undefined && seg.climb_category > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 text-xs font-medium">
                    {CLIMB_LABELS[seg.climb_category] || `Cat ${seg.climb_category}`}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
