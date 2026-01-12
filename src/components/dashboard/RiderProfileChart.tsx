import React, { useState, useEffect } from 'react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from 'recharts';
import type { RiderProfile } from '../../services/healthMetricsService';
import { SkillCard } from './SkillCard';

interface RiderProfileChartProps {
  profile: RiderProfile;
}

export const RiderProfileChart: React.FC<RiderProfileChartProps> = ({ profile }) => {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  // Map profile to array for chart
  const data = [
    { subject: 'Discipline', ...profile.discipline, fullMark: 10, key: 'discipline' },
    { subject: 'Capacity', ...profile.capacity, fullMark: 10, key: 'capacity' },
    { subject: 'Stamina', ...profile.stamina, fullMark: 10, key: 'stamina' },
    { subject: 'Punch', ...profile.punch, fullMark: 10, key: 'punch' },
    { subject: 'Form', ...profile.form, fullMark: 10, key: 'form' },
  ];

  // Colors
  const getTier = (level: number) => {
    if (level >= 9) return { name: 'Pro', color: '#a855f7' }; // Purple
    if (level >= 7) return { name: 'Puncheur', color: '#f97316' }; // Orange
    if (level >= 4) return { name: 'Rouleur', color: '#2dd4bf' }; // Teal
    return { name: 'Rookie', color: '#94a3b8' }; // Slate
  };

  // Set initial expanded key to the lowest level (weakness focus)
  useEffect(() => {
     if (!profile) return;
     
     // Find item with lowest level
     const lowest = data.reduce((prev, curr) => {
        return curr.level < prev.level ? curr : prev;
     }, data[0]);

     setExpandedKey(lowest.key);
  }, [profile]); // Run when profile changes (or on mount)

  const handleToggle = (key: string) => {
      setExpandedKey(prev => prev === key ? null : key);
  };

  return (
    <div className="bg-slate-950 p-6 rounded-xl border border-slate-800">
        
        {/* Top: Chart (Visual Overview) */}
        <div className="h-64 w-full relative mb-6">
            <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
                    <PolarGrid 
                        gridType="circle" 
                        stroke="#334155" 
                        strokeOpacity={0.5}
                    />
                    <PolarAngleAxis 
                        dataKey="subject" 
                        tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }} 
                    />
                    <PolarRadiusAxis 
                        angle={90} 
                        domain={[0, 10]} 
                        tick={false} 
                        axisLine={false} 
                    />
                    <Radar
                        name="Skills"
                        dataKey="level"
                        stroke="#f97316"
                        strokeWidth={3}
                        fill="url(#radarGradient)"
                        fillOpacity={0.6}
                        isAnimationActive={true}
                    />
                    {/* No Tooltip on Chart for Mobile - Interaction moved to cards */}
                    <defs>
                        <linearGradient id="radarGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f97316" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#ec4899" stopOpacity={0.4}/>
                        </linearGradient>
                    </defs>
                </RadarChart>
            </ResponsiveContainer>
        </div>

        {/* Bottom: Master-Detail Accordion List */}
        <div className="space-y-3">
             {data.map((item) => (
                 <SkillCard
                    key={item.key}
                    subject={item.subject}
                    metricData={item}
                    tier={getTier(item.level)}
                    isExpanded={expandedKey === item.key}
                    onToggle={() => handleToggle(item.key)}
                 />
             ))}
        </div>
    </div>
  );
};

