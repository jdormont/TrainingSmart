import React, { useState, useEffect } from 'react';
import { X, Calendar as CalendarIcon, Copy, RotateCcw } from 'lucide-react';
import { Button } from '../common/Button';
import { userProfileService } from '../../services/userProfileService';

interface CalendarSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CalendarSyncModal: React.FC<CalendarSyncModalProps> = ({ isOpen, onClose }) => {
  const [calendarToken, setCalendarToken] = useState<string | null>(null);
  const [generatingToken, setGeneratingToken] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadToken();
    }
  }, [isOpen]);

  const loadToken = async () => {
    setLoading(true);
    try {
      const profile = await userProfileService.getUserProfile();
      if (profile?.calendar_token) {
        setCalendarToken(profile.calendar_token);
      }
    } catch (error) {
      console.error('Failed to load calendar token:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateToken = async () => {
    setGeneratingToken(true);
    try {
      const token = await userProfileService.regenerateCalendarToken();
      setCalendarToken(token);
    } catch (error) {
      console.error('Failed to generate token:', error);
      alert('Failed to enable calendar feed.');
    } finally {
      setGeneratingToken(false);
    }
  };

  if (!isOpen) return null;

  const subscriptionUrl = calendarToken 
    ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/serve-calendar-feed?token=${calendarToken}`
    : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-2xl max-w-md w-full overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <h3 className="text-lg font-semibold text-slate-100 flex items-center">
            <CalendarIcon className="w-5 h-5 mr-2 text-blue-400" />
            Sync to Calendar
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <p className="text-sm text-slate-400">
            Subscribe to your training plan from your favorite calendar app. The feed automatically updates with future workouts.
          </p>

          {loading ? (
             <div className="flex justify-center py-4">
               <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
             </div>
          ) : calendarToken ? (
            <div className="space-y-4">
              <div className="bg-slate-950 rounded-lg p-4 border border-slate-800">
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                  Subscription URL
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={subscriptionUrl}
                    className="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-300 font-mono focus:outline-none focus:border-blue-500"
                  />
                  <Button
                    onClick={() => {
                      navigator.clipboard.writeText(subscriptionUrl);
                      alert('URL copied!');
                    }}
                    variant="outline"
                    className="flex-shrink-0"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

               <div className="bg-blue-950/20 border border-blue-500/20 rounded-lg p-4">
                  <h4 className="font-medium text-blue-200 mb-2 text-xs">Instructions:</h4>
                  <ul className="text-xs text-blue-200/80 space-y-1 list-disc list-inside">
                    <li><strong>Google:</strong> Add calendar &gt; From URL</li>
                    <li><strong>Apple:</strong> File &gt; New Calendar Subscription</li>
                    <li><strong>Outlook:</strong> Add Calendar &gt; Subscribe from web</li>
                  </ul>
                </div>

                <div className="flex justify-center">
                  <button
                    onClick={handleGenerateToken}
                    disabled={generatingToken}
                    className="text-xs text-slate-600 hover:text-slate-400 flex items-center transition-colors"
                  >
                    <RotateCcw className="w-3 h-3 mr-1" />
                    Regenerate Token
                  </button>
                </div>
            </div>
          ) : (
            <div className="text-center py-4">
               <Button
                  onClick={handleGenerateToken}
                  loading={generatingToken}
                  className="bg-blue-600 hover:bg-blue-700 w-full justify-center"
                >
                  Enable Calendar Feed
                </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
