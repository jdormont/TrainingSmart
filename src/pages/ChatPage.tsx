import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Send, Bot, User, Loader2, Menu, X, Calendar, Activity, Heart, Battery } from 'lucide-react';
import { stravaApi } from '../services/stravaApi';
import { ouraApi } from '../services/ouraApi';
import { openaiService } from '../services/openaiApi';
import { chatSessionService } from '../services/chatSessionService';
import { chatContextExtractor } from '../services/chatContextExtractor';
import { convertMarkdownToHtml } from '../utils/markdownToHtml';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Button } from '../components/common/Button';
import SessionSidebar from '../components/chat/SessionSidebar';
import { ChatContextModal } from '../components/chat/ChatContextModal';
import type { StravaActivity, StravaAthlete, StravaStats, ChatMessage, ChatSession, OuraSleepData, OuraReadinessData, ChatContextSnapshot } from '../types';
import { calculateWeeklyStats } from '../utils/dataProcessing';
import { calculateSleepScore } from '../utils/sleepScoreCalculator';
import { formatDistance, formatDuration, formatDate } from '../utils/formatters';

export const ChatPage: React.FC = () => {
  const location = useLocation();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

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
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
        if (ouraApi.isAuthenticated()) {
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
        
        // Load chat sessions
        const savedSessions = await chatSessionService.getSessions();
        setSessions(savedSessions);

        // Load active session or create default
        const activeSessionId = (location.state as any)?.activeSessionId || chatSessionService.getActiveSessionId();
        let currentSession = activeSessionId ?
          savedSessions.find(s => s.id === activeSessionId) : null;
        
        if (!currentSession && savedSessions.length === 0) {
          // Create default session
          currentSession = await chatSessionService.createSession(
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
          chatSessionService.setActiveSession(currentSession.id);
        }
        
        setActiveSession(currentSession);
        
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
          
          chatSessionService.addMessageToSession(currentSession.id, welcomeMessage);
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
    chatSessionService.addMessageToSession(activeSession.id, userMessage);

    setInputMessage('');
    setLoading(true);
    setError(null);

    try {
      // Build training context
      const weeklyStats = calculateWeeklyStats(activities);
      
      // Calculate sleep score if we have sleep data
      const sleepScore = sleepData ? calculateSleepScore(sleepData).totalScore : undefined;
      
      const trainingContext = {
        athlete,
        recentActivities: activities,
        stats: stats || {} as StravaStats,
        weeklyVolume: {
          distance: weeklyStats.totalDistance,
          time: weeklyStats.totalTime,
          activities: weeklyStats.activityCount
        },
        recovery: {
          sleepData,
          readinessData,
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

      // Add assistant response to session
      chatSessionService.addMessageToSession(activeSession.id, assistantMessage);

      // Update sessions list
      const updatedSessions = await chatSessionService.getSessions();
      setSessions(updatedSessions);
      
      // Refresh active session from storage to get latest messages
      const updatedSession = await chatSessionService.getSession(activeSession.id);
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
    const session = await chatSessionService.getSession(sessionId);
    if (session) {
      setActiveSession(session);
      chatSessionService.setActiveSession(sessionId);
    }
  };

  const handleSessionCreate = async (name: string, category: ChatSession['category'], description?: string) => {
    const newSession = await chatSessionService.createSession(name, category, description);
    const updatedSessions = await chatSessionService.getSessions();
    setSessions(updatedSessions);
    setActiveSession(newSession);
  };

  const handleSessionDelete = async (sessionId: string) => {
    await chatSessionService.deleteSession(sessionId);
    const updatedSessions = await chatSessionService.getSessions();
    setSessions(updatedSessions);

    // If we deleted the active session, switch to another or create new
    if (activeSession?.id === sessionId) {
      const remainingSessions = await chatSessionService.getSessions();
      if (remainingSessions.length > 0) {
        const newActive = remainingSessions[0];
        setActiveSession(newActive);
        chatSessionService.setActiveSession(newActive.id);
      } else {
        setActiveSession(null);
        chatSessionService.clearActiveSession();
      }
    }
  };

  const handleSessionRename = async (sessionId: string, newName: string) => {
    await chatSessionService.updateSession(sessionId, { name: newName });
    const updatedSessions = await chatSessionService.getSessions();
    setSessions(updatedSessions);

    // Update active session if it's the one being renamed
    if (activeSession?.id === sessionId) {
      setActiveSession(prev => prev ? { ...prev, name: newName } : null);
    }
  };

  const SUGGESTIONS = [
    { label: "Analyze my last week", icon: Activity },
    { label: "Build a plan for a Century Ride", icon: Calendar },
    { label: "Why is my HR high on hills?", icon: Heart },
    { label: "Suggest a recovery ride", icon: Battery }
  ];

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e as any);
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

    chatSessionService.addMessageToSession(activeSession.id, userMessage);

    setLoading(true);
    setError(null);

    try {
      const weeklyStats = calculateWeeklyStats(activities);
      const sleepScore = sleepData ? calculateSleepScore(sleepData).totalScore : undefined;

      const trainingContext = {
        athlete,
        recentActivities: activities,
        stats: stats || {} as StravaStats,
        weeklyVolume: {
          distance: weeklyStats.totalDistance,
          time: weeklyStats.totalTime,
          activities: weeklyStats.activityCount
        },
        recovery: {
          sleepData,
          readinessData,
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

      chatSessionService.addMessageToSession(activeSession.id, assistantMessage);

      const updatedSessions = await chatSessionService.getSessions();
      setSessions(updatedSessions);

      const updatedSession = await chatSessionService.getSession(activeSession.id);
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
    <div className="h-screen bg-gray-50 flex overflow-hidden">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'block' : 'hidden'} lg:block flex-shrink-0`}>
        <SessionSidebar
          sessions={sessions}
          activeSessionId={activeSession?.id || null}
          onSessionSelect={handleSessionSelect}
          onSessionCreate={handleSessionCreate}
          onSessionDelete={handleSessionDelete}
          onSessionRename={handleSessionRename}
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 text-gray-400 hover:text-gray-600"
              >
                {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
              
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  {activeSession?.name || 'AI Training Coach'}
                </h1>
                {activeSession?.description && (
                  <p className="text-sm text-gray-600">{activeSession.description}</p>
                )}
              </div>
            </div>
            
            {activeSession && (
              <div className="flex items-center space-x-2">
                {showPlanButton && (
                  <button
                    onClick={handleExtractContext}
                    disabled={extracting}
                    className="flex items-center space-x-1 px-3 py-1.5 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Calendar className="w-4 h-4" />
                    <span>{extracting ? 'Extracting...' : 'Create Plan'}</span>
                  </button>
                )}
                <span className={`text-xs px-2 py-1 rounded-full ${chatSessionService.getCategoryColor(activeSession.category)}`}>
                  {chatSessionService.getCategoryIcon(activeSession.category)} {activeSession.category}
                </span>
                <span className="text-xs text-gray-500">
                  {activeSession.messages.length} messages
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Training Summary */}
        {athlete && activities.length > 0 && (
          <div className="bg-white border-b border-gray-200 p-4 flex-shrink-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Recent Activities:</span>
                <span className="font-medium ml-1">{activities.length}</span>
              </div>
              <div>
                <span className="text-gray-500">This Week:</span>
                <span className="font-medium ml-1">
                  {formatDistance(calculateWeeklyStats(activities).totalDistance)}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Last Activity:</span>
                <span className="font-medium ml-1">
                  {formatDate(activities[0]?.start_date_local || '')}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Primary Sport:</span>
                <span className="font-medium ml-1">
                  {activities[0]?.type || 'N/A'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
          {!activeSession ? (
            <div className="text-center text-gray-500 mt-20">
              <Bot className="w-12 h-12 mx-auto mb-4 text-gray-300" />
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
                    className={`flex items-start space-x-2 max-w-[80%] ${
                      message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        message.role === 'user'
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {message.role === 'user' ? (
                        <User className="w-4 h-4" />
                      ) : (
                        <Bot className="w-4 h-4" />
                      )}
                    </div>
                    <div
                      className={`rounded-lg px-4 py-2 ${
                        message.role === 'user'
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      {message.role === 'user' ? (
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      ) : (
                        <div 
                          className="prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ 
                            __html: convertMarkdownToHtml(message.content) 
                          }}
                        />
                      )}
                      <p
                        className={`text-xs mt-1 ${
                          message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
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
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                      <Bot className="w-4 h-4 text-gray-600" />
                    </div>
                    <div className="bg-gray-100 rounded-lg px-4 py-2">
                      <div className="flex items-center space-x-2">
                        <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
                        <span className="text-gray-600">Thinking...</span>
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
          <div className="border-t border-gray-200 p-6 bg-gradient-to-br from-gray-50 to-white flex-shrink-0">
            <div className="max-w-3xl mx-auto">
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Quick Start</h3>
                <p className="text-sm text-gray-600">Get started with one of these suggestions</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {SUGGESTIONS.map((suggestion) => {
                  const Icon = suggestion.icon;
                  return (
                    <button
                      key={suggestion.label}
                      onClick={() => handleSuggestedQuestion(suggestion.label)}
                      className="group flex items-center space-x-3 p-4 bg-white border-2 border-gray-200 rounded-lg hover:border-orange-400 hover:shadow-md transition-all text-left"
                    >
                      <div className="flex-shrink-0 w-10 h-10 bg-orange-50 group-hover:bg-orange-100 rounded-lg flex items-center justify-center transition-colors">
                        <Icon className="w-5 h-5 text-orange-500" />
                      </div>
                      <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                        {suggestion.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Input Form */}
        <div className="border-t border-gray-200 p-4 bg-white flex-shrink-0">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-2 mb-3">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}
          
          <form onSubmit={handleSendMessage} className="flex space-x-2">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={activeSession ? "Ask about your training..." : "Select a session to start chatting..."}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none min-h-[40px] max-h-32"
              rows={1}
              disabled={loading || !activeSession}
              style={{
                height: 'auto',
                minHeight: '40px',
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
              className="px-4 py-2 self-end"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
          <p className="text-xs text-gray-500 mt-1">
            Press Enter to send, Shift+Enter for new line
          </p>
          <p className="text-xs text-gray-400 italic mt-2 text-center">
            Insights derived in part from Garmin device-sourced data.
          </p>
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
  );
};