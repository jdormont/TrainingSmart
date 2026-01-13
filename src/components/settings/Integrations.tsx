import React, { useState } from 'react';
import { Calendar as CalendarIcon, Copy, RotateCcw, Check } from 'lucide-react';
import { Button } from '../common/Button';
import { userProfileService } from '../../services/userProfileService';

interface IntegrationsProps {
  calendarToken: string | null;
  onTokenChange: (token: string | null) => void;
}

export const Integrations: React.FC<IntegrationsProps> = ({ calendarToken, onTokenChange }) => {
  const [generatingToken, setGeneratingToken] = useState(false);
  const [copying, setCopying] = useState(false);

  const handleGenerateCalendarToken = async () => {
    setGeneratingToken(true);
    try {
      const token = await userProfileService.regenerateCalendarToken();
      onTokenChange(token);
    } catch (error) {
      console.error('Failed to generate calendar token:', error);
      alert('Failed to enable calendar feed.');
    } finally {
      setGeneratingToken(false);
    }
  };

  const getFeedUrl = () => {
    if (!calendarToken) return '';
    return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/serve-calendar-feed?token=${calendarToken}`;
  };

  const getObfuscatedUrl = () => {
    const url = getFeedUrl();
    if (!url) return '';
    // Show first 40 chars and last 10
    if (url.length < 50) return url;
    return `${url.substring(0, 45)}...${url.substring(url.length - 10)}`;
  };

  const handleAddToGoogleCalendar = () => {
    const feedUrl = getFeedUrl();
    if (!feedUrl) return;
    
    // CID needs to be webcal:// (often) or http:// 
    // Google Calendar usually takes http/https.
    // However, to ensure it works as a subscription, we can replace https:// with webcal:// 
    // or just pass the https link.
    // The query param cid expects the URL encoded.
    
    // Some sources suggest replacing https with webcal for the cid param, 
    // but http usually works if the server returns text/calendar.
    
    const encodedUrl = encodeURIComponent(feedUrl);
    const googleUrl = `https://calendar.google.com/calendar/r?cid=${encodedUrl}`;
    window.open(googleUrl, '_blank');
  };

  return (
    <div className="bg-slate-900/50 backdrop-blur-md border border-white/5 rounded-xl p-6 shadow-xl relative overflow-hidden">
        {/* Glass effect gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
        
        <h2 className="relative text-xl font-semibold text-slate-100 mb-6 flex items-center">
            <CalendarIcon className="w-5 h-5 mr-3 text-blue-400" />
            Calendar Integration
        </h2>

        {calendarToken ? (
            <div className="relative space-y-6">
                 <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                        Subscribe to Calendar
                    </label>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <Button
                            onClick={handleAddToGoogleCalendar}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-900/20"
                        >
                            <CalendarIcon className="w-4 h-4 mr-2" />
                            Add to Google Calendar
                        </Button>
                        <Button
                            onClick={() => {
                                navigator.clipboard.writeText(getFeedUrl());
                                setCopying(true);
                                setTimeout(() => setCopying(false), 2000);
                            }}
                            variant="outline"
                            className="sm:w-auto border-white/10 hover:bg-white/5 text-slate-300"
                        >
                            {copying ? (
                                <Check className="w-4 h-4 mr-2 text-green-400" />
                            ) : (
                                <Copy className="w-4 h-4 mr-2" />
                            )}
                            {copying ? 'Copied' : 'Copy URL'}
                        </Button>
                    </div>
                 </div>

                 <div className="bg-slate-950/50 rounded-lg p-4 border border-white/5">
                    <p className="text-xs text-slate-400 font-mono break-all mb-2 select-all">
                        {getObfuscatedUrl()}
                    </p>
                    <p className="text-[10px] text-slate-500 flex items-center">
                         <Check className="w-3 h-3 mr-1 text-green-500" />
                         Events update automatically. No permissions required.
                    </p>
                 </div>

                 <div className="flex justify-start">
                     <button
                        onClick={handleGenerateCalendarToken}
                        disabled={generatingToken}
                        className="text-xs text-slate-600 hover:text-slate-400 flex items-center transition-colors group"
                     >
                        <RotateCcw className="w-3 h-3 mr-1 group-hover:-rotate-180 transition-transform duration-500" />
                        Regenerate Feed Token
                     </button>
                 </div>
            </div>
        ) : (
            <div className="relative">
                <p className="text-slate-400 mb-6 text-sm">
                    Enable the calendar feed to see your upcoming workouts in Google Calendar, Apple Calendar, or Outlook.
                </p>
                <Button
                    onClick={handleGenerateCalendarToken}
                    className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-900/20"
                    loading={generatingToken}
                    >
                    <CalendarIcon className="w-4 h-4" />
                    <span>Enable Calendar Feed</span>
                </Button>
            </div>
        )}
    </div>
  );
};
