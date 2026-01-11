import React, { useState, useEffect } from 'react';
import { ExternalLink, Clock, Eye, ThumbsUp, ThumbsDown, Calendar, Filter, MessageCircle, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { Button } from '../common/Button';
import { contentFeedService } from '../../services/contentFeedService';
import { supabaseChatService } from '../../services/supabaseChatService';
import { stravaApi } from '../../services/stravaApi';
import type { ContentItem, StravaActivity, ChatSession } from '../../types';

interface ContentFeedProps {
  activities: StravaActivity[];
}

export const ContentFeed: React.FC<ContentFeedProps> = ({ activities }) => {
  const navigate = useNavigate();
  const [content, setContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'video' | 'article'>('all');
  const [feedbackStates, setFeedbackStates] = useState<Record<string, 'like' | 'dislike' | null>>({});
  const [hasContentPrefsChat, setHasContentPrefsChat] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const loadContent = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('Loading content feed...');

        // Get chat sessions for profile analysis
        const chatSessions = await supabaseChatService.getSessions();

        // Check if content preferences chat exists
        const hasContentPrefs = chatSessions.some(session => session.category === 'content_preferences');
        setHasContentPrefsChat(hasContentPrefs);

        // Generate content feed
        const feedContent = await contentFeedService.getContentFeed(chatSessions, activities);
        console.log(`Loaded ${feedContent.length} content items`);
        setContent(feedContent);
      } catch (err) {
        console.error('Failed to load content feed:', err);
        setError('Failed to load personalized content. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    loadContent();
  }, [activities]);

  const handleFeedback = (itemId: string, feedback: 'like' | 'dislike') => {
    console.log(`User gave ${feedback} feedback to item: ${itemId}`);

    setFeedbackStates(prev => ({
      ...prev,
      [itemId]: prev[itemId] === feedback ? null : feedback
    }));

    // Store feedback for recommendation training
    contentFeedService.recordFeedback(itemId, feedback);

    // Show user that feedback was recorded
    const message = feedback === 'like'
      ? 'Thanks! We\'ll show you more content about these topics.'
      : 'Got it! We\'ll avoid content about these topics.';

    const item = content.find(c => c.id === itemId);
    console.log(`${message} Learning from: "${item?.title}"`);

    // Force a small delay then refresh to show immediate impact
    setTimeout(() => {
      console.log('Auto-refreshing content to show feedback impact...');
      handleRefreshContent();
    }, 1000);
  };

  const createContentPreferencesChat = async () => {
    try {
      const newSession = await supabaseChatService.createSession(
        'Content Preferences',
        'content_preferences',
        'Set up your content recommendations'
      );

      // Navigate to chat page with the new session
      navigate('/chat', { state: { activeSessionId: newSession.id } });
    } catch (err) {
      console.error('Failed to create content preferences session:', err);
    }
  };

  const handleRefreshContent = async () => {
    setRefreshing(true);
    try {
      console.log('Refreshing content feed...');
      // Clear content cache to force fresh fetch
      localStorage.removeItem('content_cache');

      // Reload content
      const chatSessions = await supabaseChatService.getSessions();
      const feedContent = await contentFeedService.getContentFeed(chatSessions, activities);
      console.log(`Refreshed content: ${feedContent.length} items`);
      setContent(feedContent);

      console.log('Content feed refreshed with latest preferences and feedback');
    } catch (err) {
      console.error('Failed to refresh content:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const filteredContent = content.filter(item => {
    if (filter === 'all') return true;
    return item.type === filter;
  });

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  const formatPublishedDate = (date: Date): string => {
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  const getSourceIcon = (source: ContentItem['source']) => {
    switch (source) {
      case 'youtube': return '🎥';
      case 'instagram': return '📸';
      case 'rss': return '📰';
      case 'magazine': return '📖';
      default: return '🔗';
    }
  };

  const getSourceColor = (source: ContentItem['source']) => {
    switch (source) {
      case 'youtube': return 'bg-red-100 text-red-800';
      case 'instagram': return 'bg-pink-100 text-pink-800';
      case 'rss': return 'bg-blue-100 text-blue-800';
      case 'magazine': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-900 rounded-lg shadow-sm border border-slate-800 p-8">
        <div className="text-center">
          <LoadingSpinner size="lg" className="text-orange-500 mb-4" />
          <h3 className="text-lg font-semibold text-slate-50 mb-2">
            Curating Your Content Feed
          </h3>
          <p className="text-slate-400">
            Analyzing your training data and chat history to find relevant content...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-900 rounded-lg shadow-sm border border-slate-800 p-8">
        <div className="text-center">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h3 className="text-lg font-semibold text-slate-50 mb-2">
            Unable to Load Content
          </h3>
          <p className="text-slate-400 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-md transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 rounded-lg shadow-sm border border-slate-800">
      {/* Header */}
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-50">
              Recommended for You
            </h2>
            <p className="text-slate-400 text-sm">
              Personalized cycling content based on your training and interests
            </p>
          </div>

          {/* Filter Controls */}
          <div className="flex items-center space-x-2">
            <Button
              onClick={handleRefreshContent}
              loading={refreshing}
              size="sm"
              variant="outline"
              className="flex items-center space-x-2 bg-transparent border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-slate-100"
            >
              <RefreshCw className="w-4 h-4" />
              <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
            </Button>
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="text-sm bg-slate-800 border border-slate-700 text-slate-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">All Content</option>
              <option value="video">Videos</option>
              <option value="article">Articles</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="p-6">
        {filteredContent.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-slate-600 text-4xl mb-4">📺</div>
            <h3 className="text-lg font-semibold text-slate-50 mb-2">
              No Content Available
            </h3>
            <p className="text-slate-400">
              We're working on finding great cycling content for you. Check back soon!
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredContent.map((item) => (
              <div
                key={item.id}
                className="group bg-slate-800/50 border border-slate-700/50 rounded-lg overflow-hidden hover:shadow-md hover:shadow-black/20 hover:border-slate-600 transition-all"
              >
                {/* Thumbnail */}
                <div className="aspect-video bg-slate-800 relative overflow-hidden">
                  {item.thumbnail ? (
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          parent.innerHTML = `
                            <div class="w-full h-full flex items-center justify-center bg-gray-200">
                              <div class="text-center">
                                <div class="text-4xl mb-2">${item.type === 'video' ? '🎥' : '📰'}</div>
                                <div class="text-sm text-gray-600">${item.author}</div>
                              </div>
                            </div>
                          `;
                        }
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-800">
                      <div className="text-center">
                        <div className="text-4xl mb-2">{item.type === 'video' ? '🎥' : '📰'}</div>
                        <div className="text-sm text-slate-500">{item.author}</div>
                      </div>
                    </div>
                  )}
                  {item.duration && item.duration > 0 && (
                    <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                      {formatDuration(item.duration)}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-4">
                  {/* Source and Date */}
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${getSourceColor(item.source)}`}>
                      {getSourceIcon(item.source)} {item.source}
                    </span>
                    <div className="flex items-center text-xs text-slate-400">
                      <Calendar className="w-3 h-3 mr-1" />
                      {formatPublishedDate(item.publishedAt)}
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="font-semibold text-slate-50 mb-2 line-clamp-2 group-hover:text-orange-400 transition-colors">
                    {item.title}
                  </h3>

                  {/* Author */}
                  <p className="text-sm text-slate-400 mb-2">
                    by {item.author}
                  </p>

                  {/* Description */}
                  <p className="text-sm text-slate-400 mb-3 line-clamp-5">
                    {item.description}
                  </p>

                  {/* Tags */}
                  {item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {item.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Stats */}
                  {item.viewCount && (
                    <div className="flex items-center text-xs text-slate-500 mb-3">
                      <Eye className="w-3 h-3 mr-1" />
                      {(item.viewCount / 1000).toFixed(0)}K views
                      {item.channelSubscribers && (
                        <span className="ml-3">
                          {(item.channelSubscribers / 1000).toFixed(0)}K subscribers
                        </span>
                      )}
                    </div>
                  )}

                  {/* Action Button */}
                  <div className="flex items-center justify-between">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-2 text-sm text-orange-400 hover:text-orange-300 font-medium"
                    >
                      <span>{item.type === 'video' ? 'Watch' : 'Read'}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>

                    {/* Feedback Buttons */}
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => handleFeedback(item.id, 'like')}
                        className={`p-1 rounded-full transition-colors ${feedbackStates[item.id] === 'like'
                          ? 'bg-green-500/20 text-green-400'
                          : 'text-slate-400 hover:text-green-400 hover:bg-green-500/10'
                          }`}
                        title="I like this content"
                      >
                        <ThumbsUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleFeedback(item.id, 'dislike')}
                        className={`p-1 rounded-full transition-colors ${feedbackStates[item.id] === 'dislike'
                          ? 'bg-red-500/20 text-red-400'
                          : 'text-slate-400 hover:text-red-400 hover:bg-red-500/10'
                          }`}
                        title="I don't like this content"
                      >
                        <ThumbsDown className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Relevance Score (for debugging) */}
                  {process.env.NODE_ENV === 'development' && (
                    <div className="mt-2 text-xs text-gray-400">
                      Relevance: {item.relevanceScore}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Content Preferences Prompt */}
        {!hasContentPrefsChat && (
          <div className="bg-orange-950/20 border border-orange-500/20 rounded-lg p-4 mt-6">
            <div className="flex items-start space-x-3">
              <MessageCircle className="w-5 h-5 text-orange-400 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-medium text-orange-200 mb-1">
                  Get Better Content Recommendations
                </h3>
                <p className="text-sm text-orange-200/80 mb-3">
                  Tell our AI about your content preferences to get more personalized recommendations.
                  This takes just 2-3 minutes and greatly improves your feed quality.
                </p>
                <Button
                  onClick={createContentPreferencesChat}
                  size="sm"
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Set Up Content Preferences
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};