import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Save, RotateCcw, Bot, User, Settings, Moon, Activity, TrendingUp, Watch, Copy, Eye, EyeOff, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '../components/common/Button';
import { stravaApi } from '../services/stravaApi';
import { stravaCacheService } from '../services/stravaCacheService';
import { ouraApi } from '../services/ouraApi';
import { AdminDashboard } from '../components/admin/AdminDashboard';
import { useAuth } from '../contexts/AuthContext';
import { STORAGE_KEYS } from '../utils/constants';
import { Integrations } from '../components/settings/Integrations';
import { CoachSpecializationSelector } from '../components/settings/CoachSpecializationSelector';
import type { CoachSpecialization, FitnessMode } from '../types';
import {
  userProfileService,
  COACH_PERSONAS,
  TRAINING_GOALS,
  SKILL_LEVELS,
  AVAILABLE_INTERESTS
} from '../services/userProfileService';
import type { StravaAthlete } from '../types';
import { analytics } from '../lib/analytics';

type Tab = 'coach' | 'profile' | 'integrations' | 'advanced';

const TABS: { id: Tab; label: string }[] = [
  { id: 'coach', label: 'My Coach' },
  { id: 'profile', label: 'My Profile' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'advanced', label: 'Advanced' },
];

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
  const { userProfile, reloadProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('coach');

  // --- My Coach tab state ---
  const [coachSpecialization, setCoachSpecialization] = useState<CoachSpecialization | undefined>(
    userProfile?.coach_specialization as CoachSpecialization | undefined
  );
  const [fitnessMode, setFitnessMode] = useState<FitnessMode>(
    (userProfile?.fitness_mode as FitnessMode) ?? 'performance'
  );
  const [savingFitnessMode, setSavingFitnessMode] = useState(false);
  const [fitnessModeError, setFitnessModeError] = useState<string | null>(null);
  const [trainingGoal, setTrainingGoal] = useState<string>('');
  const [coachPersona, setCoachPersona] = useState<string>('');
  const [savingCoachPrefs, setSavingCoachPrefs] = useState(false);
  const [coachPrefsSaved, setCoachPrefsSaved] = useState(false);

  // --- My Profile tab state ---
  const [gender, setGender] = useState<string>('');
  const [ageBucket, setAgeBucket] = useState<string>('');
  const [ftp, setFtp] = useState<number | ''>('');
  const [skillLevel, setSkillLevel] = useState<'beginner' | 'intermediate' | 'advanced' | 'pro'>('beginner');
  const [weeklyAvailabilityDays, setWeeklyAvailabilityDays] = useState<number>(3);
  const [weeklyAvailabilityDuration, setWeeklyAvailabilityDuration] = useState<number>(45);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  // --- Integrations tab state ---
  const [athlete, setAthlete] = useState<StravaAthlete | null>(null);
  const [ouraConnected, setOuraConnected] = useState(false);
  const [calendarToken, setCalendarToken] = useState<string | null>(null);
  const [refreshingCache, setRefreshingCache] = useState(false);
  const [stravaConnectedAt, setStravaConnectedAt] = useState<Date | null>(null);
  const [showKeys, setShowKeys] = useState(false);
  const [copying, setCopying] = useState(false);

  // --- Advanced tab state ---
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [promptSaved, setPromptSaved] = useState(false);
  const [interests, setInterests] = useState<string[]>([]);
  const [savingInterests, setSavingInterests] = useState(false);
  const [interestsSaved, setInterestsSaved] = useState(false);
  const [examplesOpen, setExamplesOpen] = useState(false);

  useEffect(() => {
    const savedPrompt = localStorage.getItem(STORAGE_KEYS.SYSTEM_PROMPT);
    if (savedPrompt) setSystemPrompt(savedPrompt);

    const checkOuraStatus = async () => {
      const connected = await ouraApi.isAuthenticated();
      setOuraConnected(connected);
    };
    checkOuraStatus();

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

    const loadProfiles = async () => {
      try {
        const [trainingProfile, contentProfile] = await Promise.all([
          userProfileService.getUserProfile(),
          userProfileService.getContentProfile()
        ]);

        if (trainingProfile) {
          setTrainingGoal(trainingProfile.training_goal || '');
          setFtp(trainingProfile.ftp || '');
          setCoachPersona(trainingProfile.coach_persona || '');
          setGender(trainingProfile.gender || '');
          setAgeBucket(trainingProfile.age_bucket || '');
          setWeeklyAvailabilityDays(trainingProfile.weekly_availability_days ?? 3);
          setWeeklyAvailabilityDuration(trainingProfile.weekly_availability_duration ?? 45);
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

    const loadCalendarToken = async () => {
      const profile = await userProfileService.getUserProfile();
      if (profile?.calendar_token) setCalendarToken(profile.calendar_token);
    };
    loadCalendarToken();
  }, [userProfile]);

  // My Coach handlers
  const handleSaveCoachPreferences = async () => {
    setSavingCoachPrefs(true);
    try {
      await userProfileService.updateUserProfile({
        training_goal: trainingGoal || undefined,
        coach_persona: coachPersona || undefined,
      });
      setCoachPrefsSaved(true);
      setTimeout(() => setCoachPrefsSaved(false), 3000);
    } catch (error) {
      console.error('Failed to save coach preferences:', error);
    } finally {
      setSavingCoachPrefs(false);
    }
  };

  // My Profile handlers
  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await Promise.all([
        userProfileService.updateUserProfile({
          gender: gender || undefined,
          age_bucket: ageBucket || undefined,
          ftp: ftp ? Number(ftp) : undefined,
          weekly_availability_days: weeklyAvailabilityDays,
          weekly_availability_duration: weeklyAvailabilityDuration,
        }),
        userProfileService.updateContentProfile({
          skill_level: skillLevel,
          interests: interests,
        }),
      ]);
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (error) {
      console.error('Failed to save profile:', error);
    } finally {
      setSavingProfile(false);
    }
  };

  // Integrations handlers
  const handleConnectStrava = () => {
    try {
      const authUrl = stravaApi.generateAuthUrl();
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
      const authUrl = ouraApi.generateAuthUrl();
      analytics.track('provider_connected', { provider: 'oura' });
      window.location.href = authUrl;
    } catch (error) {
      console.error('Failed to connect to Oura:', error);
      alert(`Configuration Error: ${(error as Error).message}\n\nPlease check your .env file and make sure you have valid Oura API credentials.`);
    }
  };

  const handleDisconnectOura = async () => {
    if (confirm('Are you sure you want to disconnect your Oura Ring? This will clear all your recovery data.')) {
      await ouraApi.clearTokens();
      setOuraConnected(false);
    }
  };

  // Advanced handlers
  const handleSavePrompt = async () => {
    setSavingPrompt(true);
    try {
      localStorage.setItem(STORAGE_KEYS.SYSTEM_PROMPT, systemPrompt);
      setPromptSaved(true);
      setTimeout(() => setPromptSaved(false), 2000);
    } catch (error) {
      console.error('Failed to save system prompt:', error);
    } finally {
      setSavingPrompt(false);
    }
  };

  const handleResetPrompt = () => {
    setSystemPrompt(DEFAULT_SYSTEM_PROMPT);
    setPromptSaved(false);
  };

  const handleSaveInterests = async () => {
    setSavingInterests(true);
    try {
      await userProfileService.updateContentProfile({ interests });
      setInterestsSaved(true);
      setTimeout(() => setInterestsSaved(false), 3000);
    } catch (error) {
      console.error('Failed to save interests:', error);
    } finally {
      setSavingInterests(false);
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
          <p className="text-slate-400">Customize your AI coach and manage your account</p>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 border-b border-slate-800 mb-8">
          {TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'border-orange-500 text-orange-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Tab 1: My Coach ── */}
        {activeTab === 'coach' && (
          <div className="space-y-8">
            {/* Coach Specialization + Fitness Mode */}
            <div className="bg-slate-900 rounded-lg border border-slate-800 p-6">
              <h2 className="text-xl font-semibold text-slate-100 mb-1 flex items-center gap-2">
                <Bot className="w-5 h-5" />
                Coach Specialization
              </h2>
              <p className="text-slate-400 text-sm mb-5">
                Your coach type shapes your training plans, dashboard, and AI responses.
              </p>
              <CoachSpecializationSelector
                current={coachSpecialization}
                onUpdate={setCoachSpecialization}
              />

              <div className="mt-6 pt-6 border-t border-slate-800">
                <h3 className="text-slate-200 font-medium mb-1">Fitness Mode</h3>
                <p className="text-slate-400 text-sm mb-4">
                  Controls your dashboard layout and how your coach frames plans and feedback.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { value: 'performance' as const, label: 'Performance', emoji: '📈', description: 'Full analytics, power zones, advanced metrics.' },
                    { value: 're_engager' as const, label: 'Re-Engager', emoji: '🌱', description: 'Consistency focus, streak tracking, simplified view.' },
                  ]).map(opt => (
                    <button
                      type="button"
                      key={opt.value}
                      onClick={async () => {
                        if (opt.value === fitnessMode) return;
                        setSavingFitnessMode(true);
                        setFitnessModeError(null);
                        try {
                          await userProfileService.updateFitnessMode(opt.value);
                          setFitnessMode(opt.value);
                          await reloadProfile();
                        } catch {
                          setFitnessModeError('Failed to save. Please try again.');
                        } finally {
                          setSavingFitnessMode(false);
                        }
                      }}
                      className={`text-left px-4 py-4 rounded-xl border transition-all ${
                        fitnessMode === opt.value
                          ? 'border-orange-500 bg-orange-500/10 text-white'
                          : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl">{opt.emoji}</span>
                        <span className="font-semibold text-sm">{opt.label}</span>
                        {fitnessMode === opt.value && (
                          <span className="ml-auto text-xs text-orange-400">active</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">{opt.description}</p>
                    </button>
                  ))}
                </div>
                {fitnessModeError && <p className="text-red-400 text-sm mt-2">{fitnessModeError}</p>}
                {savingFitnessMode && <p className="text-slate-400 text-sm mt-2">Saving…</p>}
              </div>
            </div>

            {/* Communication Style (Coach Persona) */}
            <div className="bg-slate-900 rounded-lg border border-slate-800 p-6">
              <h2 className="text-xl font-semibold text-slate-100 mb-1 flex items-center gap-2">
                <User className="w-5 h-5" />
                Communication Style
              </h2>
              <p className="text-slate-400 text-sm mb-5">
                How your coach talks to you — as a sub-preference within your specialization.
              </p>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-3">Coach Persona</label>
                  <div className="grid md:grid-cols-3 gap-3">
                    {COACH_PERSONAS.map(persona => (
                      <button
                        key={persona.value}
                        type="button"
                        onClick={() => setCoachPersona(persona.value)}
                        className={`p-4 text-left rounded-lg border transition-colors ${
                          coachPersona === persona.value
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

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-3">
                    Training Goal
                    {userProfile?.primary_goal && (
                      <span className="ml-2 text-xs text-orange-400 font-normal">
                        From onboarding: {userProfile.primary_goal}
                      </span>
                    )}
                  </label>
                  <div className="grid md:grid-cols-2 gap-3">
                    {TRAINING_GOALS.map(goal => (
                      <button
                        key={goal.value}
                        type="button"
                        onClick={() => setTrainingGoal(goal.value)}
                        className={`p-4 text-left rounded-lg border transition-colors ${
                          trainingGoal === goal.value
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

                <div className="flex items-center gap-3 pt-2">
                  <Button
                    onClick={handleSaveCoachPreferences}
                    loading={savingCoachPrefs}
                    className="flex items-center text-white bg-orange-600 hover:bg-orange-700"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {coachPrefsSaved ? 'Saved!' : 'Save Preferences'}
                  </Button>
                  {coachPrefsSaved && <span className="text-green-400 text-sm">Saved!</span>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab 2: My Profile ── */}
        {activeTab === 'profile' && (
          <div className="space-y-8">
            <div className="bg-slate-900 rounded-lg border border-slate-800 p-6">
              <h2 className="text-xl font-semibold text-slate-100 mb-1 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Health Profile
              </h2>
              <p className="text-slate-400 text-sm mb-6">
                Used to calibrate health metrics and recovery scores more accurately.
              </p>

              <div className="space-y-6">
                {/* Gender + Age */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="gender" className="block text-sm font-medium text-slate-400 mb-2">Gender</label>
                    <select
                      id="gender"
                      value={gender}
                      onChange={e => setGender(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    >
                      <option value="">Prefer not to say</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="ageBucket" className="block text-sm font-medium text-slate-400 mb-2">Age Range</label>
                    <select
                      id="ageBucket"
                      value={ageBucket}
                      onChange={e => setAgeBucket(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    >
                      <option value="">Select age range</option>
                      <option value="18-24">18–24</option>
                      <option value="25-34">25–34</option>
                      <option value="35-44">35–44</option>
                      <option value="45-54">45–54</option>
                      <option value="55-64">55–64</option>
                      <option value="65+">65+</option>
                    </select>
                  </div>
                </div>

                {/* Weekly Availability */}
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-3">Weekly Availability</label>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-slate-500 mb-2">Days per week</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          title="Days per week"
                          aria-label="Days per week"
                          min="1"
                          max="7"
                          step="1"
                          value={weeklyAvailabilityDays}
                          onChange={e => setWeeklyAvailabilityDays(Number(e.target.value))}
                          className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                        />
                        <span className="w-10 text-center text-slate-200 font-medium">{weeklyAvailabilityDays}d</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-2">Minutes per session</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          title="Minutes per session"
                          aria-label="Minutes per session"
                          min="15"
                          max="120"
                          step="5"
                          value={weeklyAvailabilityDuration}
                          onChange={e => setWeeklyAvailabilityDuration(Number(e.target.value))}
                          className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                        />
                        <span className="w-14 text-center text-slate-200 font-medium">{weeklyAvailabilityDuration}min</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Used to set realistic plan volume. Affects fitness mode auto-assignment.
                  </p>
                </div>

                {/* FTP */}
                <div>
                  <label htmlFor="ftp" className="block text-sm font-medium text-slate-400 mb-2">
                    Functional Threshold Power (FTP)
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      id="ftp-slider"
                      title="FTP slider"
                      aria-label="FTP slider"
                      min="100"
                      max="400"
                      step="5"
                      value={ftp || 200}
                      onChange={e => setFtp(Number(e.target.value))}
                      className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                    />
                    <div className="w-20 text-center">
                      <input
                        type="number"
                        id="ftp"
                        min="0"
                        max="600"
                        value={ftp}
                        onChange={e => setFtp(Number(e.target.value))}
                        placeholder="200"
                        className="w-full px-2 py-1 bg-slate-800 border border-slate-700 text-slate-200 rounded-md text-center focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <span className="text-sm text-slate-400 w-12">watts</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Used for power zone calculations. Leave blank if not applicable.
                  </p>
                </div>

                {/* Skill Level */}
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-3">Skill Level</label>
                  <div className="grid grid-cols-4 gap-3">
                    {SKILL_LEVELS.map(level => (
                      <button
                        key={level.value}
                        type="button"
                        onClick={() => setSkillLevel(level.value as 'beginner' | 'intermediate' | 'advanced' | 'pro')}
                        className={`p-3 text-center rounded-lg border transition-colors ${
                          skillLevel === level.value
                            ? 'border-orange-500 bg-orange-950/20 text-orange-400'
                            : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        <div className="font-medium text-sm">{level.label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-blue-950/20 border border-blue-500/20 rounded-lg p-4">
                  <h3 className="font-medium text-blue-200 mb-2 text-sm">Why we ask for this</h3>
                  <ul className="text-xs text-blue-200/80 space-y-1">
                    <li>• <strong>HRV scoring</strong>: Normal ranges vary significantly by age and gender</li>
                    <li>• <strong>Recovery calibration</strong>: More accurate recommendations based on demographics</li>
                    <li>• <strong>Availability</strong>: Drives realistic plan volume and fitness mode assignment</li>
                  </ul>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    onClick={handleSaveProfile}
                    loading={savingProfile}
                    className="flex items-center text-white bg-orange-600 hover:bg-orange-700"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {profileSaved ? 'Saved!' : 'Save Profile'}
                  </Button>
                  {profileSaved && <span className="text-green-400 text-sm">Profile saved!</span>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab 3: Integrations ── */}
        {activeTab === 'integrations' && (
          <div className="space-y-8">
            {/* Strava */}
            <div className="bg-slate-900 rounded-lg border border-slate-800 p-6">
              <h2 className="text-xl font-semibold text-slate-100 mb-4 flex items-center">
                <Activity className="w-5 h-5 mr-2" />
                Strava
              </h2>

              {athlete ? (
                <div>
                  <div className="space-y-2 mb-6">
                    <div className="flex items-center gap-2 text-green-400">
                      <Activity className="w-5 h-5" />
                      <span className="font-medium">Connected</span>
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
                        Disconnect
                      </Button>
                    </div>
                    <p className="text-xs text-slate-500">
                      Data is cached for 15 minutes. Use "Refresh Data" to sync your latest activities.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-slate-400">Connect your Strava account to access your activities and training data.</p>
                  <div className="bg-orange-950/20 border border-orange-500/20 rounded-lg p-4">
                    <h3 className="font-medium text-orange-200 mb-2">Why Connect Strava?</h3>
                    <ul className="text-sm text-orange-200/80 space-y-1">
                      <li>• Personalized coaching based on your real activities</li>
                      <li>• Training progress tracking and trends</li>
                      <li>• AI-powered training recommendations</li>
                    </ul>
                  </div>
                  <Button
                    onClick={handleConnectStrava}
                    className="bg-orange-600 hover:bg-orange-700 flex items-center gap-2 text-white"
                  >
                    <Activity className="w-4 h-4" />
                    Connect Strava
                  </Button>
                  <p className="text-xs text-slate-500">
                    You'll be redirected to Strava to authorize access.
                  </p>
                  <Link
                    to="/auth/strava/direct"
                    className="text-sm text-orange-400 hover:text-orange-300 underline block"
                  >
                    Having trouble? Try direct authentication
                  </Link>
                </div>
              )}
            </div>

            {/* Oura Ring */}
            <div className="bg-slate-900 rounded-lg border border-slate-800 p-6">
              <h2 className="text-xl font-semibold text-slate-100 mb-4 flex items-center">
                <Moon className="w-5 h-5 mr-2" />
                Oura Ring
              </h2>
              <p className="text-slate-400 mb-4">
                Connect your Oura Ring to get sleep quality, recovery scores, and readiness data integrated with your training.
              </p>

              {ouraConnected ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-green-400">
                    <Activity className="w-5 h-5" />
                    <span className="font-medium">Connected</span>
                  </div>
                  <p className="text-sm text-slate-400">Your sleep and recovery data is being synced automatically.</p>
                  <Button
                    onClick={handleDisconnectOura}
                    variant="outline"
                    className="text-red-400 border-red-500/30 hover:bg-red-500/10"
                  >
                    Disconnect Oura Ring
                  </Button>

                  <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-300">Manual Sync</p>
                      <p className="text-xs text-slate-500">Pull latest 90 days of data</p>
                    </div>
                    <Button
                      type="button"
                      onClick={async () => {
                        if (!userProfile?.user_id) return;
                        const btn = document.getElementById('oura-sync-btn');
                        if (btn) btn.innerText = 'Syncing...';
                        try {
                          const end = new Date();
                          const start = new Date();
                          start.setDate(start.getDate() - 90);
                          await ouraApi.syncOuraToDatabase(
                            userProfile.user_id,
                            start.toISOString().split('T')[0],
                            end.toISOString().split('T')[0]
                          );
                          alert('Sync complete!');
                        } catch (e) {
                          alert('Sync failed: ' + (e as Error).message);
                        } finally {
                          if (btn) btn.innerText = 'Sync Now';
                        }
                      }}
                      id="oura-sync-btn"
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                      size="sm"
                    >
                      Sync Now
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-purple-950/20 border border-purple-500/20 rounded-lg p-4">
                    <h3 className="font-medium text-purple-200 mb-2">Why Connect Your Oura Ring?</h3>
                    <ul className="text-sm text-purple-200/80 space-y-1">
                      <li>• Recovery-based training recommendations</li>
                      <li>• Sleep quality and performance correlation</li>
                      <li>• HRV and readiness monitoring</li>
                    </ul>
                  </div>
                  <Button
                    onClick={handleConnectOura}
                    className="bg-purple-600 hover:bg-purple-700 flex items-center gap-2 text-white"
                  >
                    <Moon className="w-4 h-4" />
                    Connect Oura Ring
                  </Button>
                  <p className="text-xs text-slate-500">
                    You'll be redirected to Oura to authorize access.
                  </p>
                  <Link
                    to="/auth/oura/direct"
                    className="text-sm text-purple-400 hover:text-purple-300 underline block"
                  >
                    Having trouble? Try direct authentication
                  </Link>
                </div>
              )}
            </div>

            {/* Google Calendar */}
            <Integrations
              calendarToken={calendarToken}
              onTokenChange={setCalendarToken}
            />

            {/* Apple Watch */}
            <div className="bg-slate-900 rounded-lg border border-slate-800 p-6">
              <h2 className="text-xl font-semibold text-slate-100 mb-6 flex items-center">
                <Watch className="w-5 h-5 mr-2 text-red-500" />
                Apple Watch Health Sync
              </h2>

              <div className="space-y-6">
                <div>
                  <p className="text-slate-300 mb-3 font-medium">1. Download the Shortcut</p>
                  <p className="text-sm text-slate-400 mb-3">
                    Download the official TrainingSmart iOS Shortcut to sync health data from Apple Health.
                  </p>
                  <a
                    href="https://www.icloud.com/shortcuts/28b55a5f799d43e49d9023a9fe1c6050"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => analytics.track('shortcut_downloaded')}
                    className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Shortcut
                  </a>
                </div>

                <div className="border-t border-slate-800" />

                <div>
                  <p className="text-slate-300 mb-3 font-medium">2. Configure with your API Key</p>
                  <p className="text-sm text-slate-400 mb-3">
                    Copy your personal API Key and add it to the first "Text" field in the Shortcut setup.
                  </p>

                  <div>
                    <label htmlFor="ingest-key" className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                      Your Ingest Key
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          id="ingest-key"
                          type="text"
                          readOnly
                          value={userProfile?.ingest_key || 'Loading...'}
                          className="block w-full pl-3 pr-10 py-2 text-sm font-mono bg-slate-800 border border-slate-700 text-slate-200 rounded-md"
                        />
                        {!showKeys && (
                          <div className="absolute inset-0 bg-slate-800 border border-slate-700 rounded-md flex items-center px-3">
                            <span className="text-slate-500">••••••••-••••-••••-••••-••••••••••••</span>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => setShowKeys(!showKeys)}
                        className="p-2 text-slate-400 hover:text-slate-200 rounded-md hover:bg-slate-800 border border-slate-700"
                        title={showKeys ? 'Hide Key' : 'Show Key'}
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
                          <span className="text-green-400">Copied!</span>
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
          </div>
        )}

        {/* ── Tab 4: Advanced ── */}
        {activeTab === 'advanced' && (
          <div className="space-y-8">
            {/* Admin Dashboard — admins only */}
            {userProfile?.is_admin && (
              <div className="bg-slate-900 rounded-lg border border-slate-800 p-6">
                <AdminDashboard />
              </div>
            )}

            {/* AI Coach Personality */}
            <div className="bg-slate-900 rounded-lg border border-slate-800 p-6">
              <h2 className="text-xl font-semibold text-slate-100 mb-1 flex items-center gap-2">
                <Bot className="w-5 h-5" />
                AI Coach Personality
              </h2>
              <p className="text-slate-400 text-sm mb-4">
                Customize the system prompt that defines how your AI coach communicates and analyzes your training.
              </p>

              <div className="space-y-4">
                <div>
                  <label htmlFor="systemPrompt" className="block text-sm font-medium text-slate-400 mb-2">
                    System Prompt
                  </label>
                  <textarea
                    id="systemPrompt"
                    title="AI coach system prompt"
                    value={systemPrompt}
                    onChange={e => setSystemPrompt(e.target.value)}
                    rows={12}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent font-mono text-sm"
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={handleSavePrompt}
                    loading={savingPrompt}
                    className="flex items-center text-white bg-orange-600 hover:bg-orange-700"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {promptSaved ? 'Saved!' : 'Save Prompt'}
                  </Button>
                  <Button
                    onClick={handleResetPrompt}
                    variant="outline"
                    className="flex items-center text-slate-300 border-slate-700 hover:bg-slate-800"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Reset to Default
                  </Button>
                </div>
              </div>
            </div>

            {/* Content Interests */}
            <div className="bg-slate-900 rounded-lg border border-slate-800 p-6">
              <h2 className="text-xl font-semibold text-slate-100 mb-1 flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Content Interests
              </h2>
              <p className="text-slate-400 text-sm mb-5">
                Personalize your content feed by selecting topics you care about.
              </p>

              <div className="flex flex-wrap gap-2 mb-5">
                {AVAILABLE_INTERESTS.map(interest => (
                  <button
                    key={interest}
                    type="button"
                    onClick={() => toggleInterest(interest)}
                    className={`px-3 py-2 rounded-full text-sm transition-colors ${
                      interests.includes(interest)
                        ? 'bg-orange-600 text-white hover:bg-orange-700'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {interest}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500 mb-4">{interests.length} selected</p>

              <div className="flex items-center gap-3">
                <Button
                  onClick={handleSaveInterests}
                  loading={savingInterests}
                  className="flex items-center text-white bg-orange-600 hover:bg-orange-700"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {interestsSaved ? 'Saved!' : 'Save Interests'}
                </Button>
                {interestsSaved && <span className="text-green-400 text-sm">Saved!</span>}
              </div>
            </div>

            {/* Example Coaching Styles — collapsible */}
            <div className="bg-slate-900 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => setExamplesOpen(!examplesOpen)}
                className="w-full flex items-center justify-between px-6 py-4 text-left"
              >
                <span className="text-slate-200 font-medium">Example Coaching Styles</span>
                {examplesOpen ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {examplesOpen && (
                <div className="px-6 pb-6 space-y-4 border-t border-slate-800 pt-4">
                  <p className="text-xs text-slate-500">Click "Use this style" to load a preset into the system prompt editor above.</p>

                  <div className="border border-slate-800 bg-slate-800/20 rounded-md p-4">
                    <h4 className="font-medium text-slate-200 mb-1">Motivational Coach</h4>
                    <p className="text-sm text-slate-400 mb-2">Encouraging, positive, focuses on progress and achievements.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setSystemPrompt(`You are an enthusiastic and motivational personal training coach. You celebrate every achievement, no matter how small, and always focus on progress and positive reinforcement. You use encouraging language and help athletes see their potential. Base all advice on their actual Strava training data while maintaining an upbeat, supportive tone.\n\nEXERCISE VIDEO GUIDELINES:\n- Always include YouTube links for exercises and techniques from top creators\n- Format: **Exercise**: [Video Title](https://youtube.com/watch?v=ID) by Creator\n- Recommend GCN, TrainerRoad, Dylan Johnson, and other top cycling channels\n- Include motivational fitness creators like Athlean-X and Yoga with Adriene`);
                        setActiveTab('advanced');
                      }}
                      className="text-xs text-orange-400 hover:text-orange-300 underline"
                    >
                      Use this style
                    </button>
                  </div>

                  <div className="border border-slate-800 bg-slate-800/20 rounded-md p-4">
                    <h4 className="font-medium text-slate-200 mb-1">Data-Driven Analyst</h4>
                    <p className="text-sm text-slate-400 mb-2">Technical, analytical, focuses on metrics and performance optimization.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setSystemPrompt(`You are a highly analytical sports scientist and coach who focuses on data-driven training optimization. You provide detailed analysis of training metrics, identify patterns in performance data, and give precise, evidence-based recommendations. You reference specific numbers from their Strava activities and explain the science behind your advice.\n\nEXERCISE VIDEO GUIDELINES:\n- Include YouTube links to technical training videos from science-based creators\n- Prioritize Dylan Johnson, TrainerRoad, and GCN's technical content\n- Format: **Technique**: [Video Title](https://youtube.com/watch?v=ID) by Creator\n- Focus on evidence-based training methods and performance optimization videos`);
                        setActiveTab('advanced');
                      }}
                      className="text-xs text-orange-400 hover:text-orange-300 underline"
                    >
                      Use this style
                    </button>
                  </div>

                  <div className="border border-slate-800 bg-slate-800/20 rounded-md p-4">
                    <h4 className="font-medium text-slate-200 mb-1">Holistic Wellness Coach</h4>
                    <p className="text-sm text-slate-400 mb-2">Balanced approach, emphasizes recovery, mental health, and sustainable training.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setSystemPrompt(`You are a holistic wellness coach who emphasizes the importance of balance, recovery, and mental well-being alongside physical training. You consider the whole person — not just their workout data — and provide advice that promotes sustainable, long-term health and fitness. You encourage rest when needed and help prevent burnout.\n\nEXERCISE VIDEO GUIDELINES:\n- Include YouTube links for recovery, stretching, and wellness content\n- Prioritize Yoga with Adriene, Peter Attia MD, and GCN's recovery videos\n- Format: **Practice**: [Video Title](https://youtube.com/watch?v=ID) by Creator\n- Focus on sustainable training, recovery techniques, and mental wellness`);
                        setActiveTab('advanced');
                      }}
                      className="text-xs text-orange-400 hover:text-orange-300 underline"
                    >
                      Use this style
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
