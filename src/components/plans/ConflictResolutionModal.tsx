import React from 'react';
import { Workout } from '../../types';
import { Button } from '../common/Button';
import { AlertTriangle, ArrowRightLeft, Trash2, X } from 'lucide-react';
import { format } from 'date-fns';

interface ConflictResolutionModalProps {
    isOpen: boolean;
    onClose: () => void;
    sourceWorkout: Workout | null;
    targetWorkout: Workout | null;
    targetDate: Date | null;
    onSwap: () => void;
    onReplace: () => void;
}

export const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
    isOpen,
    onClose,
    sourceWorkout,
    targetWorkout,
    targetDate,
    onSwap,
    onReplace,
}) => {
    if (!isOpen || !sourceWorkout || !targetWorkout || !targetDate) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full border border-gray-200 overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-orange-100 mx-auto mb-4">
                        <AlertTriangle className="w-6 h-6 text-orange-600" />
                    </div>

                    <h3 className="text-lg font-semibold text-center text-gray-900 mb-2">
                        Schedule Conflict
                    </h3>

                    <p className="text-gray-600 text-center mb-6">
                        There is already a workout planned for <span className="font-medium text-gray-900">{format(targetDate, 'EEEE, MMM d')}</span>.
                        What would you like to do?
                    </p>

                    <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-3">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">Moving:</span>
                            <span className="font-medium text-gray-900">{sourceWorkout.name}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">Existing:</span>
                            <span className="font-medium text-gray-900">{targetWorkout.name}</span>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <button
                            onClick={onSwap}
                            className="w-full flex items-center justify-center px-4 py-3 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                        >
                            <ArrowRightLeft className="w-4 h-4 mr-2" />
                            Swap Days
                            <span className="ml-2 text-blue-200 text-xs font-normal">(Exchange dates)</span>
                        </button>

                        <button
                            onClick={onReplace}
                            className="w-full flex items-center justify-center px-4 py-3 border border-red-200 rounded-lg text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                        >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Replace
                            <span className="ml-2 text-red-600/70 text-xs font-normal">(Delete existing)</span>
                        </button>

                        <button
                            onClick={onClose}
                            className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
                        >
                            <X className="w-4 h-4 mr-2" />
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
