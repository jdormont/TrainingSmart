import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Send, Bot, User, Loader2, Menu, X, Calendar, Activity, Heart, Battery, Zap, TrendingUp, HelpCircle, Map, Coffee, Wind, Wrench } from 'lucide-react';
import { stravaApi } from '../services/stravaApi';
import { ouraApi } from '../services/ouraApi';
import { openaiService } from '../services/openaiApi';
import { supabaseChatService } from '../services/supabaseChatService';
import { chatContextExtractor } from '../services/chatContextExtractor';
import { userProfileService } from '../services/userProfileService';
import { dailyMetricsService } from '../services/dailyMetricsService';
import { convertMarkdownToHtml } from '../utils/markdownToHtml';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Button } from '../components/common/Button';
import SessionSidebar from '../components/chat/SessionSidebar';
import { ChatContextModal } from '../components/chat/ChatContextModal';
import { NetworkErrorBanner } from '../components/common/NetworkErrorBanner';
import type { StravaActivity, StravaAthlete, StravaStats, ChatMessage, ChatSession, OuraSleepData, OuraReadinessData, ChatContextSnapshot, DailyMetric } from '../types';
import { calculateWeeklyStats } from '../utils/dataProcessing';
import { calculateSleepScore } from '../utils/sleepScoreCalculator';
import { format } from 'date-fns';
import { analytics } from '../lib/analytics';
import { streakService, UserStreak } from '../services/streakService';
import { supabase } from '../services/supabaseClient';

export const ChatPage: React.FC = () => {
  const location = useLocation();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [showPlanModal, setShowPlanModal] = useState(false);
  const [extractedContext, setExtractedContext] = useState<ChatContextSnapshot | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [showPlanButton, setShowPlanButton] = useState(false);

  // Strava data
  const [athlete, setAthlete] = useState<StravaAthlete | null>(null);
  const [activities, setActivities] = useState<StravaActivity[]>([]);
  const [stats, setStats] = useState<StravaStats | null>(null);

  // Oura recovery data
  const [sleepData, setSleepData] = useState<OuraSleepData | null>(null);
  const [readinessData, setReadinessData] = useState<OuraReadinessData | null>(null);

  // Daily Metric data (HealthKit/Manual)
  const [dailyMetric, setDailyMetric] = useState<DailyMetric | null>(null);

  // Streak data
  const [streak, setStreak] = useState<UserStreak | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Handle deep linking for actions (e.g. from Weekly Insight)
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const initialMsg = searchParams.get('initialMessage');
    if (initialMsg) {
      setInputMessage(initialMsg);
    }
  }, [location.search]);

  // Load Strava data and sessions on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setDataLoading(true);
        const [athleteData, activitiesData] = await Promise.all([
          stravaApi.getAthlete(),
          stravaApi.getActivities(1, 30)
        ]);

        setAthlete(athleteData);
        setActivities(activitiesData);

        // Try to get stats
        try {
          const statsData = await stravaApi.getAthleteStats(athleteData.id);
          setStats(statsData);
        } catch (statsError) {
          console.warn('Could not load athlete stats:', statsError);
        }

        // Load Oura recovery data if available
        if (await ouraApi.isAuthenticated()) {
          try {
            console.log('Loading Oura recovery data for AI coach...');
            const [recentSleep, recentReadiness] = await Promise.all([
              ouraApi.getRecentSleepData(),
              ouraApi.getRecentReadinessData()
            ]);

            if (recentSleep.length > 0) {
              const latestSleep = recentSleep[recentSleep.length - 1];
              setSleepData(latestSleep);
              console.log('Sleep data loaded for AI coach:', latestSleep);
            }

            if (recentReadiness.length > 0) {
              const latestReadiness = recentReadiness[recentReadiness.length - 1];
              setReadinessData(latestReadiness);
              console.log('Readiness data loaded for AI coach:', latestReadiness);
            }
          } catch (ouraError) {
            console.warn('Could not load Oura data for AI coach:', ouraError);
          }
        }

        // Load Daily Metrics (HealthKit/Manual)
        try {
          const latestMetric = await dailyMetricsService.getMostRecentMetric();
          if (latestMetric) {
            setDailyMetric(latestMetric);
            console.log('Daily metric loaded for AI coach:', latestMetric);
          }
        } catch (metricError) {
          console.warn('Could not load daily metrics:', metricError);
        }

        // Load Streak Data
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const streakData = await streakService.getStreak(user.id);
            setStreak(streakData);
          }
        } catch (streakError) {
          console.warn('Could not load streak data:', streakError);
        }

        // Load chat sessions
        const savedSessions = await supabaseChatService.getSessions();
        setSessions(savedSessions);

        // Load active session or create default
        const state = location.state as { activeSessionId?: string } | null;
        const activeSessionId = state?.activeSessionId || supabaseChatService.getActiveSessionId();
        let currentSession = activeSessionId ?
          savedSessions.find(s => s.id === activeSessionId) : null;

        if (!currentSession && savedSessions.length === 0) {
          // Create default session
          currentSession = await supabaseChatService.createSession(
            'General Training Chat',
            'training',
            'General discussion about your cycling training'
          );
          setSessions([currentSession]);
        } else if (!currentSession && savedSessions.length > 0) {
          // Use most recent session
          currentSession = savedSessions.sort((a, b) =>
            b.updatedAt.getTime() - a.updatedAt.getTime()
          )[0];
          supabaseChatService.setActiveSession(currentSession.id);
        }

        setActiveSession(currentSession || null);

        // Add welcome message if session is empty
        if (currentSession && currentSession.messages.length === 0) {
          let welcomeContent = '';

          if (currentSession.category === 'content_preferences') {
            welcomeContent = `Hi ${athleteData.firstname}! 📺 I'm here to help personalize your content recommendations. 

I'd love to learn about what kind of cycling content interests you most. This will help me curate better videos, articles, and resources for your home feed.

Let me ask you a few questions:

**What type of cycling content do you enjoy most?**
- Training videos and structured workouts
- Bike reviews and gear comparisons  
- Race coverage and pro cycling
- Maintenance and repair tutorials
- Technique and form improvement
- Nutrition and recovery advice
- Motivational stories and journeys

**What's your current focus or goal?**
- Learning new skills and techniques
- Preparing for a specific event or race
- Improving fitness and performance
- Understanding bike maintenance
- Staying motivated and inspired

Feel free to tell me about any specific topics, creators, or types of content you'd like to see more of!`;
          } else {
            welcomeContent = `Hi ${athleteData.firstname}! 👋 I'm your AI cycling coach. I've analyzed your recent Strava activities and I'm ready to help with your training. 

I can see you've completed ${activitiesData.length} recent activities. Feel free to ask me about:
• Training advice based on your recent rides
• Recovery recommendations
• Goal setting and planning
• Workout analysis
• Power training and FTP improvement
• Or anything else cycling-related!

What would you like to know about your training?`;
          }

          const welcomeMessage: ChatMessage = {
            id: Date.now().toString(),
            role: 'assistant',
            content: welcomeContent,
            timestamp: new Date()
          };

          supabaseChatService.addMessageToSession(currentSession.id, welcomeMessage);
          setActiveSession({
            ...currentSession,
            messages: [welcomeMessage],
            updatedAt: new Date()
          });
        }

      } catch (err) {
        console.error('Failed to load data:', err);
        setError('Failed to load your training data. Please refresh the page.');
      } finally {
        setDataLoading(false);
      }
    };

    loadData();
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages]);

  // Check if chat has planning intent
  useEffect(() => {
    const checkPlanningIntent = async () => {
      if (!activeSession || activeSession.messages.length < 3) {
        setShowPlanButton(false);
        return;
      }

      const hasPlanningIntent = await chatContextExtractor.detectPlanningIntent(
        activeSession.messages
      );
      setShowPlanButton(hasPlanningIntent);
    };

    checkPlanningIntent();
  }, [activeSession?.messages]);

  const handleExtractContext = async () => {
    if (!activeSession || !athlete) return;

    setExtracting(true);
    setError(null);

    try {
      const result = await chatContextExtractor.extractContext(activeSession.messages);

      if (!result.isGoalOriented) {
        setError('This conversation does not contain enough planning information. Try discussing your training goals first.');
        return;
      }

      setExtractedContext(result.context);
      setShowPlanModal(true);
    } catch (err) {
      console.error('Context extraction error:', err);
      setError((err as Error).message || 'Failed to extract planning context from conversation');
    } finally {
      setExtracting(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || loading || !athlete || !activeSession) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    };

    // Add message to current session
    supabaseChatService.addMessageToSession(activeSession.id, userMessage);

    // Track message sent
    analytics.track('chat_message_sent', { category: activeSession.category });

    setInputMessage('');
    setLoading(true);
    setError(null);

    try {
      // Build training context
      const weeklyStats = calculateWeeklyStats(activities);

      // Calculate sleep score if we have sleep data
      const sleepScore = sleepData ? calculateSleepScore(sleepData).totalScore : undefined;

      // Get user profile for personalized coaching
      let userProfile;
      try {
        userProfile = await userProfileService.getUserProfile();
      } catch (profileError) {
        console.warn('Could not load user profile:', profileError);
      }

      const trainingContext = {
        athlete,
        recentActivities: activities,
        stats: stats || undefined,
        weeklyVolume: {
          distance: weeklyStats.totalDistance,
          time: weeklyStats.totalTime,
          activities: weeklyStats.activityCount
        },
        recovery: {
          sleepData,
          readinessData,
          dailyMetric,
          sleepScore
        },
        streak: streak,
        userProfile: userProfile ? {
          training_goal: userProfile.training_goal,
          coach_persona: userProfile.coach_persona,
          weekly_hours: userProfile.weekly_hours
        } : undefined
      };

      const response = await openaiService.getChatResponse(
        [...activeSession.messages, userMessage],
        trainingContext
      );

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date()
      };

      // Add assistant response to session
      supabaseChatService.addMessageToSession(activeSession.id, assistantMessage);

      // Update sessions list
      const updatedSessions = await supabaseChatService.getSessions();
      setSessions(updatedSessions);

      // Refresh active session from storage to get latest messages
      const updatedSession = await supabaseChatService.getSession(activeSession.id);
      if (updatedSession) {
        setActiveSession(updatedSession);
      }
    } catch (err) {
      console.error('Chat error:', err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSessionSelect = async (sessionId: string) => {
    const session = await supabaseChatService.getSession(sessionId);
    if (session) {
      setActiveSession(session);
      supabaseChatService.setActiveSession(sessionId);
    }
  };

  const handleSessionCreate = async (name: string, category: ChatSession['category'], description?: string) => {
    const newSession = await supabaseChatService.createSession(name, category, description);

    // Track session creation
    analytics.track('chat_session_created', { category });

    const updatedSessions = await supabaseChatService.getSessions();
    setSessions(updatedSessions);
    setActiveSession(newSession);
  };

  const handleSessionDelete = async (sessionId: string) => {
    await supabaseChatService.deleteSession(sessionId);
    const updatedSessions = await supabaseChatService.getSessions();
    setSessions(updatedSessions);

    // If we deleted the active session, switch to another or create new
    if (activeSession?.id === sessionId) {
      const remainingSessions = await supabaseChatService.getSessions();
      if (remainingSessions.length > 0) {
        const newActive = remainingSessions[0];
        setActiveSession(newActive);
        supabaseChatService.setActiveSession(newActive.id);
      } else {
        setActiveSession(null);
        supabaseChatService.clearActiveSession();
      }
    }
  };

  const handleSessionRename = async (sessionId: string, newName: string) => {
    await supabaseChatService.updateSession(sessionId, { name: newName });
    const updatedSessions = await supabaseChatService.getSessions();
    setSessions(updatedSessions);

    // Update active session if it's the one being renamed
    if (activeSession?.id === sessionId) {
      setActiveSession(prev => prev ? { ...prev, name: newName } : null);
    }
  };

  const SUGGESTIONS_MAP: Record<string, Array<{ label: string; icon: React.ComponentType<{ className?: string }> }>> = {
    training: [
      { label: "Analyze my last week", icon: Activity },
      { label: "Build a plan for next week", icon: Calendar },
      { label: "Critique my interval pacing", icon: Zap },
      { label: "Create a hill climbing workout", icon: TrendingUp }
    ],
    recovery: [
      { label: "My legs feel heavy today", icon: Battery },
      { label: "Should I rest or ride easy?", icon: HelpCircle },
      { label: "Suggest a 15min stretch routine", icon: User },
      { label: "Why is my heart rate variable?", icon: Heart }
    ],
    strategy: [
      { label: "Pacing strategy for a Century", icon: Map },
      { label: "Nutrition plan for 3hr ride", icon: Coffee },
      { label: "How to handle crosswinds", icon: Wind },
      { label: "Equipment check for race day", icon: Wrench }
    ]
  };

  const getCurrentSuggestions = () => {
    const category = activeSession?.category || 'training';
    return SUGGESTIONS_MAP[category] || SUGGESTIONS_MAP.training;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  const handleSuggestedQuestion = async (question: string) => {
    if (!athlete || !activeSession) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: question,
      timestamp: new Date()
    };

    supabaseChatService.addMessageToSession(activeSession.id, userMessage);

    setLoading(true);
    setError(null);

    try {
      const weeklyStats = calculateWeeklyStats(activities);
      const sleepScore = sleepData ? calculateSleepScore(sleepData).totalScore : undefined;

      const trainingContext = {
        athlete,
        recentActivities: activities,
        stats: stats || undefined,
        weeklyVolume: {
          distance: weeklyStats.totalDistance,
          time: weeklyStats.totalTime,
          activities: weeklyStats.activityCount
        },
        recovery: {
          sleepData,
          readinessData,
          dailyMetric,
          sleepScore
        }
      };

      const response = await openaiService.getChatResponse(
        [...activeSession.messages, userMessage],
        trainingContext
      );

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date()
      };

      supabaseChatService.addMessageToSession(activeSession.id, assistantMessage);

      const updatedSessions = await supabaseChatService.getSessions();
      setSessions(updatedSessions);

      const updatedSession = await supabaseChatService.getSession(activeSession.id);
      if (updatedSession) {
        setActiveSession(updatedSession);
      }
    } catch (err) {
      console.error('Chat error:', err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (dataLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" className="text-blue-500 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Loading Your Training Data
          </h2>
          <p className="text-gray-600">
            Preparing your AI coach with your Strava activities...
          </p>
        </div>
      </div>
    );
  }

  if (error && !athlete) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
          <div className="text-center">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Unable to Load Training Data
            </h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-950 flex flex-col overflow-hidden">
      <NetworkErrorBanner />
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block flex-shrink-0">
          <SessionSidebar
            sessions={sessions}
            activeSessionId={activeSession?.id || null}
            onSessionSelect={handleSessionSelect}
            onSessionCreate={handleSessionCreate}
            onSessionDelete={handleSessionDelete}
            onSessionRename={handleSessionRename}
          />
        </div>

        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/50 transition-opacity"
              onClick={() => setSidebarOpen(false)}
            />

            {/* Sidebar content */}
            <div className="relative flex-1 flex flex-col max-w-xs w-full bg-slate-900 transform transition-transform duration-300 ease-in-out">
              <SessionSidebar
                sessions={sessions}
                activeSessionId={activeSession?.id || null}
                onSessionSelect={handleSessionSelect}
                onSessionCreate={handleSessionCreate}
                onSessionDelete={handleSessionDelete}
                onSessionRename={handleSessionRename}
                onClose={() => setSidebarOpen(false)}
              />
            </div>
          </div>
        )}

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 p-4 flex-shrink-0">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center space-x-3 w-full md:w-auto">
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="lg:hidden p-2 text-slate-400 hover:text-slate-200"
                >
                  {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>

                <div className="min-w-0 flex-1">
                  <h1 className="text-lg md:text-xl font-semibold text-slate-100 truncate capitalize">
                    {activeSession?.name || 'AI Training Coach'}
                  </h1>
                  {activeSession?.description && (
                    <p className="text-xs md:text-sm text-slate-400 truncate">{activeSession.description}</p>
                  )}
                </div>
              </div>

              {activeSession && (
                <div className="flex items-center justify-between md:justify-end space-x-2 w-full md:w-auto pt-2 md:pt-0 border-t md:border-t-0 border-slate-700/50">
                  {showPlanButton && (
                    <button
                      onClick={handleExtractContext}
                      disabled={extracting}
                      className="flex items-center space-x-1 px-3 py-1.5 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      <Calendar className="w-4 h-4" />
                      <span>{extracting ? 'Extracting...' : 'Create Plan'}</span>
                    </button>
                  )}
                  <div className="flex items-center space-x-2">
                    <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${supabaseChatService.getCategoryColor(activeSession.category)}`}>
                      {supabaseChatService.getCategoryIcon(activeSession.category)} {activeSession.category}
                    </span>
                    <span className="text-xs text-slate-500 whitespace-nowrap">
                      {activeSession.messages.length} msgs
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Training Summary */}
          {athlete && activities.length > 0 && (
            <div className="bg-slate-900/40 border-b border-slate-800 p-4 flex-shrink-0">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">Recent:</span>
                  <span className="font-medium ml-1 text-slate-300">{activities.length}</span>
                </div>
                <div>
                  <span className="text-slate-500">Distance:</span>
                  <span className="font-medium ml-1 text-slate-300">
                    {(calculateWeeklyStats(activities).totalDistance * 0.000621371).toFixed(1)} mi
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Last Activity:</span>
                  <span className="font-medium ml-1 text-slate-300">
                    {activities[0]?.start_date_local ? format(new Date(activities[0].start_date_local), 'MMM d, yyyy') : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Primary Sport:</span>
                  <span className="font-medium ml-1 text-slate-300">
                    {activities[0]?.type || 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
            {!activeSession ? (
              <div className="text-center text-slate-500 mt-20">
                <Bot className="w-12 h-12 mx-auto mb-4 text-slate-600" />
                <p>Select a chat session or create a new one to start chatting</p>
              </div>
            ) : (
              <>
                {activeSession.messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`flex items-start space-x-2 max-w-[80%] ${message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                        }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center border ${message.role === 'user'
                          ? 'bg-orange-500/10 border-orange-500/20 text-orange-500'
                          : 'bg-slate-800 border-slate-700 text-slate-400'
                          }`}
                      >
                        {message.role === 'user' ? (
                          <User className="w-4 h-4" />
                        ) : (
                          <Bot className="w-4 h-4" />
                        )}
                      </div>
                      <div
                        className={`rounded-2xl px-5 py-3 backdrop-blur-sm border ${message.role === 'user'
                          ? 'bg-orange-900/40 border-orange-500/30 text-orange-100'
                          : 'bg-slate-800/60 border-slate-700/60 text-slate-200'
                          }`}
                      >
                        {message.role === 'user' ? (
                          <p className="whitespace-pre-wrap">{message.content}</p>
                        ) : (
                          <div
                            className="prose prose-sm max-w-none 
                              text-slate-200
                              prose-headings:text-slate-100 
                              prose-p:text-slate-200 
                              prose-strong:text-white 
                              prose-li:text-slate-200
                              prose-ul:text-slate-200
                              prose-ol:text-slate-200
                              prose-code:text-orange-200 prose-code:bg-slate-900/80 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
                              [&_*]:text-slate-200
                              [&_strong]:text-white
                              [&_h1]:text-slate-100 [&_h2]:text-slate-100 [&_h3]:text-slate-100
                              [&>table]:w-full [&>table]:border-collapse [&>table]:border [&>table]:border-slate-700 [&>table]:my-4
                              [&>thead]:bg-slate-800 [&>thead]:text-slate-200 
                              [&>thead>tr>th]:border-b [&>thead>tr>th]:border-slate-700 [&>thead>tr>th]:p-3 [&>thead>tr>th]:text-left
                              [&>tbody>tr]:border-b [&>tbody>tr]:border-slate-800 [&>tbody>tr:last-child]:border-0
                              [&>tbody>tr:nth-child(odd)]:bg-slate-900/50 [&>tbody>tr:nth-child(even)]:bg-slate-900/30
                              [&>tbody>tr>td]:p-3 [&>tbody>tr>td]:text-slate-200"
                            dangerouslySetInnerHTML={{
                              __html: convertMarkdownToHtml(message.content)
                            }}
                          />
                        )}
                        <p
                          className={`text-xs mt-2 ${message.role === 'user' ? 'text-orange-200/60' : 'text-slate-500'
                            }`}
                        >
                          {message.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex justify-start">
                    <div className="flex items-start space-x-2">
                      <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                        <Bot className="w-4 h-4 text-slate-400" />
                      </div>
                      <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl px-5 py-3">
                        <div className="flex items-center space-x-2">
                          <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                          <span className="text-slate-400">Thinking...</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Start Suggestions */}
          {activeSession && activeSession.messages.length === 0 && !loading && (
            <div className="border-t border-slate-800 p-6 bg-slate-900/50 flex-shrink-0">
              <div className="max-w-3xl mx-auto">
                <div className="text-center mb-6">
                  <h3 className="text-lg font-semibold text-slate-200 mb-2">Quick Start</h3>
                  <p className="text-sm text-slate-400">Get started with one of these suggestions</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {getCurrentSuggestions().map((suggestion) => {
                    const Icon = suggestion.icon;
                    return (
                      <button
                        key={suggestion.label}
                        onClick={() => handleSuggestedQuestion(suggestion.label)}
                        className="group flex items-center space-x-3 p-4 bg-slate-800 border-2 border-slate-700 rounded-lg hover:border-orange-500/50 hover:bg-slate-800/80 transition-all text-left"
                      >
                        <div className="flex-shrink-0 w-10 h-10 bg-slate-700 group-hover:bg-slate-700/80 rounded-lg flex items-center justify-center transition-colors">
                          <Icon className="w-5 h-5 text-orange-500" />
                        </div>
                        <span className="text-sm font-medium text-slate-300 group-hover:text-slate-100">
                          {suggestion.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Floating Input Capsule */}
          <div className="p-4 pb-8 bg-transparent flex-shrink-0">
            <div className="max-w-4xl mx-auto">
              {error && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-md p-2 mb-3">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <form onSubmit={handleSendMessage} className="relative">
                <textarea
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={activeSession ? "Ask about your training..." : "Select a session to start chatting..."}
                  className="w-full px-5 py-4 pr-14 bg-slate-800 backdrop-blur-xl border border-slate-700 text-white rounded-2xl shadow-2xl shadow-black/50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent placeholder-slate-400 resize-none"
                  rows={1}
                  disabled={loading || !activeSession}
                  style={{
                    height: 'auto',
                    minHeight: '60px',
                    maxHeight: '128px',
                    overflowY: inputMessage.split('\n').length > 3 ? 'scroll' : 'hidden'
                  }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = Math.min(target.scrollHeight, 128) + 'px';
                  }}
                />
                <Button
                  type="submit"
                  disabled={!inputMessage.trim() || loading || !activeSession}
                  className="absolute right-2 bottom-2 p-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-white disabled:bg-slate-700 disabled:text-slate-500 h-10 w-10 flex items-center justify-center transition-colors"
                >
                  <Send className="w-5 h-5" />
                </Button>
              </form>
              <p className="text-xs text-slate-600 mt-2 text-center opacity-60">
                Insights derived in part from Garmin & Strava data. Press Enter to send.
              </p>
            </div>
          </div>
        </div>

        {extractedContext && activeSession && athlete && stats && (
          <ChatContextModal
            isOpen={showPlanModal}
            onClose={() => {
              setShowPlanModal(false);
              setExtractedContext(null);
            }}
            context={extractedContext}
            sessionId={activeSession.id}
            sessionName={activeSession.name}
            athlete={athlete}
            recentActivities={activities}
            stats={stats}
          />
        )}
      </div>
    </div>
  );
};