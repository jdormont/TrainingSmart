import React from 'react';
import { X, Clock, Activity, Zap } from 'lucide-react';
import { Workout } from '../../types';
import { convertMarkdownToHtml } from '../../utils/markdownToHtml';

interface WorkoutDetailModalProps {
  workout: Workout;
  onClose: () => void;
}

const INTENSITY_COLORS = {
  easy: 'bg-green-100 text-green-800',
  recovery: 'bg-blue-100 text-blue-800',
  moderate: 'bg-yellow-100 text-yellow-800',
  hard: 'bg-red-100 text-red-800',
};

export const WorkoutDetailModal: React.FC<WorkoutDetailModalProps> = ({ workout, onClose }) => {
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }).format(new Date(date));
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div 
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
          aria-hidden="true"
          onClick={onClose}
        ></div>

        {/* Center modal */}
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full">
          {/* Header */}
          <div className="px-4 pt-5 pb-4 sm:p-6 sm:pb-4 border-b border-gray-100">
            <div className="flex justify-between items-start">
              <div className="flex items-center space-x-3">
                 <div className={`p-2 rounded-lg ${INTENSITY_COLORS[workout.intensity]} bg-opacity-20`}>
                    <Activity className="w-6 h-6" />
                 </div>
                 <div>
                    <h3 className="text-xl leading-6 font-bold text-gray-900" id="modal-title">
                      {workout.name}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {formatDate(workout.scheduledDate)}
                    </p>
                 </div>
              </div>
              <button
                onClick={onClose}
                className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="px-4 py-5 sm:p-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-50 rounded-lg p-3 flex items-center space-x-3">
                <Clock className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">Duration</p>
                  <p className="font-medium text-gray-900">{formatDuration(workout.duration)}</p>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 flex items-center space-x-3">
                <Zap className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">Intensity</p>
                  <p className="font-medium text-gray-900 capitalize">{workout.intensity}</p>
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">Session Brief</h4>
              <div 
                className="prose prose-sm max-w-none text-gray-600 bg-gray-50 rounded-lg p-4 max-h-60 overflow-y-auto"
                dangerouslySetInnerHTML={{ __html: convertMarkdownToHtml(workout.description) }}
              />
            </div>
          </div>
          
          {/* Footer */}
          <div className="bg-gray-50 px-4 py-3 sm:px-6 flex justify-end">
            <button
              type="button"
              className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
