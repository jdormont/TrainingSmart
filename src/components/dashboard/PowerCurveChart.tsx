import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Zap } from 'lucide-react';
import type { StravaActivity } from '../../types';
import { selectPowerCurveComparison } from '../../utils/powerCurveSelectors';

interface PowerCurveChartProps {
  activities: StravaActivity[];
  recentDays?: number;
  priorRangeDays?: number;
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
            {`${entry.name}: ${entry.value}W`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export const PowerCurveChart: React.FC<PowerCurveChartProps> = ({
  activities,
  recentDays = 30,
  priorRangeDays = 60
}) => {
  const data = selectPowerCurveComparison(activities, recentDays, priorRangeDays);

  return (
    <div className="bg-slate-900 rounded-lg shadow-lg shadow-black/20 border border-slate-800 p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-slate-50 mb-1 flex items-center">
          <Zap className="w-5 h-5 mr-2 text-violet-500" />
          Power Curve
        </h3>
        <p className="text-slate-400 text-xs">
          Best power per duration: last {recentDays} days vs. the {priorRangeDays} days before that
        </p>
      </div>

      {data.length === 0 ? (
        <div className="h-60 flex items-center justify-center text-center text-slate-500 text-sm px-8">
          Sync a few more rides with power data to see your power curve here.
        </div>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="duration" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} dy={10} />
              <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} width={40} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '4 4' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="prior"
                name={`Prior ${priorRangeDays}d`}
                stroke="#64748b"
                strokeWidth={2}
                dot={{ fill: '#1e293b', stroke: '#64748b', strokeWidth: 2, r: 3 }}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="recent"
                name={`Last ${recentDays}d`}
                stroke="#8b5cf6"
                strokeWidth={3}
                dot={{ fill: '#1e293b', stroke: '#8b5cf6', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="mt-2 text-center">
        <p className="text-[10px] text-slate-600">
          Best watts held for each duration across synced rides. Compare windows to track power growth over time.
        </p>
      </div>
    </div>
  );
};
