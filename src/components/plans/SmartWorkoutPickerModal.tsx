import React, { useState } from 'react';
import { X, Sparkles, Activity, Clock, Heart, Dumbbell, Zap } from 'lucide-react';
import { Workout } from '../../types';
import { recommendationService } from '../../services/recommendationService';

interface SmartWorkoutPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date;
  onSelectWorkout: (workout: Partial<Workout>) => void;
  recoveryScore: number;
  acuteLoadRatio: number;
}

export const SmartWorkoutPickerModal: React.FC<SmartWorkoutPickerModalProps> = ({
  isOpen,
  onClose,
  date,
  onSelectWorkout,
  recoveryScore,
  acuteLoadRatio
}) => {
  if (!isOpen) return null;

  // 1. Get AI Recommendation
  const suggestion = recommendationService.getSuggestedWorkout(recoveryScore, acuteLoadRatio);

  // 2. Define "Other Options"
  const otherOptions = [
    {
      name: 'Recovery Spin',
      description: '30m Active Recovery',
      type: 'recovery' as Workout['intensity'],
      duration: 30,
      icon: Heart,
      color: 'bg-teal-50 text-teal-600 border-teal-200'
    },
    {
      name: 'Endurance Ride',
      description: '60m Zone 2',
      type: 'easy' as Workout['intensity'],
      duration: 60,
      icon: Activity,
      color: 'bg-blue-50 text-blue-600 border-blue-200'
    },
    {
      name: 'Tempo Intervals',
      description: '45m Sweet Spot',
      type: 'moderate' as Workout['intensity'],
      duration: 45,
      icon: Zap,
      color: 'bg-orange-50 text-orange-600 border-orange-200'
    },
    {
        name: 'Yoga / Mobility',
        description: '30m Flexibility',
        type: 'recovery' as Workout['intensity'], // Use recovery for yoga
        duration: 30,
        icon: Dumbbell, // Placeholder icon
        color: 'bg-purple-50 text-purple-600 border-purple-200'
    }
  ];

  const handleSelect = (option: typeof suggestion) => {
      onSelectWorkout({
          name: option.name,
          description: option.description,
          duration: option.duration,
          intensity: option.type,
          scheduledDate: date,
          type: 'bike', // Default or parse from suggestion if needed
          completed: false,
          status: 'planned'
      });
      onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="relative bg-slate-50 border-b border-gray-100 p-6 pb-8">
            <button 
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
                <X className="w-5 h-5" />
            </button>
            
            <div className="text-center space-y-2">
                <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-100/50 text-blue-700 text-sm font-medium">
                   <Sparkles className="w-4 h-4" />
                   <span>Bio-Aware Recommendation</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">
                    Add Workout
                </h2>
                <p className="text-gray-500">
                    Based on your readiness of <span className="font-semibold text-gray-900">{recoveryScore ?? '--'}%</span>
                </p>
            </div>
        </div>

        <div className="p-6 space-y-8">
            
            {/* AI Recommendation Card */}
            <div className="relative group">
                 <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl opacity-30 group-hover:opacity-50 blur transition duration-200"></div>
                 <div className="relative bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-all">
                    
                    <div className="flex justify-between items-start mb-4">
                        <div>
                             <div className="flex items-center space-x-2 mb-1">
                                <span className={`w-2 h-2 rounded-full ${
                                    suggestion.type === 'hard' ? 'bg-red-500' : 
                                    suggestion.type === 'easy' ? 'bg-blue-500' : 'bg-green-500'
                                }`} />
                                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                    Recommended
                                </span>
                             </div>
                             <h3 className="text-lg font-bold text-gray-900 leading-tight">
                                {suggestion.name}
                             </h3>
                        </div>
                        <div className="bg-blue-50 text-blue-700 text-xs font-bold px-2 py-1 rounded">
                            {suggestion.duration}m
                        </div>
                    </div>

                    <p className="text-gray-600 text-sm mb-4 leading-relaxed">
                        {suggestion.description}
                    </p>
                    
                    <div className="flex items-center justify-between">
                         <div className="flex items-center text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded border border-gray-100">
                            <Sparkles className="w-3 h-3 mr-1 text-yellow-500" />
                            {suggestion.reason}
                         </div>
                         <button
                            onClick={() => handleSelect(suggestion)}
                            className="bg-gray-900 hover:bg-black text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shadow-sm"
                         >
                            Add to Plan
                         </button>
                    </div>
                 </div>
            </div>

            {/* Other Options Grid */}
            <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                    <Activity className="w-4 h-4 mr-2 text-gray-400" />
                    Other Options
                </h4>
                <div className="grid grid-cols-2 gap-3">
                    {otherOptions.map((opt) => (
                        <button
                            key={opt.name}
                            onClick={() => handleSelect(opt)}
                            className="flex flex-col items-start p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/30 transition-all text-left group/btn"
                        >
                            <div className="flex justify-between w-full mb-1">
                                <span className="text-sm font-semibold text-gray-900 group-hover/btn:text-blue-700">
                                    {opt.name}
                                </span>
                                <span className="text-xs text-gray-400 font-medium">
                                    {opt.duration}m
                                </span>
                            </div>
                            <span className="text-xs text-gray-500 line-clamp-1">
                                {opt.description}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

        </div>

      </div>
    </div>
  );
};
