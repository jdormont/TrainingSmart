import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Save, RotateCcw, Bot, User, Settings, Moon, Activity, Calendar as CalendarIcon, TrendingUp, Target, Watch, Copy, Eye, EyeOff, Download } from 'lucide-react';
import { Button } from '../components/common/Button';
import { stravaApi } from '../services/stravaApi';
import { stravaCacheService } from '../services/stravaCacheService';
import { ouraApi } from '../services/ouraApi';
import { googleCalendarService } from '../services/googleCalendarService';
import { AdminDashboard } from '../components/admin/AdminDashboard';
import { useAuth } from '../contexts/AuthContext';
import { STORAGE_KEYS } from '../utils/constants';
import { supabase } from '../services/supabaseClient';
import {
  userProfileService,
  COACH_PERSONAS,
  TRAINING_GOALS,
  SKILL_LEVELS,
  AVAILABLE_INTERESTS
} from '../services/userProfileService';
import type { StravaAthlete } from '../types';
import { analytics } from '../lib/analytics';

const DEFAULT_SYSTEM_PROMPT = `You are TrainingSmart AI, an elite cycling and running coach with direct access to the user's Strava training data.

CURRENT USER CONTEXT:
- **Training Goal:** {{USER_TRAINING_GOAL}} (e.g., Event Prep, Weight Loss, General Fitness)
- **Coaching Style:** {{USER_COACH_STYLE}} (e.g., Supportive, Drill Sergeant, Analytical)
- **Weekly Hours Cap:** {{USER_WEEKLY_HOURS}} hours

CORE COACHING PROTOCOLS:
1. **Data-First Analysis:** Never give generic advice. Always anchor your feedback in the user's recent activity data.
   - If they ask "How did I do?", analyze their Heart Rate relative to Pace/Power.
   - Look for signs of overtraining (decreasing HR variability, plateauing performance) or undertraining.
   - Acknowledge consistency streaks or missed workouts immediately.

2. **Persona Adaptation:**
   - If Style is **"Supportive"**: Focus on consistency, mental health, and celebrating small wins. Be gentle with missed workouts.
   - If Style is **"Drill Sergeant"**: Focus on discipline, accountability, and "no excuses." Call out skipped sessions directly.
   - If Style is **"Analytical"**: Focus on the numbers (TSS, Watts/kg, HR Zones). Be precise and scientific.

3. **Safety & Progression:**
   - Adhere to the 10% rule (don't increase volume by >10% weekly).
   - If the user reports pain, immediately switch to "Physio Mode" and recommend rest or medical consultation.

CONTENT & VIDEO RECOMMENDATIONS (CRITICAL):
You have access to a tool to search YouTube. **DO NOT hallucinate video URLs.**
When recommending exercises or deep dives, you MUST use the provided tool to find a *real* video URL before displaying it.

**Trusted Creators (Prioritize these sources):**
- **Technique/Culture:** GCN (Global Cycling Network), Cam Nicholls
- **Science/Training:** Dylan Johnson, Peter Attia MD, TrainerRoad
- **Maintenance:** GMBN Tech, Park Tool
- **Strength/Mobility:** Yoga with Adriene (Yoga), Athlean-X (Strength), Dialed Health

**Video Output Format:**
When sharing a video, use this format:
"I found a great guide on this: **[Video Title](EXACT_URL_FROM_TOOL)** by [Creator Name]"

RESPONSE GUIDELINES:
- Keep responses concise (max 3-4 paragraphs) unless asked for a deep dive.
- Use bullet points for workout steps or analysis breakdown.
- End with a specific question to keep the user engaged (e.g., "Ready to try those intervals tomorrow?" or "How did your legs feel on that climb?").`;

export const SettingsPage: React.FC = () => {
  const { userProfile } = useAuth();
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [athlete, setAthlete] = useState<StravaAthlete | null>(null);
  const [ouraConnected, setOuraConnected] = useState(false);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [calendarConnectedAt, setCalendarConnectedAt] = useState<Date | null>(null);
  const [connectingCalendar, setConnectingCalendar] = useState(false);
  const [refreshingCache, setRefreshingCache] = useState(false);
  const [stravaConnectedAt, setStravaConnectedAt] = useState<Date | null>(null);
  const [gender, setGender] = useState<string>('');
  const [ageBucket, setAgeBucket] = useState<string>('');
  const [savingDemographics, setSavingDemographics] = useState(false);
  const [demographicsSaved, setDemographicsSaved] = useState(false);

  const [trainingGoal, setTrainingGoal] = useState<string>('');
  const [weeklyHours, setWeeklyHours] = useState<number>(0);
  const [coachPersona, setCoachPersona] = useState<string>('');
  const [skillLevel, setSkillLevel] = useState<'beginner' | 'intermediate' | 'advanced' | 'pro'>('beginner');
  const [interests, setInterests] = useState<string[]>([]);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  // New state for API Key display
  const [showKeys, setShowKeys] = useState(false);
  const [copying, setCopying] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Load saved system prompt
    const savedPrompt = localStorage.getItem(STORAGE_KEYS.SYSTEM_PROMPT);
    if (savedPrompt) {
      setSystemPrompt(savedPrompt);
    }

    // Check Oura connection status
    const checkOuraStatus = async () => {
      const connected = await ouraApi.isAuthenticated();
      setOuraConnected(connected);
    };
    checkOuraStatus();

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

    // Load demographic data
    const loadDemographics = async () => {
      if (userProfile) {
        setGender(userProfile.gender || '');
        setAgeBucket(userProfile.age_bucket || '');
      }
    };
    loadDemographics();

    // Load training profile and content profile
    const loadProfiles = async () => {
      try {
        const [trainingProfile, contentProfile] = await Promise.all([
          userProfileService.getUserProfile(),
          userProfileService.getContentProfile()
        ]);

        if (trainingProfile) {
          setTrainingGoal(trainingProfile.training_goal || '');
          setWeeklyHours(trainingProfile.weekly_hours || 0);
          setCoachPersona(trainingProfile.coach_persona || '');
        }

        if (contentProfile) {
          setSkillLevel(contentProfile.skill_level || 'beginner');
          setInterests(contentProfile.interests || []);
        }
      } catch (error) {
        console.error('Failed to load profiles:', error);
      }
    };
    loadProfiles();

    // Check Google Calendar connection status
    const checkCalendarStatus = async () => {
      const status = await googleCalendarService.getConnectionStatus();
      setCalendarConnected(status.connected);
      setCalendarConnectedAt(status.connectedAt || null);
    };
    checkCalendarStatus();
  }, [userProfile]);

  // Handle OAuth callback
  useEffect(() => {
    const handleCalendarCallback = async (code: string) => {
      setConnectingCalendar(true);
      try {
        await googleCalendarService.handleOAuthCallback(code);
        const status = await googleCalendarService.getConnectionStatus();
        setCalendarConnected(status.connected);
        setCalendarConnectedAt(status.connectedAt || null);

        // Track successful connection
        analytics.track('provider_connected', { provider: 'google_calendar' });

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

    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    if (code) {
      handleCalendarCallback(code);
    }
  }, [location.search, navigate]);

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
      await stravaApi.clearTokens();
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
      analytics.track('provider_connected', { provider: 'oura' });
      window.location.href = authUrl;
    } catch (error) {
      console.error('❌ Failed to connect to Oura:', error);
      alert(`Configuration Error: ${(error as Error).message}\n\nPlease check your .env file and make sure you have valid Oura API credentials.`);
    }
  };

  const handleDisconnectOura = async () => {
    if (confirm('Are you sure you want to disconnect your Oura Ring? This will clear all your recovery data.')) {
      await ouraApi.clearTokens();
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

  const handleSaveDemographics = async () => {
    setSavingDemographics(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('user_profiles')
        .update({
          gender: gender || null,
          age_bucket: ageBucket || null,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (error) throw error;

      setDemographicsSaved(true);
      setTimeout(() => setDemographicsSaved(false), 3000);
    } catch (error) {
      console.error('Failed to save demographic data:', error);
      alert(`Failed to save: ${(error as Error).message}`);
    } finally {
      setSavingDemographics(false);
    }
  };

  const handleSaveTrainingProfile = async () => {
    setSavingProfile(true);
    try {
      await Promise.all([
        userProfileService.updateUserProfile({
          training_goal: trainingGoal || undefined,
          weekly_hours: weeklyHours || undefined,
          coach_persona: coachPersona || undefined
        }),
        userProfileService.updateContentProfile({
          skill_level: skillLevel,
          interests: interests
        })
      ]);

      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (error) {
      console.error('Failed to save training profile:', error);
      alert(`Failed to save: ${(error as Error).message}`);
    } finally {
      setSavingProfile(false);
    }
  };

  const toggleInterest = (interest: string) => {
    setInterests(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-50 mb-2">Settings</h1>
          <p className="text-slate-400">
            Customize your AI coach and manage your account
          </p>
        </div>

        <div className="space-y-8">
          {/* Admin Dashboard */}
          {userProfile?.is_admin && (
            <div className="bg-slate-900 rounded-lg shadow-sm border border-slate-800 p-6">
              <AdminDashboard />
            </div>
          )}
          {/* Strava Connection */}
          <div className="bg-slate-900 rounded-lg shadow-sm border border-slate-800 p-6">
            <h2 className="text-xl font-semibold text-slate-100 mb-4 flex items-center">
              <Activity className="w-5 h-5 mr-2" />
              Strava Connection
            </h2>

            {athlete ? (
              <div>
                <div className="space-y-2 mb-6">
                  <div className="flex items-center space-x-2 text-green-400">
                    <Activity className="w-5 h-5" />
                    <span className="font-medium">Strava Connected</span>
                  </div>
                  {stravaConnectedAt && (
                    <p className="text-xs text-slate-500">
                      Connected on {stravaConnectedAt.toLocaleDateString()} at {stravaConnectedAt.toLocaleTimeString()}
                    </p>
                  )}
                </div>

                <div className="grid md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-400">Name</label>
                    <p className="text-slate-200">{athlete.firstname} {athlete.lastname}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400">Location</label>
                    <p className="text-slate-200">{athlete.city}, {athlete.state}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400">Strava ID</label>
                    <p className="text-slate-200">{athlete.id}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400">Username</label>
                    <p className="text-slate-200">@{athlete.username}</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 space-y-3">
                  <div className="flex gap-3">
                    <Button
                      onClick={handleRefreshCache}
                      loading={refreshingCache}
                      variant="outline"
                      className="text-orange-400 border-orange-500/30 hover:bg-orange-500/10"
                    >
                      {refreshingCache ? 'Refreshing...' : 'Refresh Data'}
                    </Button>
                    <Button
                      onClick={handleDisconnect}
                      variant="outline"
                      className="text-red-400 border-red-500/30 hover:bg-red-500/10"
                    >
                      Disconnect Account
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500">
                    Data is cached for 15 minutes to respect Strava's rate limits. Use "Refresh Data" to sync your latest activities.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-slate-400">
                  Connect your Strava account to access your activities and training data.
                </p>

                <div className="bg-orange-950/20 border border-orange-500/20 rounded-lg p-4">
                  <h3 className="font-medium text-orange-200 mb-2">
                    Why Connect Strava?
                  </h3>
                  <ul className="text-sm text-orange-200/80 space-y-1">
                    <li>• Get personalized coaching based on your real activities</li>
                    <li>• Track your training progress and trends</li>
                    <li>• Receive AI-powered training recommendations</li>
                    <li>• Analyze performance metrics and recovery needs</li>
                  </ul>
                </div>

                <Button
                  onClick={handleConnectStrava}
                  className="bg-orange-600 hover:bg-orange-700 flex items-center space-x-2 text-white"
                >
                  <Activity className="w-4 h-4" />
                  <span>Connect Strava</span>
                </Button>

                <p className="text-xs text-slate-500">
                  You'll be redirected to Strava to authorize access to your activities.
                </p>

                <div className="mt-2">
                  <Link
                    to="/auth/strava/direct"
                    className="text-sm text-orange-400 hover:text-orange-300 underline"
                  >
                    Having trouble? Try direct authentication
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Google Calendar Integration */}
          <div className="bg-slate-900 rounded-lg shadow-sm border border-slate-800 p-6">
            <h2 className="text-xl font-semibold text-slate-100 mb-4 flex items-center">
              <CalendarIcon className="w-5 h-5 mr-2" />
              Google Calendar Integration
            </h2>

            <p className="text-slate-400 mb-4">
              Connect your Google Calendar to export your workout plans. This is a one-way export -
              workouts will be added to your calendar but won't sync back.
            </p>

            {connectingCalendar ? (
              <div className="flex items-center space-x-2 text-slate-400">
                <Activity className="w-5 h-5 animate-spin" />
                <span>Connecting to Google Calendar...</span>
              </div>
            ) : calendarConnected ? (
              <div className="space-y-4">
                <div className="flex items-center space-x-2 text-green-400">
                  <CalendarIcon className="w-5 h-5" />
                  <span className="font-medium">Google Calendar Connected</span>
                </div>
                {calendarConnectedAt && (
                  <p className="text-sm text-slate-400">
                    Connected on {calendarConnectedAt.toLocaleDateString()} at {calendarConnectedAt.toLocaleTimeString()}
                  </p>
                )}
                <p className="text-sm text-slate-400">
                  You can now export workouts from the Plans page. Each workout will include detailed
                  information and a link back to this app.
                </p>
                <Button
                  onClick={handleDisconnectCalendar}
                  variant="outline"
                  className="text-red-400 border-red-500/30 hover:bg-red-500/10"
                >
                  Disconnect Google Calendar
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-blue-950/20 border border-blue-500/20 rounded-lg p-4">
                  <h3 className="font-medium text-blue-200 mb-2">
                    Why Connect Google Calendar?
                  </h3>
                  <ul className="text-sm text-blue-200/80 space-y-1">
                    <li>• Export entire training weeks with one click</li>
                    <li>• Add individual workouts to your calendar</li>
                    <li>• Get reminders for scheduled workouts</li>
                    <li>• Share your training schedule with coaches or friends</li>
                    <li>• View workouts alongside other commitments</li>
                  </ul>
                </div>
                <Button
                  onClick={handleConnectCalendar}
                  className="bg-blue-600 hover:bg-blue-700 flex items-center space-x-2 text-white"
                >
                  <CalendarIcon className="w-4 h-4" />
                  <span>Connect Google Calendar</span>
                </Button>
                <p className="text-xs text-slate-500">
                  You'll be redirected to Google to authorize access to your calendar.
                </p>
              </div>
            )}
          </div>

          {/* Oura Integration */}
          <div className="bg-slate-900 rounded-lg shadow-sm border border-slate-800 p-6">
            <h2 className="text-xl font-semibold text-slate-100 mb-4 flex items-center">
              <Moon className="w-5 h-5 mr-2" />
              Oura Ring Integration
            </h2>

            <p className="text-slate-400 mb-4">
              Connect your Oura Ring to get sleep quality, recovery scores, and readiness data
              integrated with your training insights.
            </p>

            {ouraConnected ? (
              <div className="space-y-4">
                <div className="flex items-center space-x-2 text-green-400">
                  <Activity className="w-5 h-5" />
                  <span className="font-medium">Oura Ring Connected</span>
                </div>
                <p className="text-sm text-slate-400">
                  Your sleep and recovery data is being synced automatically.
                </p>
                <Button
                  onClick={handleDisconnectOura}
                  variant="outline"
                  className="text-red-400 border-red-500/30 hover:bg-red-500/10"
                >
                  Disconnect Oura Ring
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-purple-950/20 border border-purple-500/20 rounded-lg p-4">
                  <h3 className="font-medium text-purple-200 mb-2">
                    Why Connect Your Oura Ring?
                  </h3>
                  <ul className="text-sm text-purple-200/80 space-y-1">
                    <li>• Get recovery-based training recommendations</li>
                    <li>• Track sleep quality and its impact on performance</li>
                    <li>• Monitor HRV and readiness for optimal training</li>
                    <li>• AI coach factors in your recovery data</li>
                  </ul>
                </div>
                <Button
                  onClick={handleConnectOura}
                  className="bg-purple-600 hover:bg-purple-700 flex items-center space-x-2 text-white"
                >
                  <Moon className="w-4 h-4" />
                  <span>Connect Oura Ring</span>
                </Button>
                <p className="text-xs text-slate-500">
                  You'll be redirected to Oura to authorize access to your health data.
                </p>
                <div className="mt-2">
                  <Link
                    to="/auth/oura/direct"
                    className="text-sm text-purple-400 hover:text-purple-300 underline"
                  >
                    Having trouble? Try direct authentication
                  </Link>
                </div>
              </div>
            )}
          </div>
          {/* Demographics */}
          <div className="bg-slate-900 rounded-lg shadow-sm border border-slate-800 p-6">
            <h2 className="text-xl font-semibold text-slate-100 mb-4 flex items-center">
              <TrendingUp className="w-5 h-5 mr-2" />
              Health Profile
            </h2>

            <p className="text-slate-400 mb-4">
              This data helps calibrate recommendations and health/recovery scores more accurately based on your age and gender.
            </p>

            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="gender" className="block text-sm font-medium text-slate-400 mb-2">
                    Gender
                  </label>
                  <select
                    id="gender"
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="">Prefer not to say</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="ageBucket" className="block text-sm font-medium text-slate-400 mb-2">
                    Age Range
                  </label>
                  <select
                    id="ageBucket"
                    value={ageBucket}
                    onChange={(e) => setAgeBucket(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="">Select age range</option>
                    <option value="18-24">18-24</option>
                    <option value="25-34">25-34</option>
                    <option value="35-44">35-44</option>
                    <option value="45-54">45-54</option>
                    <option value="55-64">55-64</option>
                    <option value="65+">65+</option>
                  </select>
                </div>
              </div>

              <div className="bg-blue-950/20 border border-blue-500/20 rounded-lg p-4">
                <h3 className="font-medium text-blue-200 mb-2 text-sm">
                  Why we ask for this information
                </h3>
                <ul className="text-xs text-blue-200/80 space-y-1">
                  <li>• <strong>HRV scoring</strong>: Normal HRV ranges vary significantly by age and gender</li>
                  <li>• <strong>Resting heart rate</strong>: Target ranges differ based on age and gender</li>
                  <li>• <strong>Recovery calibration</strong>: More accurate recommendations based on your demographic</li>
                  <li>• <strong>Training recommendations</strong>: Age-appropriate training advice from your AI coach</li>
                </ul>
              </div>

              <div className="flex space-x-3">
                <Button
                  onClick={handleSaveDemographics}
                  loading={savingDemographics}
                  className="flex items-center text-white bg-orange-600 hover:bg-orange-700"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {demographicsSaved ? 'Saved!' : 'Save Profile'}
                </Button>
              </div>

              {demographicsSaved && (
                <div className="bg-green-950/20 border border-green-500/20 rounded-md p-3">
                  <p className="text-green-400 text-sm">
                    ✅ Health profile saved! Your health metrics will now be calibrated based on your demographics.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Apple Watch Health Sync */}
          <div className="bg-slate-900 rounded-lg shadow-sm border border-slate-800 p-6">
            <h2 className="text-xl font-semibold text-slate-100 mb-6 flex items-center">
              <Watch className="w-5 h-5 mr-2 text-red-500" />
              Apple Watch Health Sync
            </h2>

            <div className="space-y-6">
              {/* Step 1 */}
              <div>
                <p className="text-slate-300 mb-3 font-medium">1. Download the Shortcut</p>
                <p className="text-sm text-slate-400 mb-3">
                  First, download the official TrainingSmart iOS Shortcut. This allows you to sync your health data from Apple Health to the app.
                </p>
                <a
                  href="https://www.icloud.com/shortcuts/28b55a5f799d43e49d9023a9fe1c6050"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => analytics.track('shortcut_downloaded')}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Shortcut
                </a>
              </div>

              <div className="border-t border-slate-800"></div>

              {/* Step 2 */}
              <div>
                <p className="text-slate-300 mb-3 font-medium">2. Configure with your API Key</p>
                <p className="text-sm text-slate-400 mb-3">
                  Next, copy your personal API Key. Add it to the first "Text" field in the Shortcut setup or settings.
                </p>

                <div className="relative">
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                    Your Ingest Key
                  </label>
                  <div className="flex items-center space-x-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        readOnly
                        value={userProfile?.ingest_key || 'Loading...'}
                        className="block w-full pl-3 pr-10 py-2 text-sm font-mono bg-slate-800 border border-slate-700 text-slate-200 rounded-md focus:ring-orange-500 focus:border-orange-500"
                      />
                      {/* Mask overlay */}
                      {!showKeys && (
                        <div className="absolute inset-0 bg-slate-800 border border-slate-700 rounded-md flex items-center px-3">
                          <span className="text-slate-500">••••••••-••••-••••-••••-••••••••••••</span>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => setShowKeys(!showKeys)}
                      className="p-2 text-slate-400 hover:text-slate-200 rounded-md hover:bg-slate-800 border border-slate-700"
                      title={showKeys ? "Hide Key" : "Show Key"}
                    >
                      {showKeys ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>

                    <Button
                      onClick={() => {
                        if (userProfile?.ingest_key) {
                          navigator.clipboard.writeText(userProfile.ingest_key);
                          analytics.track('ingest_key_copied');
                          setCopying(true);
                          setTimeout(() => setCopying(false), 2000);
                        }
                      }}
                      variant="outline"
                      className="flex-shrink-0 text-slate-300 border-slate-700 hover:bg-slate-800"
                    >
                      {copying ? (
                        <span className="text-green-400 flex items-center">
                          Copied!
                        </span>
                      ) : (
                        <span className="flex items-center">
                          <Copy className="w-4 h-4 mr-2" />
                          Copy
                        </span>
                      )}
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Keep this key private. It grants write access to your health metrics.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Training Profile */}
          <div className="bg-slate-900 rounded-lg shadow-sm border border-slate-800 p-6">
            <h2 className="text-xl font-semibold text-slate-100 mb-4 flex items-center">
              <Target className="w-5 h-5 mr-2" />
              Training Profile
            </h2>

            <p className="text-slate-400 mb-6">
              Manage your coaching preferences and content personalization to get the most relevant recommendations and learning materials.
            </p>

            <div className="space-y-8">
              {/* Section A: Coaching Preferences */}
              <div>
                <h3 className="text-lg font-medium text-slate-200 mb-4 flex items-center">
                  <User className="w-5 h-5 mr-2 text-orange-500" />
                  Coaching Preferences
                </h3>

                <div className="space-y-4">
                  {/* Weekly Hours */}
                  <div>
                    <label htmlFor="weeklyHours" className="block text-sm font-medium text-slate-400 mb-2">
                      Weekly Training Hours
                    </label>
                    <div className="flex items-center space-x-4">
                      <input
                        type="range"
                        id="weeklyHours"
                        min="0"
                        max="20"
                        step="1"
                        value={weeklyHours}
                        onChange={(e) => setWeeklyHours(Number(e.target.value))}
                        className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                      />
                      <div className="w-20 text-center">
                        <input
                          type="number"
                          min="0"
                          max="20"
                          value={weeklyHours}
                          onChange={(e) => setWeeklyHours(Number(e.target.value))}
                          className="w-full px-2 py-1 bg-slate-800 border border-slate-700 text-slate-200 rounded-md text-center focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                      <span className="text-sm text-slate-400 w-12">hours</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      How many hours per week can you dedicate to training?
                    </p>
                  </div>

                  {/* Coach Persona */}
                  <div>
                    <label htmlFor="coachPersona" className="block text-sm font-medium text-slate-400 mb-2">
                      Coach Persona
                    </label>
                    <div className="grid md:grid-cols-3 gap-3">
                      {COACH_PERSONAS.map((persona) => (
                        <button
                          key={persona.value}
                          type="button"
                          onClick={() => setCoachPersona(persona.value)}
                          className={`p-4 text-left rounded-lg border transition-colors ${coachPersona === persona.value
                            ? 'border-orange-500 bg-orange-950/20'
                            : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                            }`}
                        >
                          <div className={`font-medium mb-1 ${coachPersona === persona.value ? 'text-orange-400' : 'text-slate-200'}`}>
                            {persona.label}
                          </div>
                          <div className="text-xs text-slate-400">{persona.description}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Main Goal */}
                  <div>
                    <label htmlFor="trainingGoal" className="block text-sm font-medium text-slate-400 mb-2">
                      Main Training Goal
                    </label>
                    <div className="grid md:grid-cols-2 gap-3">
                      {TRAINING_GOALS.map((goal) => (
                        <button
                          key={goal.value}
                          type="button"
                          onClick={() => setTrainingGoal(goal.value)}
                          className={`p-4 text-left rounded-lg border transition-colors ${trainingGoal === goal.value
                            ? 'border-orange-500 bg-orange-950/20'
                            : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                            }`}
                        >
                          <div className={`font-medium mb-1 ${trainingGoal === goal.value ? 'text-orange-400' : 'text-slate-200'}`}>
                            {goal.label}
                          </div>
                          <div className="text-xs text-slate-400">{goal.description}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section B: Content Personalization */}
              <div className="pt-6 border-t border-slate-800">
                <h3 className="text-lg font-medium text-slate-200 mb-4 flex items-center">
                  <Settings className="w-5 h-5 mr-2 text-orange-500" />
                  Content Personalization
                </h3>

                <div className="space-y-4">
                  {/* Skill Level */}
                  <div>
                    <label htmlFor="skillLevel" className="block text-sm font-medium text-slate-400 mb-2">
                      Skill Level
                    </label>
                    <div className="grid grid-cols-4 gap-3">
                      {SKILL_LEVELS.map((level) => (
                        <button
                          key={level.value}
                          type="button"
                          onClick={() => setSkillLevel(level.value as 'beginner' | 'intermediate' | 'advanced' | 'pro')}
                          className={`p-3 text-center rounded-lg border transition-colors ${skillLevel === level.value
                            ? 'border-orange-500 bg-orange-950/20 text-orange-400'
                            : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600'
                            }`}
                        >
                          <div className="font-medium text-sm">{level.label}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Interests */}
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">
                      Interests
                      <span className="ml-2 text-xs text-slate-500 font-normal">
                        ({interests.length} selected)
                      </span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {AVAILABLE_INTERESTS.map((interest) => (
                        <button
                          key={interest}
                          type="button"
                          onClick={() => toggleInterest(interest)}
                          className={`px-3 py-2 rounded-full text-sm transition-colors ${interests.includes(interest)
                            ? 'bg-orange-600 text-white hover:bg-orange-700'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }`}
                        >
                          {interest}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      Select topics you're interested in to personalize your content feed
                    </p>
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className="flex space-x-3 pt-6 border-t border-slate-800">
                <Button
                  onClick={handleSaveTrainingProfile}
                  loading={savingProfile}
                  className="flex items-center text-white bg-orange-600 hover:bg-orange-700"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {profileSaved ? 'Saved!' : 'Save Changes'}
                </Button>
              </div>

              {profileSaved && (
                <div className="bg-green-950/20 border border-green-500/20 rounded-md p-3">
                  <p className="text-green-400 text-sm">
                    ✅ Training profile saved! Your coaching and content preferences have been updated.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* AI Coach Settings */}
          <div className="bg-slate-900 rounded-lg shadow-sm border border-slate-800 p-6">
            <h2 className="text-xl font-semibold text-slate-100 mb-4 flex items-center">
              <Bot className="w-5 h-5 mr-2" />
              AI Coach Personality
            </h2>

            <p className="text-slate-400 mb-4">
              Customize how your AI coach communicates with you. This system prompt defines
              the coach's personality, expertise, and approach to giving you training advice.
            </p>

            <div className="space-y-4">
              <div>
                <label htmlFor="systemPrompt" className="block text-sm font-medium text-slate-400 mb-2">
                  System Prompt
                </label>
                <textarea
                  id="systemPrompt"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={12}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent font-mono text-sm"
                  placeholder="Enter your custom system prompt..."
                />
                <p className="text-xs text-slate-500 mt-1">
                  The AI coach will use this prompt to understand how to interact with you and analyze your training data.
                </p>
              </div>

              <div className="flex space-x-3">
                <Button
                  onClick={handleSave}
                  loading={saving}
                  className="flex items-center text-white bg-orange-600 hover:bg-orange-700"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saved ? 'Saved!' : 'Save Changes'}
                </Button>

                <Button
                  onClick={handleReset}
                  variant="outline"
                  className="flex items-center text-slate-300 border-slate-700 hover:bg-slate-800"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset to Default
                </Button>
              </div>

              {saved && (
                <div className="bg-green-950/20 border border-green-500/20 rounded-md p-3">
                  <p className="text-green-400 text-sm">
                    ✅ System prompt saved! Your AI coach will use this personality in future conversations.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Prompt Examples */}
          <div className="bg-slate-900 rounded-lg shadow-sm border border-slate-800 p-6">
            <h3 className="text-lg font-semibold text-slate-200 mb-4">Example Coaching Styles</h3>

            <div className="space-y-4">
              <div className="border border-slate-800 bg-slate-800/20 rounded-md p-4">
                <h4 className="font-medium text-slate-200 mb-2">🏃 Motivational Coach</h4>
                <p className="text-sm text-slate-400 mb-2">
                  Encouraging, positive, focuses on progress and achievements
                </p>
                <button
                  onClick={() => setSystemPrompt(`You are an enthusiastic and motivational personal training coach. You celebrate every achievement, no matter how small, and always focus on progress and positive reinforcement. You use encouraging language and help athletes see their potential. Base all advice on their actual Strava training data while maintaining an upbeat, supportive tone.

EXERCISE VIDEO GUIDELINES:
- Always include YouTube links for exercises and techniques from top creators
- Format: **Exercise**: [Video Title](https://youtube.com/watch?v=ID) by Creator
- Recommend GCN, TrainerRoad, Dylan Johnson, and other top cycling channels
- Include motivational fitness creators like Athlean-X and Yoga with Adriene`)}
                  className="text-xs text-orange-400 hover:text-orange-300 underline"
                >
                  Use this style
                </button>
              </div>

              <div className="border border-slate-800 bg-slate-800/20 rounded-md p-4">
                <h4 className="font-medium text-slate-200 mb-2">📊 Data-Driven Analyst</h4>
                <p className="text-sm text-slate-400 mb-2">
                  Technical, analytical, focuses on metrics and performance optimization
                </p>
                <button
                  onClick={() => setSystemPrompt(`You are a highly analytical sports scientist and coach who focuses on data-driven training optimization. You provide detailed analysis of training metrics, identify patterns in performance data, and give precise, evidence-based recommendations. You reference specific numbers from their Strava activities and explain the science behind your advice.

EXERCISE VIDEO GUIDELINES:
- Include YouTube links to technical training videos from science-based creators
- Prioritize Dylan Johnson, TrainerRoad, and GCN's technical content
- Format: **Technique**: [Video Title](https://youtube.com/watch?v=ID) by Creator
- Focus on evidence-based training methods and performance optimization videos`)}
                  className="text-xs text-orange-400 hover:text-orange-300 underline"
                >
                  Use this style
                </button>
              </div>

              <div className="border border-slate-800 bg-slate-800/20 rounded-md p-4">
                <h4 className="font-medium text-slate-200 mb-2">🧘 Holistic Wellness Coach</h4>
                <p className="text-sm text-slate-400 mb-2">
                  Balanced approach, emphasizes recovery, mental health, and sustainable training
                </p>
                <button
                  onClick={() => setSystemPrompt(`You are a holistic wellness coach who emphasizes the importance of balance, recovery, and mental well-being alongside physical training. You consider the whole person - not just their workout data - and provide advice that promotes sustainable, long-term health and fitness. You encourage rest when needed and help prevent burnout.

EXERCISE VIDEO GUIDELINES:
- Include YouTube links for recovery, stretching, and wellness content
- Prioritize Yoga with Adriene, Peter Attia MD, and GCN's recovery videos
- Format: **Practice**: [Video Title](https://youtube.com/watch?v=ID) by Creator
- Focus on sustainable training, recovery techniques, and mental wellness`)}
                  className="text-xs text-orange-400 hover:text-orange-300 underline"
                >
                  Use this style
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div >
  );
};