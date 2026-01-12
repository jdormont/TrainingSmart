import React from 'react';

export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="animate-pulse space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero Area Skeleton */}
      <div className="h-64 w-full bg-slate-800 rounded-2xl shadow-lg ring-1 ring-white/5" />

      {/* Main Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Col (Stats/Activity Preview) */}
        <div className="lg:col-span-2 space-y-8">
             <div className="h-96 bg-slate-800 rounded-2xl shadow-lg ring-1 ring-white/5" />
             <div className="h-48 bg-slate-800 rounded-2xl shadow-lg ring-1 ring-white/5" />
        </div>

        {/* Right Col (Recent Activity List) */}
        <div className="space-y-4">
          <div className="h-8 w-48 bg-slate-800 rounded mb-6" /> {/* Section Title */}
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 w-full bg-slate-800 rounded-2xl shadow-lg ring-1 ring-white/5" />
          ))}
        </div>
      </div>
    </div>
  );
};
