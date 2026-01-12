import React from 'react';

export const PlansSkeleton: React.FC = () => {
  return (
    <div className="animate-pulse space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
       {/* Header Skeleton */}
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="h-8 w-64 bg-slate-800 rounded-lg" />
            <div className="h-4 w-96 bg-slate-800/50 rounded" />
          </div>
          <div className="flex space-x-2">
             <div className="h-10 w-32 bg-slate-800 rounded-lg" />
             <div className="h-10 w-10 bg-slate-800 rounded-lg" />
          </div>
       </div>

      {/* 7-Day Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="min-h-[400px] w-full bg-slate-900/50 border border-slate-800 rounded-xl flex flex-col p-4 space-y-4">
               {/* Day Header */}
               <div className="flex items-center justify-between">
                   <div className="h-6 w-12 bg-slate-800 rounded" />
                   <div className="h-6 w-6 bg-slate-800 rounded-full" />
               </div>
               
               {/* Divider */}
               <div className="h-px w-full bg-slate-800" />

               {/* Workout Card Placeholders */}
               <div className="h-32 w-full bg-slate-800 rounded-xl" />
               <div className="h-24 w-full bg-slate-800/50 rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
};
