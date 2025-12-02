import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Save, RotateCcw, Bot, User, Settings, Moon, Activity, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '../components/common/Button';
import { stravaApi } from '../services/stravaApi';
import { stravaCacheService } from '../services/stravaCacheService';
import { ouraApi } from '../services/ouraApi';
import { googleCalendarService } from '../services/googleCalendarService';
import { STORAGE_KEYS } from '../utils/constants';

const DEFAULT_SYSTEM_PROMPT = `You are an expert personal running and cycling coach with access to the user's real Strava training data. 

COACHING GUIDELINES:
- Base all advice on their actual training data and patterns
- Consider their recent training load and recovery needs
- Provide specific, actionable recommendations
- Be encouraging but realistic about their current fitness level
- Ask clarifying questions when needed to give better advice
- Reference their actual activities when relevant
- Consider training progression and injury prevention
- When recommending exercises, include YouTube video links from reputable fitness creators
- Prioritize videos with high view counts (100k+) and from creators with large subscriber bases
- Recommend specific cycling content creators who match the user's needs and goals

EXERCISE VIDEO GUIDELINES:
- Always include YouTube links for exercises, stretches, or training techniques
- Format as: **Exercise Name**: [Video Title](https://youtube.com/watch?v=VIDEO_ID) by Creator Name
- Prioritize these top cycling content creators when relevant:
  * **GCN (Global Cycling Network)** - 2M+ subscribers, excellent technique videos
  * **TrainerRoad** - 200k+ subscribers, structured training content
  * **Dylan Johnson** - 300k+ subscribers, science-based training
  * **Cam Nicholls** - 500k+ subscribers, bike fitting and technique
  * **GMBN Tech** - 1M+ subscribers, bike maintenance and setup
  * **Peter Attia MD** - 500k+ subscribers, health and longevity for athletes
  * **Yoga with Adriene** - 12M+ subscribers, yoga for cyclists
  * **Athlean-X** - 13M+ subscribers, strength training for athletes
- Include brief descriptions of why each creator is valuable for cyclists
- Mention subscriber counts and specialties when recommending creators
Respond conversationally as their personal coach who knows their training history intimately.`;

export const SettingsPage: React.FC = () => {
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [athlete, setAthlete] = useState<any>(null);
  const [ouraConnected, setOuraConnected] = useState(false);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [calendarConnectedAt, setCalendarConnectedAt] = useState<Date | null>(null);
  const [connectingCalendar, setConnectingCalendar] = useState(false);
  const [refreshingCache, setRefreshingCache] = useState(false);
  const [stravaConnectedAt, setStravaConnectedAt] = useState<Date | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Load saved system prompt
    const savedPrompt = localStorage.getItem(STORAGE_KEYS.SYSTEM_PROMPT);
    if (savedPrompt) {
      setSystemPrompt(savedPrompt);
    }

    // Check Oura connection status
    setOuraConnected(ouraApi.isAuthenticated());

    // Load athlete data for display (from cache)
    const loadAthlete = async () => {
      try {
        const athleteData = await stravaCacheService.getAthlete();
        setAthlete(athleteData);

        const tokens = localStorage.getItem('strava_tokens');
        if (tokens) {
          const parsedTokens = JSON.parse(tokens);
          if (parsedTokens.expires_at) {
            const connectedAt = new Date(parsedTokens.expires_at * 1000 - 6 * 60 * 60 * 1000);
            setStravaConnectedAt(connectedAt);
          }
        }
      } catch (error) {
        console.error('Failed to load athlete data:', error);
      }
    };
    loadAthlete();

    // Check Google Calendar connection status
    const checkCalendarStatus = async () => {
      const status = await googleCalendarService.getConnectionStatus();
      setCalendarConnected(status.connected);
      setCalendarConnectedAt(status.connectedAt || null);
    };
    checkCalendarStatus();

    // Handle OAuth callback
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    if (code) {
      handleCalendarCallback(code);
    }
  }, [location.search]);

  const handleSave = async () => {
    setSaving(true);
    try {
      localStorage.setItem(STORAGE_KEYS.SYSTEM_PROMPT, systemPrompt);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('Failed to save system prompt:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSystemPrompt(DEFAULT_SYSTEM_PROMPT);
    setSaved(false);
  };

  const handleConnectStrava = () => {
    try {
      console.log('Starting Strava connection process...');
      const authUrl = stravaApi.generateAuthUrl();
      console.log('OAuth URL generated successfully');
      console.log('Redirecting to:', authUrl);
      window.location.href = authUrl;
    } catch (error) {
      console.error('Failed to connect to Strava:', error);
      alert(`Configuration Error: ${(error as Error).message}\n\nPlease check your .env file and make sure you have valid Strava API credentials.`);
    }
  };

  const handleDisconnect = async () => {
    if (confirm('Are you sure you want to disconnect from Strava? This will clear all your data and log you out.')) {
      await stravaCacheService.clearCache();
      stravaApi.clearTokens();
      window.location.href = '/';
    }
  };

  const handleRefreshCache = async () => {
    setRefreshingCache(true);
    try {
      await stravaCacheService.clearCache();
      const athleteData = await stravaCacheService.getAthlete(true);
      await stravaCacheService.getActivities(true, 20);
      setAthlete(athleteData);
      alert('Data refreshed successfully! Your latest activities have been synced from Strava.');
    } catch (error) {
      console.error('Failed to refresh cache:', error);
      alert(`Failed to refresh data: ${(error as Error).message}`);
    } finally {
      setRefreshingCache(false);
    }
  };

  const handleConnectOura = () => {
    try {
      console.log('🚀 Starting Oura connection process...');
      const authUrl = ouraApi.generateAuthUrl();
      console.log('✅ OAuth URL generated successfully');
      console.log('🔄 Redirecting to:', authUrl);
      window.location.href = authUrl;
    } catch (error) {
      console.error('❌ Failed to connect to Oura:', error);
      alert(`Configuration Error: ${(error as Error).message}\n\nPlease check your .env file and make sure you have valid Oura API credentials.`);
    }
  };

  const handleDisconnectOura = () => {
    if (confirm('Are you sure you want to disconnect your Oura Ring? This will clear all your recovery data.')) {
      ouraApi.clearTokens();
      setOuraConnected(false);
    }
  };

  const handleConnectCalendar = () => {
    try {
      googleCalendarService.initiateOAuthFlow();
    } catch (error) {
      console.error('Failed to connect to Google Calendar:', error);
      alert(`Configuration Error: ${(error as Error).message}\n\nPlease check your environment variables.`);
    }
  };

  const handleCalendarCallback = async (code: string) => {
    setConnectingCalendar(true);
    try {
      await googleCalendarService.handleOAuthCallback(code);
      const status = await googleCalendarService.getConnectionStatus();
      setCalendarConnected(status.connected);
      setCalendarConnectedAt(status.connectedAt || null);

      // Clean up URL
      navigate('/settings', { replace: true });

      alert('Successfully connected to Google Calendar! You can now export workouts from your training plans.');
    } catch (error) {
      console.error('Failed to complete Google Calendar connection:', error);
      alert(`Failed to connect: ${(error as Error).message}`);
    } finally {
      setConnectingCalendar(false);
    }
  };

  const handleDisconnectCalendar = async () => {
    if (confirm('Are you sure you want to disconnect Google Calendar? Your previously exported events will remain in your calendar.')) {
      try {
        await googleCalendarService.disconnect();
        setCalendarConnected(false);
        setCalendarConnectedAt(null);
      } catch (error) {
        console.error('Failed to disconnect:', error);
        alert(`Failed to disconnect: ${(error as Error).message}`);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
          <p className="text-gray-600">
            Customize your AI coach and manage your account
          </p>
        </div>

        <div className="space-y-8">
          {/* Strava Connection */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <Activity className="w-5 h-5 mr-2" />
              Strava Connection
            </h2>

            {athlete ? (
              <div>
                <div className="space-y-2 mb-6">
                  <div className="flex items-center space-x-2 text-green-600">
                    <Activity className="w-5 h-5" />
                    <span className="font-medium">Strava Connected</span>
                  </div>
                  {stravaConnectedAt && (
                    <p className="text-xs text-gray-500">
                      Connected on {stravaConnectedAt.toLocaleDateString()} at {stravaConnectedAt.toLocaleTimeString()}
                    </p>
                  )}
                </div>

                <div className="grid md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Name</label>
                    <p className="text-gray-900">{athlete.firstname} {athlete.lastname}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Location</label>
                    <p className="text-gray-900">{athlete.city}, {athlete.state}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Strava ID</label>
                    <p className="text-gray-900">{athlete.id}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Username</label>
                    <p className="text-gray-900">@{athlete.username}</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200 space-y-3">
                  <div className="flex gap-3">
                    <Button
                      onClick={handleRefreshCache}
                      loading={refreshingCache}
                      variant="outline"
                      className="text-orange-600 border-orange-300 hover:bg-orange-50"
                    >
                      {refreshingCache ? 'Refreshing...' : 'Refresh Data'}
                    </Button>
                    <Button
                      onClick={handleDisconnect}
                      variant="outline"
                      className="text-red-600 border-red-300 hover:bg-red-50"
                    >
                      Disconnect Account
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500">
                    Data is cached for 15 minutes to respect Strava's rate limits. Use "Refresh Data" to sync your latest activities.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-gray-600">
                  Connect your Strava account to access your activities and training data.
                </p>

                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <h3 className="font-medium text-orange-900 mb-2">
                    Why Connect Strava?
                  </h3>
                  <ul className="text-sm text-orange-800 space-y-1">
                    <li>• Get personalized coaching based on your real activities</li>
                    <li>• Track your training progress and trends</li>
                    <li>• Receive AI-powered training recommendations</li>
                    <li>• Analyze performance metrics and recovery needs</li>
                  </ul>
                </div>

                <Button
                  onClick={handleConnectStrava}
                  className="bg-orange-600 hover:bg-orange-700 flex items-center space-x-2"
                >
                  <Activity className="w-4 h-4" />
                  <span>Connect Strava</span>
                </Button>

                <p className="text-xs text-gray-500">
                  You'll be redirected to Strava to authorize access to your activities.
                </p>

                <div className="mt-2">
                  <Link
                    to="/auth/strava/direct"
                    className="text-sm text-orange-600 hover:text-orange-700 underline"
                  >
                    Having trouble? Try direct authentication
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Google Calendar Integration */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <CalendarIcon className="w-5 h-5 mr-2" />
              Google Calendar Integration
            </h2>

            <p className="text-gray-600 mb-4">
              Connect your Google Calendar to export your workout plans. This is a one-way export -
              workouts will be added to your calendar but won't sync back.
            </p>

            {connectingCalendar ? (
              <div className="flex items-center space-x-2 text-gray-600">
                <Activity className="w-5 h-5 animate-spin" />
                <span>Connecting to Google Calendar...</span>
              </div>
            ) : calendarConnected ? (
              <div className="space-y-4">
                <div className="flex items-center space-x-2 text-green-600">
                  <CalendarIcon className="w-5 h-5" />
                  <span className="font-medium">Google Calendar Connected</span>
                </div>
                {calendarConnectedAt && (
                  <p className="text-sm text-gray-600">
                    Connected on {calendarConnectedAt.toLocaleDateString()} at {calendarConnectedAt.toLocaleTimeString()}
                  </p>
                )}
                <p className="text-sm text-gray-600">
                  You can now export workouts from the Plans page. Each workout will include detailed
                  information and a link back to this app.
                </p>
                <Button
                  onClick={handleDisconnectCalendar}
                  variant="outline"
                  className="text-red-600 border-red-300 hover:bg-red-50"
                >
                  Disconnect Google Calendar
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-medium text-blue-900 mb-2">
                    Why Connect Google Calendar?
                  </h3>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Export entire training weeks with one click</li>
                    <li>• Add individual workouts to your calendar</li>
                    <li>• Get reminders for scheduled workouts</li>
                    <li>• Share your training schedule with coaches or friends</li>
                    <li>• View workouts alongside other commitments</li>
                  </ul>
                </div>
                <Button
                  onClick={handleConnectCalendar}
                  className="bg-blue-600 hover:bg-blue-700 flex items-center space-x-2"
                >
                  <CalendarIcon className="w-4 h-4" />
                  <span>Connect Google Calendar</span>
                </Button>
                <p className="text-xs text-gray-500">
                  You'll be redirected to Google to authorize access to your calendar.
                </p>
              </div>
            )}
          </div>

          {/* Oura Integration */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <Moon className="w-5 h-5 mr-2" />
              Oura Ring Integration
            </h2>
            
            <p className="text-gray-600 mb-4">
              Connect your Oura Ring to get sleep quality, recovery scores, and readiness data 
              integrated with your training insights.
            </p>

            {ouraConnected ? (
              <div className="space-y-4">
                <div className="flex items-center space-x-2 text-green-600">
                  <Activity className="w-5 h-5" />
                  <span className="font-medium">Oura Ring Connected</span>
                </div>
                <p className="text-sm text-gray-600">
                  Your sleep and recovery data is being synced automatically.
                </p>
                <Button
                  onClick={handleDisconnectOura}
                  variant="outline"
                  className="text-red-600 border-red-300 hover:bg-red-50"
                >
                  Disconnect Oura Ring
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h3 className="font-medium text-purple-900 mb-2">
                    Why Connect Your Oura Ring?
                  </h3>
                  <ul className="text-sm text-purple-800 space-y-1">
                    <li>• Get recovery-based training recommendations</li>
                    <li>• Track sleep quality and its impact on performance</li>
                    <li>• Monitor HRV and readiness for optimal training</li>
                    <li>• AI coach factors in your recovery data</li>
                  </ul>
                </div>
                <Button
                  onClick={handleConnectOura}
                  className="bg-purple-600 hover:bg-purple-700 flex items-center space-x-2"
                >
                  <Moon className="w-4 h-4" />
                  <span>Connect Oura Ring</span>
                </Button>
                <p className="text-xs text-gray-500">
                  You'll be redirected to Oura to authorize access to your health data.
                </p>
                <div className="mt-2">
                  <Link 
                    to="/auth/oura/direct"
                    className="text-sm text-purple-600 hover:text-purple-700 underline"
                  >
                    Having trouble? Try direct authentication
                  </Link>
                </div>
              </div>
            )}
          </div>
          {/* AI Coach Settings */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <Bot className="w-5 h-5 mr-2" />
              AI Coach Personality
            </h2>
            
            <p className="text-gray-600 mb-4">
              Customize how your AI coach communicates with you. This system prompt defines 
              the coach's personality, expertise, and approach to giving you training advice.
            </p>

            <div className="space-y-4">
              <div>
                <label htmlFor="systemPrompt" className="block text-sm font-medium text-gray-700 mb-2">
                  System Prompt
                </label>
                <textarea
                  id="systemPrompt"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={12}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent font-mono text-sm"
                  placeholder="Enter your custom system prompt..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  The AI coach will use this prompt to understand how to interact with you and analyze your training data.
                </p>
              </div>

              <div className="flex space-x-3">
                <Button
                  onClick={handleSave}
                  loading={saving}
                  className="flex items-center"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saved ? 'Saved!' : 'Save Changes'}
                </Button>
                
                <Button
                  onClick={handleReset}
                  variant="outline"
                  className="flex items-center"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset to Default
                </Button>
              </div>

              {saved && (
                <div className="bg-green-50 border border-green-200 rounded-md p-3">
                  <p className="text-green-600 text-sm">
                    ✅ System prompt saved! Your AI coach will use this personality in future conversations.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Prompt Examples */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Example Coaching Styles</h3>
            
            <div className="space-y-4">
              <div className="border border-gray-200 rounded-md p-4">
                <h4 className="font-medium text-gray-900 mb-2">🏃 Motivational Coach</h4>
                <p className="text-sm text-gray-600 mb-2">
                  Encouraging, positive, focuses on progress and achievements
                </p>
                <button
                  onClick={() => setSystemPrompt(`You are an enthusiastic and motivational personal training coach. You celebrate every achievement, no matter how small, and always focus on progress and positive reinforcement. You use encouraging language and help athletes see their potential. Base all advice on their actual Strava training data while maintaining an upbeat, supportive tone.

EXERCISE VIDEO GUIDELINES:
- Always include YouTube links for exercises and techniques from top creators
- Format: **Exercise**: [Video Title](https://youtube.com/watch?v=ID) by Creator
- Recommend GCN, TrainerRoad, Dylan Johnson, and other top cycling channels
- Include motivational fitness creators like Athlean-X and Yoga with Adriene`)}
                  className="text-xs text-orange-600 hover:text-orange-700 underline"
                >
                  Use this style
                </button>
              </div>

              <div className="border border-gray-200 rounded-md p-4">
                <h4 className="font-medium text-gray-900 mb-2">📊 Data-Driven Analyst</h4>
                <p className="text-sm text-gray-600 mb-2">
                  Technical, analytical, focuses on metrics and performance optimization
                </p>
                <button
                  onClick={() => setSystemPrompt(`You are a highly analytical sports scientist and coach who focuses on data-driven training optimization. You provide detailed analysis of training metrics, identify patterns in performance data, and give precise, evidence-based recommendations. You reference specific numbers from their Strava activities and explain the science behind your advice.

EXERCISE VIDEO GUIDELINES:
- Include YouTube links to technical training videos from science-based creators
- Prioritize Dylan Johnson, TrainerRoad, and GCN's technical content
- Format: **Technique**: [Video Title](https://youtube.com/watch?v=ID) by Creator
- Focus on evidence-based training methods and performance optimization videos`)}
                  className="text-xs text-orange-600 hover:text-orange-700 underline"
                >
                  Use this style
                </button>
              </div>

              <div className="border border-gray-200 rounded-md p-4">
                <h4 className="font-medium text-gray-900 mb-2">🧘 Holistic Wellness Coach</h4>
                <p className="text-sm text-gray-600 mb-2">
                  Balanced approach, emphasizes recovery, mental health, and sustainable training
                </p>
                <button
                  onClick={() => setSystemPrompt(`You are a holistic wellness coach who emphasizes the importance of balance, recovery, and mental well-being alongside physical training. You consider the whole person - not just their workout data - and provide advice that promotes sustainable, long-term health and fitness. You encourage rest when needed and help prevent burnout.

EXERCISE VIDEO GUIDELINES:
- Include YouTube links for recovery, stretching, and wellness content
- Prioritize Yoga with Adriene, Peter Attia MD, and GCN's recovery videos
- Format: **Practice**: [Video Title](https://youtube.com/watch?v=ID) by Creator
- Focus on sustainable training, recovery techniques, and mental wellness`)}
                  className="text-xs text-orange-600 hover:text-orange-700 underline"
                >
                  Use this style
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};