
import React, { useEffect, useState } from 'react';
import { Snowflake, Flame, X } from 'lucide-react';
import { analytics } from '../../lib/analytics';

export type CelebrationType = 'increment' | 'milestone' | 'freeze_earned' | null;

interface StreakCelebrationProps {
    type: CelebrationType;
    details?: {
        streak?: number;
        freezes?: number;
    };
    onClose: () => void;
}

export const StreakCelebration: React.FC<StreakCelebrationProps> = ({ type, details, onClose }) => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (type) {
            setVisible(true);
            analytics.track('streak_celebration_shown', { type, streak: details?.streak, freezes: details?.freezes });
            const timer = setTimeout(() => {
                handleClose();
            }, 4000); // Auto close after 4s
            return () => clearTimeout(timer);
        }
    }, [type]);

    const handleClose = () => {
        setVisible(false);
        setTimeout(onClose, 300); // Wait for fade out
    };

    if (!type || !visible) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity duration-300 pointer-events-auto" onClick={handleClose} />

            {/* Content Card */}
            <div className={`relative bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 transform transition-all duration-500 pointer-events-auto ${visible ? 'scale-100 opacity-100 translate-y-0' : 'scale-90 opacity-0 translate-y-4'}`}>
                <button onClick={handleClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                    <X className="w-5 h-5" />
                </button>

                <div className="text-center">
                    {/* Icon Animation */}
                    <div className="flex justify-center mb-6">
                        <div className={`p-4 rounded-full ${type === 'freeze_earned' ? 'bg-blue-100' : 'bg-orange-100'}`}>
                            {type === 'freeze_earned' ? (
                                <Snowflake className="w-12 h-12 text-blue-600 animate-bounce" />
                            ) : (
                                <Flame className="w-12 h-12 text-orange-600 animate-pulse" />
                            )}
                        </div>
                    </div>

                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                        {type === 'freeze_earned' ? 'Freeze Earned!' : 'Streak Extended!'}
                    </h2>

                    <p className="text-gray-600 mb-6">
                        {type === 'freeze_earned'
                            ? "You've banked a user freeze for 7 days of consistency."
                            : `You are on a ${details?.streak}-day streak! Keep it up!`}
                    </p>

                    <button
                        onClick={handleClose}
                        className={`w-full py-3 rounded-xl font-seminold text-white shadow-md transform transition active:scale-95 ${type === 'freeze_earned' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-orange-600 hover:bg-orange-700'}`}
                    >
                        Awesome!
                    </button>
                </div>

                {/* Confetti placeholder (in real app, use canvas-confetti) */}
                <div className="absolute inset-x-0 -top-20 flex justify-center pointer-events-none">
                    <span className="text-4xl animate-ping opacity-75">🎉</span>
                </div>
            </div>
        </div>
    );
};
