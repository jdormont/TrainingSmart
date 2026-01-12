
import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Send, Bot, User, Loader2, Menu, X, Calendar, Activity, Heart, Battery, Zap, TrendingUp, HelpCircle, Map, Coffee, Wind, Wrench } from 'lucide-react';
import { openaiService } from '../services/openaiApi';
import { supabaseChatService } from '../services/supabaseChatService';
import { chatContextExtractor } from '../services/chatContextExtractor';
import { userProfileService } from '../services/userProfileService';
import { convertMarkdownToHtml } from '../utils/markdownToHtml';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import SessionSidebar from '../components/chat/SessionSidebar';
import { NetworkErrorBanner } from '../components/common/NetworkErrorBanner';
import { ChatContextModal } from '../components/chat/ChatContextModal';
import type { ChatMessage, ChatContextSnapshot } from '../types';
import { calculateWeeklyStats } from '../utils/dataProcessing';
import { calculateSleepScore } from '../utils/sleepScoreCalculator';
import { format } from 'date-fns';
import { analytics } from '../lib/analytics';
import { useChatSessions } from '../hooks/useChatSessions';
import { useDashboardData } from '../hooks/useDashboardData';
import { useQueryClient } from '@tanstack/react-query';
import { ChatSession } from '../types';

export const ChatPage: React.FC = () => {
  const location = useLocation();
  const queryClient = useQueryClient();
  
  // Data Hooks
  const { 
    data: sessions = [], 
    isLoading: sessionsLoading 
  } = useChatSessions();
  
  const {
    data: dashboardData,
    isLoading: dashboardLoading,
  } = useDashboardData();

  const {
    athlete,
    activities: recentActivities,
    weeklyStats: weeklyStatsRaw,
    sleepData: sleepDataRaw,
    readinessData: readinessDataRaw,
    userStreak: streak, // healthMetrics removed
    currentUserId
  } = dashboardData || {};

  // Derived state
  const activities = recentActivities || [];
  const sleepData = sleepDataRaw || null;
  const readinessData = readinessDataRaw || null;
  const weeklyStats = weeklyStatsRaw || null;

  // dailyMetrics is at the root of dashboardData
  const dailyMetricsRaw = dashboardData?.dailyMetrics || [];
  const dailyMetric = dailyMetricsRaw[0] || null;
  // dailyMetricDerived removed
  
  const isLoading = sessionsLoading || dashboardLoading;

  // Local UI state
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [inputMessage, setInputMessage] = useState('');
  const [loadingResponse, setLoadingResponse] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [showPlanModal, setShowPlanModal] = useState(false);
  const [extractedContext, setExtractedContext] = useState<ChatContextSnapshot | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [showPlanButton, setShowPlanButton] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Handle deep linking
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const initialMsg = searchParams.get('initialMessage');
    if (initialMsg) {
      setInputMessage(initialMsg);
    }
  }, [location.search]);

  // Handle Session Selection / Creation Logic
  // Handle Session Selection / Creation Logic
  useEffect(() => {
    if (sessionsLoading) return;

    const initializeSession = async () => {
      // 1. Determine target session ID from navigation state or service
      const targetSessionId = location.state?.sessionId || supabaseChatService.getActiveSessionId();
      
      // 2. Find it in loaded sessions
      let currentSession = targetSessionId 
          ? sessions.find(s => s.id === targetSessionId)
          : null;

      // 3. If no specific target, default to most recent if available
      if (!currentSession && sessions.length > 0) {
           currentSession = sessions[0];
      }
      
      // 4. If absolutely no sessions exist (and not demo), create a default one
      // Only do this once to avoid loops - check if we already have one
      if (!currentSession && sessions.length === 0 && currentUserId !== 'demo') {
           // We'll let the UI show the "Select a session" empty state instead of auto-creating
           // to prevent async loops or race conditions during render.
           // However, if we MUST auto-create, do it carefully.
           // For now, let's just stabilize by NOT auto-creating here, or doing it only if strictly needed.
      }

      // 5. Update state only if changed
      if (currentSession) {
          if (activeSession?.id !== currentSession.id) {
              setActiveSession(currentSession);
              supabaseChatService.setActiveSession(currentSession.id);
          } else if (JSON.stringify(activeSession) !== JSON.stringify(currentSession)) {
             // Deep comparison to update if content changed (e.g. messages added)
             setActiveSession(currentSession);
          }
      } else if (currentUserId === 'demo' && !activeSession) {
          // Demo setup
           setActiveSession({
              id: 'demo-session',
              user_id: 'demo',
              name: 'Demo Chat',
              category: 'training',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              messages: []
          } as any);
      }
    };

    initializeSession();
  }, [sessions, sessionsLoading, currentUserId, location.state?.sessionId]); // Removed full location.state, just sessionId

  // Welcome message logic
  useEffect(() => {
      if (activeSession && activeSession.messages.length === 0 && athlete) {
         // ... (Logic to add welcome message if empty)
         // Refactor to use external function or keep inline?
         // Keeping logic similar to original but adapting to new data sources
         
         const addWelcome = async () => {
             // ... welcome message generation ...
             // Need to be careful not to loop.
             // Original logic put it in data loading useEffect.
             // We can do it here.
             
             let welcomeContent = '';
             if (activeSession.category === 'content_preferences') {
                 welcomeContent = `Hi ${athlete.firstname}! I see you're interested in updating your content preferences. What topics would you like to focus on for your cycling training?`;
             } else {
                 welcomeContent = `Hi ${athlete.firstname}! 👋 I'm your AI cycling coach. I've analyzed your recent training data. How can I help you today?`;
             }
             
             // Check if we already have it locally to avoid loop? 
             // activeSession.messages length is 0 check protects us.
             
             const welcomeMessage: ChatMessage = {
                id: Date.now().toString(),
                role: 'assistant',
                content: welcomeContent, // We need full strings or helper
                timestamp: new Date()
             };
             
             // If demo, just set state
             if (currentUserId === 'demo') {
                 setActiveSession(prev => prev ? { ...prev, messages: [welcomeMessage] } : null);
             } else {
                 await supabaseChatService.addMessageToSession(activeSession.id, welcomeMessage);
                 // Invalidate to refresh
                 queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
                 // Update local immediately for standard UI
                  setActiveSession(prev => prev ? { 
                     ...prev, 
                     messages: [welcomeMessage],
                     updatedAt: new Date()
                  } : null);
             }
         };
         
      // Only run if real session or handled demo
         // Add a small delay/debounce or check if we are already sending? 
         // Actually, relying on the hook update is safer now that we fetch messages.
         // But let's verify we don't have a pending local addition.
         addWelcome();
      }
  }, [activeSession?.id, activeSession?.messages?.length, athlete, currentUserId]); 


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
    if (!inputMessage.trim() || loadingResponse || !athlete || !activeSession) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    };

    // Add message/Track local
    if (currentUserId !== 'demo') {
        supabaseChatService.addMessageToSession(activeSession.id, userMessage);
        analytics.track('chat_message_sent', { category: activeSession.category });
    }

    // Optimistic update
    // const previousSession = activeSession;
    setActiveSession(prev => prev ? { ...prev, messages: [...prev.messages, userMessage] } : null);

    setInputMessage('');
    setLoadingResponse(true);
    setError(null);

    try {
      // Build training context
      // dashboardData.weeklyStats is already computed by hook, use it.
      const safeWeeklyStats = weeklyStats || calculateWeeklyStats(activities || []);

      const sleepScore = sleepData ? calculateSleepScore(sleepData).totalScore : undefined;

      let userProfile;
      try {
        userProfile = await userProfileService.getUserProfile();
      } catch (error) {
         // Ignore profile fetch error
         console.warn('Failed to fetch profile for chat context', error);
      }

      const trainingContext = {
        athlete,
        recentActivities: activities,
        stats: undefined, 
        weeklyVolume: {
          distance: safeWeeklyStats.totalDistance,
          time: safeWeeklyStats.totalTime,
          activities: safeWeeklyStats.activityCount
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

      if (currentUserId !== 'demo') {
          await supabaseChatService.addMessageToSession(activeSession.id, assistantMessage);
          // Invalidate
          queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
      }

      // Update local
      setActiveSession(prev => prev ? { 
          ...prev, 
          messages: [...prev.messages, assistantMessage],
          updatedAt: new Date()
      } : null);

    } catch (err) {
      console.error('Chat error:', err);
      setError((err as Error).message);
      // Revert if needed?
    } finally {
      setLoadingResponse(false);
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
    if (currentUserId === 'demo') return; // No create in demo

    const newSession = await supabaseChatService.createSession(name, category, description);

    analytics.track('chat_session_created', { category });

    queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
    setActiveSession(newSession);
  };

  const handleSessionDelete = async (sessionId: string) => {
    if (currentUserId === 'demo') return;

    await supabaseChatService.deleteSession(sessionId);
    queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });

    // If we deleted the active session, switch to another or create new
    if (activeSession?.id === sessionId) {
      // Logic handled by useEffect mostly, but for instant UI:
      const remainingSessions = sessions.filter(s => s.id !== sessionId);
      if (remainingSessions.length > 0) {
          // Switch to next
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
    if (currentUserId === 'demo') return;

    await supabaseChatService.updateSession(sessionId, { name: newName });
    queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });

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

    // Add to session
    if (currentUserId !== 'demo') {
        supabaseChatService.addMessageToSession(activeSession.id, userMessage);
    }
    
    // Opt UI
    setActiveSession(prev => prev ? { ...prev, messages: [...prev.messages, userMessage] } : null);

    setLoadingResponse(true);
    setError(null);

    try {
      const sleepScore = sleepData ? calculateSleepScore(sleepData).totalScore : undefined;

      const trainingContext = {
        athlete,
        recentActivities: activities,
        stats: undefined,
        weeklyVolume: {
          distance: weeklyStats?.totalDistance || 0,
          time: weeklyStats?.totalTime || 0,
          activities: weeklyStats?.activityCount || 0
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

      if (currentUserId !== 'demo') {
          await supabaseChatService.addMessageToSession(activeSession.id, assistantMessage);
          queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
      }

      setActiveSession(prev => prev ? { 
          ...prev, 
          messages: [...prev.messages, assistantMessage],
          updatedAt: new Date()
      } : null);

    } catch (err) {
      console.error('Chat error:', err);
      setError((err as Error).message);
    } finally {
      setLoadingResponse(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" className="text-blue-500 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Loading Your Training Data
          </h2>
          <p className="text-gray-600">
            Preparing your AI coach...
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
    <div className="h-[calc(100vh-4rem)] bg-slate-950 flex flex-col overflow-hidden">
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
                    {((weeklyStats || calculateWeeklyStats(activities)).totalDistance * 0.000621371).toFixed(1)} mi
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

                {loadingResponse && (
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
          {activeSession && activeSession.messages.length === 0 && !loadingResponse && (
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
                  disabled={loadingResponse || !activeSession}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = Math.min(target.scrollHeight, 128) + 'px';
                  }}
                />
                <button
                  type="submit"
                  disabled={!inputMessage.trim() || loadingResponse || !activeSession}
                  className="absolute right-2 bottom-2 p-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-white disabled:bg-slate-700 disabled:text-slate-500 h-10 w-10 flex items-center justify-center transition-colors"
                >
                  {loadingResponse ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </button>
              </form>
              <p className="text-xs text-slate-600 mt-2 text-center opacity-60">
                Insights derived in part from Garmin & Strava data. Press Enter to send.
              </p>
            </div>
          </div>
        </div>

        {extractedContext && activeSession && athlete && (
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
            stats={undefined} 
          />
        )}
      </div>
    </div>
  );
};