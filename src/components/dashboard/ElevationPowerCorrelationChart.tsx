import React from 'react';
import { Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart } from 'recharts';
import { Mountain } from 'lucide-react';
import type { DetailedWorkoutMetrics } from '../../types';

interface ElevationPowerCorrelationChartProps {
  profile: NonNullable<DetailedWorkoutMetrics['elevation_power_profile']>;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; name: string; dataKey: string; color: string }>;
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800 p-3 border border-slate-700 rounded-lg shadow-lg z-50">
        <p className="font-medium text-slate-50 mb-2">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} style={{ color: entry.color }} className="text-sm">
            {`${entry.name}: ${entry.value}${entry.dataKey === 'avg_hr' ? ' bpm' : 'W'}`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export const ElevationPowerCorrelationChart: React.FC<ElevationPowerCorrelationChartProps> = ({ profile }) => {
  if (!profile || profile.length === 0) return null;

  const hasHr = profile.some(p => p.avg_hr !== undefined);

  return (
    <div className="bg-slate-800/50 border border-slate-800 rounded-xl p-5">
      <h3 className="font-semibold text-slate-200 mb-4 flex items-center">
        <Mountain className="w-5 h-5 mr-2 text-emerald-500" />
        Power by Terrain
      </h3>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={profile} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis dataKey="grade_bucket" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} dy={10} />
            <YAxis yAxisId="power" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} width={40} />
            {hasHr && (
              <YAxis yAxisId="hr" orientation="right" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} width={40} />
            )}
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148,163,184,0.05)' }} />
            <Bar yAxisId="power" dataKey="avg_power" name="Avg Power" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            {hasHr && (
              <Line
                yAxisId="hr"
                type="monotone"
                dataKey="avg_hr"
                name="Avg HR"
                stroke="#f87171"
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
