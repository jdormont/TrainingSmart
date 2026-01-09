import React from 'react';
import { useNavigate } from 'react-router-dom';
import { format, isTomorrow, isToday } from 'date-fns';
import { Calendar, Timer, Activity, Zap, AlertTriangle } from 'lucide-react';
import { Workout } from '../../types';
import { ROUTES } from '../../utils/constants';

interface SmartWorkoutPreviewProps {
    nextWorkout: Workout | null;
    recoveryScore: number | null;
}

export const SmartWorkoutPreview: React.FC<SmartWorkoutPreviewProps> = ({
    nextWorkout,
    recoveryScore
}) => {
    const navigate = useNavigate();

    if (!nextWorkout) {
        return (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Smart Workout Preview</h3>
                <div className="bg-gray-50 rounded-lg p-6 text-center border border-dashed border-gray-300">
                    <div className="inline-flex items-center justify-center p-3 bg-white rounded-full shadow-sm mb-3">
                        <Calendar className="w-6 h-6 text-gray-400" />
                    </div>
                    <h4 className="text-sm font-medium text-gray-900 mb-1">No upcoming workouts</h4>
                    <p className="text-xs text-gray-500 mb-4">Your schedule is clear.</p>
                    <button
                        onClick={() => navigate(ROUTES.PLANS)}
                        className="text-sm font-medium text-orange-600 hover:text-orange-700 hover:underline"
                    >
                        Add a workout?
                    </button>
                </div>
            </div>
        );
    }

    // Formatting Logic
    const workoutDate = new Date(nextWorkout.scheduledDate);
    let dateDisplay = format(workoutDate, 'MMM d');
    if (isYesterday(workoutDate)) dateDisplay = `Yesterday, ${dateDisplay}`; // Should theoretically not be fetched, but safety first
    if (isToday(workoutDate)) dateDisplay = `Today, ${dateDisplay}`;
    if (isTomorrow(workoutDate)) dateDisplay = `Tomorrow, ${dateDisplay}`;

    const durationHours = Math.floor(nextWorkout.duration / 60);
    const durationMinutes = nextWorkout.duration % 60;
    let durationDisplay = '';
    if (durationHours > 0) durationDisplay += `${durationHours}h `;
    if (durationMinutes > 0 || durationHours === 0) durationDisplay += `${durationMinutes}m`;
    durationDisplay = durationDisplay.trim();

    // AI "Pre-Flight Check" Logic
    const isHighIntensity =
        nextWorkout.intensity === 'hard' ||
        nextWorkout.intensity === 'moderate' || // Including moderate in "not easy" bucket for safety
        nextWorkout.name.toLowerCase().includes('interval') ||
        nextWorkout.name.toLowerCase().includes('race') ||
        nextWorkout.name.toLowerCase().includes('vo2');

    const isLowRecovery = recoveryScore !== null && recoveryScore < 40;

    // Determine Status
    let status: 'green' | 'yellow' = 'green';

    if (isLowRecovery && isHighIntensity) {
        status = 'yellow';
    }
    // Default to green otherwise (High recovery + Hard workout = Green; Low recovery + Easy workout = Green)

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-0 overflow-hidden mb-6">
            <div className="p-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Smart Workout Preview</h3>
            </div>

            <div className="p-5">
                <div className="mb-4">
                    <div className="text-sm font-medium text-gray-500 mb-1">Up Next: {dateDisplay}</div>
                    <h4 className="text-lg font-bold text-gray-900 leading-tight mb-2">
                        {nextWorkout.name}
                    </h4>
                    <div className="flex items-center space-x-3 text-xs text-gray-600">
                        <span className="flex items-center bg-gray-100 px-2 py-1 rounded">
                            <Timer className="w-3 h-3 mr-1" />
                            {durationDisplay}
                        </span>
                        <span className="flex items-center bg-gray-100 px-2 py-1 rounded capitalize">
                            <Activity className="w-3 h-3 mr-1" />
                            {nextWorkout.type}
                        </span>
                        <span className={`flex items-center px-2 py-1 rounded capitalize ${nextWorkout.intensity === 'hard' ? 'bg-red-100 text-red-700' :
                            nextWorkout.intensity === 'moderate' ? 'bg-yellow-100 text-yellow-700' :
                                nextWorkout.intensity === 'easy' ? 'bg-green-100 text-green-700' :
                                    'bg-blue-100 text-blue-700'
                            }`}>
                            {nextWorkout.intensity}
                        </span>
                    </div>
                </div>

                {/* AI Annotation Footer */}
                {status === 'green' ? (
                    <div className="bg-green-50 border border-green-100 rounded-md p-3 flex items-start space-x-3">
                        <div className="flex-shrink-0 mt-0.5">
                            <Zap className="w-5 h-5 text-green-600 fill-current" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-green-900">System Go.</p>
                            <p className="text-xs text-green-700 mt-0.5">
                                You are primed for this session.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="bg-orange-50 border border-orange-100 rounded-md p-3 flex items-start space-x-3">
                        <div className="flex-shrink-0 mt-0.5">
                            <AlertTriangle className="w-5 h-5 text-orange-500" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-orange-900">High Strain Detected.</p>
                            <p className="text-xs text-orange-800 mt-0.5">
                                Your recovery is low ({recoveryScore}%). Consider{' '}
                                <button
                                    onClick={() => navigate(ROUTES.PLANS)}
                                    className="font-semibold underline hover:text-orange-950"
                                >
                                    swapping for Endurance
                                </button>.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// Helper for date check
function isYesterday(date: Date) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return isSameDay(date, yesterday);
}

function isSameDay(d1: Date, d2: Date) {
    return d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();
}
