import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, isTomorrow, isToday } from 'date-fns';
import { Calendar, Timer, Activity, Zap, Sparkles, CheckCircle2 } from 'lucide-react';
import { Workout, DailyMetric } from '../../types';
import { ROUTES } from '../../utils/constants';
import { recommendationService } from '../../services/recommendationService';
import { useAuth } from '../../contexts/AuthContext';

interface SmartWorkoutPreviewProps {
    nextWorkout: Workout | null;
    dailyMetrics?: DailyMetric | null; // Changed from recoveryScore number to full object for service
    onWorkoutGenerated?: (workout: Workout) => void;
    onViewDetails?: (workout: Workout) => void;
}

export const SmartWorkoutPreview: React.FC<SmartWorkoutPreviewProps> = ({
    nextWorkout,
    dailyMetrics,
    onWorkoutGenerated,
    onViewDetails
}) => {
    const navigate = useNavigate();
    const { userProfile } = useAuth();
    const [isGenerating, setIsGenerating] = useState(false);

    // --- State A: Planned (Workout Exists) ---
    if (nextWorkout) {
        // formatting
        const workoutDate = new Date(nextWorkout.scheduledDate);
        let dateDisplay = format(workoutDate, 'MMM d');
        if (isToday(workoutDate)) dateDisplay = 'Today';
        else if (isTomorrow(workoutDate)) dateDisplay = 'Tomorrow';

        const durationHours = Math.floor(nextWorkout.duration / 60);
        const durationMinutes = nextWorkout.duration % 60;
        let durationDisplay = '';
        if (durationHours > 0) durationDisplay += `${durationHours}h `;
        if (durationMinutes > 0 || durationHours === 0) durationDisplay += `${durationMinutes}m`;
        durationDisplay = durationDisplay.trim();

        // Determine Intensity Gradient & Icon
        let gradientClass = 'bg-gradient-to-br from-blue-700 to-blue-600'; // Default
        let Icon = Activity;
        let focusTag = 'Endurance';

        const intensity = nextWorkout.intensity || 'moderate';
        const name = nextWorkout.name.toLowerCase();

        if (intensity === 'hard' || name.includes('vo2') || name.includes('race')) {
            gradientClass = 'bg-gradient-to-br from-purple-900 to-indigo-800';
            Icon = Zap;
            focusTag = 'High Intensity';
        } else if (intensity === 'moderate' || name.includes('tempo') || name.includes('sweet spot')) {
            gradientClass = 'bg-gradient-to-br from-orange-700 to-red-600';
            Icon = Activity;
            focusTag = 'Tempo / Threshold';
        } else if (intensity === 'recovery' || name.includes('recovery')) {
            gradientClass = 'bg-gradient-to-br from-teal-800 to-emerald-600';
            Icon = CheckCircle2;
            focusTag = 'Active Recovery';
        } else {
             // Easy / Endurance
            gradientClass = 'bg-gradient-to-br from-blue-700 to-cyan-600';
            Icon = Activity;
            focusTag = 'Base Building';
        }


        return (
            <div className={`relative w-full rounded-2xl shadow-lg overflow-hidden flex flex-col ${gradientClass} text-white mb-6 transition-all`}>
                {/* Background Icon Watermark */}
                <div className="absolute -top-6 -right-6 opacity-10 pointer-events-none">
                     <Icon size={180} />
                </div>

                <div className="relative z-10 p-6 flex flex-col h-full justify-between">
                    {/* Top Row */}
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex flex-col">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/20 backdrop-blur-sm border border-white/10 mb-2 w-fit">
                                🎯 {focusTag}
                            </span>
                             <h2 className="text-3xl font-bold tracking-tight leading-tight">
                                {nextWorkout.name}
                             </h2>
                        </div>
                    </div>

                    {/* Middle Info */}
                    <div className="flex items-center space-x-4 mb-6 text-white/90">
                        <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-1.5 opacity-80" />
                            <span className="text-sm font-medium">{dateDisplay}</span>
                        </div>
                        <div className="flex items-center">
                            <Timer className="w-4 h-4 mr-1.5 opacity-80" />
                            <span className="text-sm font-medium">{durationDisplay}</span>
                        </div>
                         {/* Optional: Add Activity Type Icon/Text */}
                        <div className="flex items-center capitalize">
                            <span className="text-sm font-medium opacity-80">{nextWorkout.type}</span>
                        </div>
                    </div>

                    {/* Action Button */}
                    <button
                        onClick={() => onViewDetails ? onViewDetails(nextWorkout) : navigate(ROUTES.PLANS)}
                        className="w-full bg-white text-gray-900 hover:bg-gray-50 active:scale-[0.98] transition-all font-bold py-3.5 px-4 rounded-xl shadow-md flex items-center justify-center space-x-2"
                    >
                        <span>View Session Brief</span>
                        <Activity className="w-4 h-4 ml-1" />
                    </button>
                </div>
            </div>
        );
    }

    // --- State B: Unplanned (Schedule Clear) ---
    const recoveryScore = dailyMetrics?.recovery_score;
    let bioInsight = "Good day for a steady ride."; // Default
    let recommendationType = "Endurance"; // For button label
    let gradientClass = 'bg-gradient-to-br from-gray-800 to-gray-700';

    if (recoveryScore !== undefined && recoveryScore !== null) {
        if (recoveryScore >= 70) {
            bioInsight = "You're primed for intensity. Let's build.";
            recommendationType = "Intervals";
            gradientClass = 'bg-gradient-to-br from-indigo-900 to-slate-800'; // Slightly more "active" dark
        } else if (recoveryScore < 40) {
            bioInsight = "Recovery is key today. Keep it light.";
            recommendationType = "Recovery Spin";
             gradientClass = 'bg-gradient-to-br from-slate-800 to-slate-700';
        }
    }

    const handleGenerate = async () => {
        if (!userProfile || !dailyMetrics) return;
        setIsGenerating(true);
        try {
            const workout = await recommendationService.generateInstantWorkout(userProfile, dailyMetrics);
            if (workout && onWorkoutGenerated) {
                onWorkoutGenerated(workout);
            }
        } catch (error) {
            console.error("Failed to generate workout", error);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className={`relative w-full rounded-2xl shadow-md overflow-hidden flex flex-col ${gradientClass} text-white mb-6`}>
             <div className="p-6 flex flex-col h-full">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-2xl font-bold">Schedule Clear</h3>
                    <Calendar className="w-6 h-6 text-white/40" />
                </div>
                
                <p className="text-white/80 mb-6 text-lg leading-relaxed">
                    {bioInsight}
                </p>

                <div className="mt-auto">
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating || !dailyMetrics}
                        className="w-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white active:scale-[0.98] transition-all font-semibold py-3.5 px-4 rounded-xl flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isGenerating ? (
                            <span className="flex items-center">
                                <span className="animate-spin mr-2">•</span> Generating...
                            </span>
                        ) : (
                            <>
                                <Sparkles className="w-4 h-4 text-yellow-300 fill-current" />
                                <span>Generate {recommendationType}</span>
                            </>
                        )}
                    </button>
                     {!dailyMetrics && (
                        <p className="text-center text-xs text-white/40 mt-2">
                            Need metrics to generate recommendation.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

