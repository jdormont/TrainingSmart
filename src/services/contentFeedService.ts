// Content Feed Service - Aggregates and scores content from multiple sources
import axios from 'axios';
import type { ContentItem, UserContentProfile, StravaActivity, ChatSession } from '../types';
import { STORAGE_KEYS } from '../utils/constants';

// YouTube API Configuration
const YOUTUBE_CONFIG = {
  BASE_URL: 'https://www.googleapis.com/youtube/v3',
  API_KEY: import.meta.env.VITE_YOUTUBE_API_KEY,
  MAX_RESULTS: 20,
  CACHE_DURATION: 2 * 60 * 60 * 1000, // 2 hours in milliseconds
  DISPLAY_LIMIT: 8, // Show fewer items to reduce choice overload
} as const;

// Top cycling channels to monitor
const CYCLING_CHANNELS = {
  'GCN': 'UCuTaETsuCOkJ0H_GAztWt0Q', // Global Cycling Network
  'TrainerRoad': 'UCkoxLhSz0DqYoYyZz8-hXjg',
  'Dylan Johnson': 'UC2gBc0NUMqJTbVCBx6WGqQw',
  'Cam Nicholls': 'UCKTOn5JWFaUNzmOaZgx_r8A',
  'GMBN Tech': 'UC_A--fhX5gea0i4UtpD99Gg',
  'Peter Attia MD': 'UC8kGsMa0LygSX9nkBcBH1Sg',
  'Cycling Weekly': 'UCuTaETsuCOkJ0H_GAztWt0Q',
  'BikeRadar': 'UCKqxks-wl6kONsNFZKaUB0g'
} as const;

// Cache interface
interface ContentCache {
  content: ContentItem[];
  timestamp: Date;
  userProfileHash: string;
}

// Content keywords for cycling relevance
const CYCLING_KEYWORDS = [
  'cycling', 'bike', 'bicycle', 'training', 'FTP', 'power', 'endurance',
  'recovery', 'nutrition', 'race', 'tour de france', 'giro', 'vuelta',
  'climbing', 'sprint', 'time trial', 'aerodynamics', 'cadence',
  'heart rate', 'zones', 'intervals', 'base training', 'peak',
  'tapering', 'century', 'gran fondo', 'criterium', 'road race'
];

// YouTube API Interfaces
interface YouTubeThumbnail {
  url: string;
  width?: number;
  height?: number;
}

interface YouTubeSnippet {
  publishedAt: string;
  channelId: string;
  title: string;
  description: string;
  thumbnails: {
    default?: YouTubeThumbnail;
    medium?: YouTubeThumbnail;
    high?: YouTubeThumbnail;
  };
  channelTitle: string;
  liveBroadcastContent?: string;
  publishTime?: string;
}

interface YouTubeId {
  kind: string;
  videoId?: string;
}

interface YouTubeApiItem {
  kind: string;
  etag: string;
  id: YouTubeId | string;
  snippet: YouTubeSnippet;
  contentDetails?: {
    duration: string;
    dimension: string;
    definition: string;
    caption: string;
    licensedContent: boolean;
    contentRating: any;
    projection: string;
  };
  statistics?: {
    viewCount: string;
    likeCount: string;
    favoriteCount: string;
    commentCount: string;
  };
}


class ContentFeedService {
  // Generate a simple hash of user profile for cache invalidation
  private generateProfileHash(profile: UserContentProfile): string {
    const profileString = JSON.stringify({
      interests: profile.interests.sort(),
      activityTypes: profile.activityTypes.sort(),
      skillLevel: profile.skillLevel,
      goals: profile.goals.sort()
    });

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < profileString.length; i++) {
      const char = profileString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  // Check if cached content is still valid
  private isCacheValid(cache: ContentCache, currentProfileHash: string): boolean {
    const now = new Date();
    const cacheAge = now.getTime() - cache.timestamp.getTime();

    return (
      cacheAge < YOUTUBE_CONFIG.CACHE_DURATION &&
      cache.userProfileHash === currentProfileHash &&
      cache.content.length > 0
    );
  }

  // Load cached content
  private loadCachedContent(): ContentCache | null {
    try {
      const cached = localStorage.getItem(STORAGE_KEYS.CONTENT_CACHE);
      if (!cached) return null;

      const cache = JSON.parse(cached);
      return {
        ...cache,
        timestamp: new Date(cache.timestamp),
        content: cache.content.map((item: ContentItem) => ({
          ...item,
          publishedAt: new Date(item.publishedAt)
        }))
      };
    } catch (error) {
      console.warn('Failed to load cached content:', error);
      return null;
    }
  }

  // Save content to cache
  private saveCachedContent(content: ContentItem[], profileHash: string): void {
    try {
      const cache: ContentCache = {
        content,
        timestamp: new Date(),
        userProfileHash: profileHash
      };
      localStorage.setItem(STORAGE_KEYS.CONTENT_CACHE, JSON.stringify(cache));
    } catch (error) {
      console.warn('Failed to save content cache:', error);
    }
  }

  // Analyze user profile from existing data
  async generateUserProfile(
    chatSessions: ChatSession[],
    activities: StravaActivity[]
  ): Promise<UserContentProfile> {
    const interests = this.extractInterestsFromChats(chatSessions);
    const activityTypes = this.analyzeActivityTypes(activities);
    const skillLevel = this.estimateSkillLevel(activities);
    const goals = this.extractGoalsFromChats(chatSessions);

    return {
      interests,
      favoriteCreators: [], // Will be populated as user interacts
      activityTypes,
      skillLevel,
      goals,
      preferredContentTypes: ['video', 'article'], // Default preferences
      lastUpdated: new Date()
    };
  }

  // Extract interests from chat history
  private extractInterestsFromChats(sessions: ChatSession[]): string[] {
    const interests = new Set<string>();

    // First, add interests from user feedback
    const feedbackInterests = this.extractInterestsFromFeedback();
    feedbackInterests.forEach(interest => interests.add(interest));

    const interestKeywords = {
      'power training': ['power', 'ftp', 'watts', 'threshold'],
      'recovery': ['recovery', 'rest', 'sleep', 'fatigue'],
      'nutrition': ['nutrition', 'fueling', 'hydration', 'food'],
      'climbing': ['climbing', 'hills', 'elevation', 'mountains'],
      'racing': ['race', 'competition', 'event', 'performance'],
      'endurance': ['endurance', 'long ride', 'base', 'aerobic'],
      'technique': ['technique', 'form', 'efficiency', 'cadence'],
      'equipment': ['bike', 'gear', 'equipment', 'setup', 'fit']
    };

    sessions.forEach(session => {
      const allText = session.messages
        .map(m => m.content.toLowerCase())
        .join(' ');

      Object.entries(interestKeywords).forEach(([interest, keywords]) => {
        if (keywords.some(keyword => allText.includes(keyword))) {
          interests.add(interest);
        }
      });
    });

    return Array.from(interests);
  }

  // Analyze activity types from Strava data
  private analyzeActivityTypes(activities: StravaActivity[]): string[] {
    const typeCount = activities.reduce((acc, activity) => {
      acc[activity.type] = (acc[activity.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(typeCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([type]) => type);
  }

  // Estimate skill level from activity data
  private estimateSkillLevel(activities: StravaActivity[]): 'beginner' | 'intermediate' | 'advanced' {
    if (activities.length === 0) return 'beginner';


    const avgSpeed = activities.reduce((sum, a) => sum + a.average_speed, 0) / activities.length;
    const maxDistance = Math.max(...activities.map(a => a.distance));

    // Simple heuristic based on distance and speed
    if (maxDistance > 100000 && avgSpeed > 8) return 'advanced'; // 100km+ rides, 28+ km/h
    if (maxDistance > 50000 && avgSpeed > 6) return 'intermediate'; // 50km+ rides, 21+ km/h
    return 'beginner';
  }

  // Extract goals from chat content
  private extractGoalsFromChats(sessions: ChatSession[]): string[] {
    const goals = new Set<string>();
    const goalKeywords = {
      'weight loss': ['weight', 'lose', 'fat', 'slim'],
      'race preparation': ['race', 'event', 'competition', 'prepare'],
      'fitness improvement': ['fitness', 'health', 'stronger', 'fitter'],
      'endurance building': ['endurance', 'distance', 'long', 'base'],
      'speed development': ['speed', 'fast', 'sprint', 'quick'],
      'power increase': ['power', 'ftp', 'watts', 'strength']
    };

    sessions.forEach(session => {
      const allText = session.messages
        .map(m => m.content.toLowerCase())
        .join(' ');

      Object.entries(goalKeywords).forEach(([goal, keywords]) => {
        if (keywords.some(keyword => allText.includes(keyword))) {
          goals.add(goal);
        }
      });
    });

    return Array.from(goals);
  }

  // Fetch content from YouTube
  // Fetch content from YouTube using Hybrid Approach (Interests + Trends)
  async fetchYouTubeContent(userProfile: UserContentProfile): Promise<ContentItem[]> {
    const profileHash = this.generateProfileHash(userProfile);

    // Check cache first
    const cachedContent = this.loadCachedContent();
    if (cachedContent && this.isCacheValid(cachedContent, profileHash)) {
      console.log('Using cached YouTube content');
      return cachedContent.content;
    }

    if (!YOUTUBE_CONFIG.API_KEY ||
      YOUTUBE_CONFIG.API_KEY.includes('your_youtube_api_key')) {
      console.warn('YouTube API key not configured, using mock content');
      return this.getMockYouTubeContent(userProfile);
    }

    try {
      console.log('Fetching fresh YouTube content from API...');
      const contentMap = new Map<string, ContentItem>();
      let totalApiCalls = 0;

      // 1. INTEREST-BASED SEARCH (Top Priority)
      // Extract top 2 interests to query
      const topInterests = userProfile.interests.slice(0, 2);
      const searchQueries = topInterests.length > 0 ? topInterests : ['cycling training'];

      console.log(`Searching for interests: ${searchQueries.join(', ')}`);

      for (const interest of searchQueries) {
        try {
          // Add "cycling" context to ensure relevance
          const query = interest.toLowerCase().includes('cycling') || interest.toLowerCase().includes('bike')
            ? interest
            : `cycling ${interest}`;

          const items = await this.searchContentByKeywords(query, 6); // Fetch 6 items per interest
          items.forEach(item => contentMap.set(item.id, item));
          totalApiCalls++;
        } catch (err) {
          console.warn(`Failed to search for "${interest}":`, err);
        }
      }

      // 2. TRENDING/LATEST FROM CHANNELS (Secondary)
      // Fetch from a subset of top channels to keep user updated
      const channelsToFetch = Object.entries(CYCLING_CHANNELS).slice(0, 3); // Top 3 channels only

      for (const [channelName, channelId] of channelsToFetch) {
        try {
          const response = await axios.get(`${YOUTUBE_CONFIG.BASE_URL}/search`, {
            params: {
              key: YOUTUBE_CONFIG.API_KEY,
              channelId,
              part: 'snippet',
              order: 'date',
              maxResults: 2, // Just 2 latest items per channel
              type: 'video',
              publishedAfter: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString() // Last 2 weeks
            }
          });
          totalApiCalls++;

          const items = this.mapYouTubeItems(response.data.items, channelName);
          items.forEach(item => {
            if (!contentMap.has(item.id)) {
              contentMap.set(item.id, item);
            }
          });
        } catch (err) {
          console.warn(`Failed to fetch from channel ${channelName}:`, err);
        }
      }

      console.log(`YouTube API: Made ${totalApiCalls} calls, fetched ${contentMap.size} unique videos`);

      const allContent = Array.from(contentMap.values());

      // If we got no content due to API errors, fall back to mock content
      if (allContent.length === 0) {
        console.warn('No content fetched from YouTube API, falling back to mock content');
        return this.getMockYouTubeContent(userProfile);
      }

      // Fetch statistics for all collected videos to get duration/views
      // (Optimized: one batch call for all IDs)
      const videoIdsToFetch = allContent
        .filter(i => i.source === 'youtube')
        .map(i => i.id.split('_')[1]) // Extract video ID from youtube_ID_channel
        .slice(0, 50); // limit to 50 for API

      if (videoIdsToFetch.length > 0) {
        try {
          const statsResponse = await axios.get(`${YOUTUBE_CONFIG.BASE_URL}/videos`, {
            params: {
              key: YOUTUBE_CONFIG.API_KEY,
              id: videoIdsToFetch.join(','),
              part: 'statistics,contentDetails'
            }
          });

          const statsMap = new Map(
            statsResponse.data.items.map((item: YouTubeApiItem) => [item.id as string, item])
          );

          // Update content with stats
          allContent.forEach(item => {
            const vidId = item.id.split('_')[1];
            const stats = statsMap.get(vidId);
            if (stats) {
              item.duration = stats.contentDetails?.duration ? this.parseYouTubeDuration(stats.contentDetails.duration) : 0;
              item.viewCount = stats.statistics?.viewCount ? parseInt(stats.statistics.viewCount) : undefined;
            }
          });
        } catch (err) {
          console.warn('Failed to fetch video statistics:', err);
        }
      }

      // Score and sort content
      const scoredContent = allContent.map(item => ({
        ...item,
        relevanceScore: this.calculateRelevanceScore(item, userProfile)
      }));

      const finalContent = scoredContent
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, YOUTUBE_CONFIG.MAX_RESULTS);

      // Cache the results
      this.saveCachedContent(finalContent, profileHash);

      return finalContent;

    } catch (error) {
      console.error('YouTube API error, falling back to mock content:', error);
      return this.getMockYouTubeContent(userProfile);
    }
  }

  // Helper to search YouTube by keywords
  private async searchContentByKeywords(query: string, maxResults: number): Promise<ContentItem[]> {
    const response = await axios.get(`${YOUTUBE_CONFIG.BASE_URL}/search`, {
      params: {
        key: YOUTUBE_CONFIG.API_KEY,
        q: query,
        part: 'snippet',
        order: 'relevance',
        maxResults: maxResults,
        type: 'video',
        videoDuration: 'medium', // Avoid shorts if possible, or very short videos
        publishedAfter: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString() // Last 3 months (broader window for niche interests)
      }
    });

    return this.mapYouTubeItems(response.data.items, 'YouTube Search');
  }

  // Helper to map API response items to ContentItem[]
  private mapYouTubeItems(items: YouTubeApiItem[], defaultAuthor: string): ContentItem[] {
    return items.map((item: YouTubeApiItem) => {
      // Use channelTitle if available, otherwise default
      const author = item.snippet.channelTitle || defaultAuthor;

      // Type guards for ID handling
      let videoId = '';
      if (typeof item.id === 'string') {
        videoId = item.id;
      } else if (item.id.videoId) {
        videoId = item.id.videoId;
      }

      return {
        id: `youtube_${videoId}_${author.replace(/\s+/g, '')}`,
        source: 'youtube' as const,
        type: 'video' as const,
        title: this.decodeHtmlEntities(item.snippet.title.trim()),
        description: this.decodeHtmlEntities(item.snippet.description?.substring(0, 200) || '') + '...',
        url: `https://www.youtube.com/watch?v=${videoId}`,
        thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
        author: author,
        publishedAt: new Date(item.snippet.publishedAt),
        relevanceScore: 0, // Calculated later
        tags: this.extractTags(item.snippet.title + ' ' + item.snippet.description),
        duration: 0, // Populated by stats call
        viewCount: 0 // Populated by stats call
      };
    });
  }

  // Decode HTML entities from YouTube titles/descriptions
  private decodeHtmlEntities(text: string): string {
    const entities: Record<string, string> = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&#x27;': "'",
      '&apos;': "'"
    };

    return text.replace(/&[#\w]+;/g, (entity) => {
      return entities[entity] || entity;
    });
  }

  // Parse YouTube duration format (PT1H2M10S) to seconds
  private parseYouTubeDuration(duration: string): number {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;

    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseInt(match[3] || '0');

    return hours * 3600 + minutes * 60 + seconds;
  }

  // Extract relevant tags from content
  private extractTags(text: string): string[] {
    const lowerText = text.toLowerCase();
    return CYCLING_KEYWORDS.filter(keyword =>
      lowerText.includes(keyword)
    );
  }

  // Calculate relevance score based on user profile
  private calculateRelevanceScore(item: ContentItem, profile: UserContentProfile): number {
    let score = 0;
    const scoringDetails: string[] = [];

    // Apply feedback-based scoring first
    const feedbackScore = this.getFeedbackScore(item);
    score += feedbackScore;
    if (feedbackScore !== 0) {
      scoringDetails.push(`feedback: ${feedbackScore}`);
    }

    // Base score for cycling content
    if (item.tags.some(tag => CYCLING_KEYWORDS.includes(tag))) {
      score += 10;
      scoringDetails.push(`cycling: +10`);
    }

    // Interest matching
    profile.interests.forEach(interest => {
      const interestWords = interest.split(' ');
      if (interestWords.some(word =>
        item.title.toLowerCase().includes(word) ||
        item.description.toLowerCase().includes(word)
      )) {
        // Higher score for interests from content preferences chat
        const isContentPrefInterest = [
          'bike reviews', 'training videos', 'race coverage', 'maintenance',
          'technique', 'nutrition', 'motivation', 'beginner tips', 'advanced training',
          'bike fitting', 'climbing', 'time trials', 'group riding'
        ].includes(interest);
        const interestScore = isContentPrefInterest ? 25 : 15;
        score += interestScore;
        scoringDetails.push(`interest "${interest}": +${interestScore}`);
      }
    });

    // Activity type matching
    profile.activityTypes.forEach(activityType => {
      if (item.title.toLowerCase().includes(activityType.toLowerCase()) ||
        item.description.toLowerCase().includes(activityType.toLowerCase())) {
        score += 10;
        scoringDetails.push(`activity "${activityType}": +10`);
      }
    });

    // Skill level matching
    const skillKeywords = {
      beginner: ['beginner', 'basic', 'intro', 'start', 'learn'],
      intermediate: ['intermediate', 'improve', 'better', 'tips'],
      advanced: ['advanced', 'pro', 'elite', 'master', 'expert']
    };

    const levelWords = skillKeywords[profile.skillLevel] || [];
    if (levelWords.some(word =>
      item.title.toLowerCase().includes(word) ||
      item.description.toLowerCase().includes(word)
    )) {
      score += 8;
      scoringDetails.push(`skill level: +8`);
    }

    // Freshness bonus (newer content gets higher score)
    const daysSincePublished = (Date.now() - item.publishedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSincePublished < 7) {
      score += 5;
      scoringDetails.push(`fresh: +5`);
    } else if (daysSincePublished < 30) {
      score += 2;
      scoringDetails.push(`recent: +2`);
    }

    console.log(`Scoring "${item.title}": ${score} (${scoringDetails.join(', ')})`);

    return Math.max(0, score);
  }

  // Extract keywords from content item for feedback matching
  private extractKeywordsFromContent(item: ContentItem): string[] {
    const text = `${item.title} ${item.description}`.toLowerCase();
    const keywords = new Set<string>();

    // Extract multi-word phrases first (more specific)
    const multiWordPhrases = [
      'power meter', 'heart rate', 'bike fit', 'bike fitting', 'time trial',
      'hill climb', 'group ride', 'recovery ride', 'base training', 'interval training',
      'ftp test', 'vo2 max', 'lactate threshold', 'power zones', 'heart rate zones',
      'bike maintenance', 'chain cleaning', 'tire pressure', 'gear shifting',
      'cycling nutrition', 'recovery nutrition', 'race preparation', 'century ride',
      'gran fondo', 'criterium', 'road race', 'time trialing', 'hill climbing'
    ];

    multiWordPhrases.forEach(phrase => {
      if (text.includes(phrase)) {
        keywords.add(phrase);
      }
    });

    // Extract single word keywords
    const singleWords = [
      'power', 'ftp', 'watts', 'training', 'endurance', 'speed', 'climbing',
      'recovery', 'nutrition', 'hydration', 'fueling', 'race', 'racing',
      'technique', 'form', 'efficiency', 'aerodynamics', 'cadence', 'zones',
      'intervals', 'threshold', 'vo2', 'lactate', 'base', 'build', 'peak',
      'taper', 'periodization', 'volume', 'intensity', 'frequency',
      'bike', 'bicycle', 'cycling', 'ride', 'riding', 'cyclist',
      'maintenance', 'repair', 'setup', 'fit', 'position', 'saddle',
      'handlebars', 'wheels', 'tires', 'chain', 'gears', 'brakes'
    ];

    singleWords.forEach(word => {
      if (text.includes(word) && word.length > 2) {
        keywords.add(word);
      }
    });

    // Also include the item's existing tags
    item.tags.forEach(tag => {
      if (tag.length > 2) {
        keywords.add(tag.toLowerCase());
      }
    });

    return Array.from(keywords);
  }

  // Extract keywords from item ID (for feedback matching)
  private extractKeywordsFromId(itemId: string): string[] {
    console.log(`Extracting keywords from ID: ${itemId}`);

    // Parse the enhanced item ID format: source_videoId_channel_keywords
    const parts = itemId.split('_');
    const keywords = new Set<string>();

    // Add channel/author name as keyword
    if (parts.length > 2) {
      const channel = parts[2].toLowerCase();
      keywords.add(channel);
      console.log(`Added channel keyword: ${channel}`);
    }

    // Extract keywords from the ID parts (title words, etc.)
    parts.forEach(part => {
      const cleanPart = part.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleanPart.length > 2 && !['youtube', 'mock', 'video'].includes(cleanPart)) {
        keywords.add(cleanPart);
      }
    });

    // Try to match against our cycling keyword list
    const cyclingKeywords = [
      'power', 'ftp', 'watts', 'training', 'endurance', 'speed', 'climbing',
      'recovery', 'nutrition', 'hydration', 'fueling', 'race', 'racing',
      'technique', 'form', 'efficiency', 'aerodynamics', 'cadence', 'zones',
      'intervals', 'threshold', 'vo2', 'lactate', 'base', 'build', 'peak',
      'bike', 'bicycle', 'cycling', 'ride', 'riding', 'cyclist',
      'maintenance', 'repair', 'setup', 'fit', 'position'
    ];

    const idText = itemId.toLowerCase();
    cyclingKeywords.forEach(keyword => {
      if (idText.includes(keyword)) {
        keywords.add(keyword);
      }
    });

    const result = Array.from(keywords);
    console.log(`Extracted keywords from ${itemId}:`, result);
    return result;
  }

  // Get feedback-based score adjustments
  private getFeedbackScore(item: ContentItem): number {
    console.log(`Calculating feedback score for: ${item.title}`);

    try {
      const feedbackData = localStorage.getItem(STORAGE_KEYS.CONTENT_FEEDBACK);
      if (!feedbackData) {
        console.log('No feedback data found');
        return 0;
      }

      const feedback = JSON.parse(feedbackData);
      console.log('Available feedback:', Object.keys(feedback).length, 'items');

      // Direct feedback on this item
      if (feedback[item.id]) {
        const score = feedback[item.id] === 'like' ? 50 : -100;
        console.log(`Direct feedback found for ${item.id}: ${feedback[item.id]} (score: ${score})`);
        return score;
      }

      // Feedback on similar content based on title keywords and topics
      let similarScore = 0;
      let feedbackCount = 0;
      const currentKeywords = this.extractKeywordsFromContent(item);
      console.log(`Current item keywords:`, currentKeywords);

      Object.entries(feedback).forEach(([feedbackItemId, feedbackType]) => {
        const feedbackKeywords = this.extractKeywordsFromId(feedbackItemId);

        // Check for keyword overlap
        const commonKeywords = feedbackKeywords.filter(keyword =>
          currentKeywords.includes(keyword)
        );

        if (commonKeywords.length > 0) {
          console.log(`Found ${commonKeywords.length} common keywords with ${feedbackItemId}:`, commonKeywords);
          // Weight by number of common keywords
          const keywordWeight = commonKeywords.length;
          const baseScore = feedbackType === 'like' ? 15 : -25;
          const weightedScore = baseScore * keywordWeight;
          similarScore += weightedScore;
          feedbackCount++;
          console.log(`Applied similarity score: ${weightedScore} (base: ${baseScore}, weight: ${keywordWeight})`);
        }
      });

      // Average the similar content feedback
      const finalScore = feedbackCount > 0 ? similarScore / feedbackCount : 0;
      console.log(`Final feedback score for "${item.title}": ${finalScore} (from ${feedbackCount} similar items)`);
      return finalScore;

    } catch (error) {
      console.warn('Failed to calculate feedback score:', error);
      return 0;
    }
  }

  // Enhanced user profile generation that includes feedback patterns
  private extractInterestsFromFeedback(): string[] {
    try {
      const feedbackData = localStorage.getItem(STORAGE_KEYS.CONTENT_FEEDBACK);
      if (!feedbackData) return [];

      const feedback = JSON.parse(feedbackData);
      const likedContent = Object.entries(feedback)
        .filter(([, type]) => type === 'like')
        .map(([itemId]) => itemId);

      // Extract specific sub-topic interests from liked content
      const interests = new Set<string>();

      likedContent.forEach(itemId => {
        // Extract keywords from the enhanced item IDs
        const keywords = this.extractKeywordsFromId(itemId);

        keywords.forEach(keyword => {
          // Add specific sub-topics as interests
          if (keyword.length > 2) { // Avoid very short keywords
            interests.add(keyword);
          }
        });
      });

      return Array.from(interests);
    } catch (error) {
      console.warn('Failed to extract interests from feedback:', error);
      return [];
    }
  }
  // Mock content for development/fallback
  private getMockYouTubeContent(profile: UserContentProfile): ContentItem[] {
    const mockContent: ContentItem[] = [
      {
        id: 'mock_1_trainerroad_ftp_power_training_intervals',
        source: 'youtube',
        type: 'video',
        title: 'How to Improve Your FTP in 8 Weeks',
        description: 'Complete guide to functional threshold power training with structured workouts and nutrition tips.',
        url: 'https://youtube.com/watch?v=mock1',
        thumbnail: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=480&h=270&fit=crop&auto=format',
        author: 'TrainerRoad',
        publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        relevanceScore: 0,
        tags: ['power', 'training', 'ftp'],
        duration: 720,
        viewCount: 245000,
        channelSubscribers: 520000
      },
      {
        id: 'mock_2_cam_nicholls_bike_fit_position_comfort',
        source: 'youtube',
        type: 'video',
        title: 'Perfect Bike Fit: Complete Guide',
        description: 'Professional bike fitting techniques to improve comfort and performance on long rides.',
        url: 'https://youtube.com/watch?v=mock2',
        thumbnail: 'https://images.unsplash.com/photo-1571068316344-75bc76f77890?w=480&h=270&fit=crop&auto=format',
        author: 'Cam Nicholls',
        publishedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        relevanceScore: 0,
        tags: ['bike', 'fit', 'technique'],
        duration: 900,
        viewCount: 182000,
        channelSubscribers: 340000
      },
      {
        id: 'mock_3_gcn_recovery_nutrition_post_workout',
        source: 'youtube',
        type: 'video',
        title: 'Recovery Nutrition for Cyclists',
        description: 'What to eat after training to maximize recovery and prepare for your next ride.',
        url: 'https://youtube.com/watch?v=mock3',
        thumbnail: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=480&h=270&fit=crop&auto=format',
        author: 'GCN',
        publishedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        relevanceScore: 0,
        tags: ['nutrition', 'recovery'],
        duration: 480,
        viewCount: 512000,
        channelSubscribers: 1200000
      },
      {
        id: 'mock_4_dylan_johnson_zone2_base_training_endurance',
        source: 'youtube',
        type: 'video',
        title: 'Zone 2 Base Training: The Science',
        description: 'Deep dive into aerobic base building and why zone 2 training is crucial for endurance athletes.',
        url: 'https://youtube.com/watch?v=mock4',
        thumbnail: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=480&h=270&fit=crop&auto=format',
        author: 'Dylan Johnson',
        publishedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        relevanceScore: 0,
        tags: ['zone2', 'base', 'training', 'endurance'],
        duration: 960,
        viewCount: 387000,
        channelSubscribers: 280000
      },
      {
        id: 'mock_5_gcn_climbing_technique_hills_power',
        source: 'youtube',
        type: 'video',
        title: 'How to Climb Hills Like a Pro',
        description: 'Professional climbing techniques, pacing strategies, and power management for steep gradients.',
        url: 'https://youtube.com/watch?v=mock5',
        thumbnail: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=480&h=270&fit=crop&auto=format',
        author: 'GCN',
        publishedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        relevanceScore: 0,
        tags: ['climbing', 'hills', 'technique', 'power'],
        duration: 540,
        viewCount: 623000,
        channelSubscribers: 1200000
      },
      {
        id: 'mock_6_bionic_artificial_legs_robot_cycling',
        source: 'youtube',
        type: 'video',
        title: 'Bionic Legs: The Future of Cycling',
        description: 'Revolutionary artificial limbs and robotic assistance for cycling performance enhancement.',
        url: 'https://youtube.com/watch?v=mock6',
        thumbnail: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=480&h=270&fit=crop&auto=format',
        author: 'Tech Channel',
        publishedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
        relevanceScore: 0,
        tags: ['bionic', 'artificial', 'robot', 'technology'],
        duration: 420,
        viewCount: 95000,
        channelSubscribers: 450000
      },
      {
        id: 'mock_7_nutrition_weight_loss_cycling',
        source: 'youtube',
        type: 'video',
        title: 'Cycling Nutrition for Weight Loss | Eat to Burn Fat',
        description: 'Learn how to fuel your rides while maintaining a caloric deficit for effective and sustainable weight loss.',
        url: 'https://youtube.com/watch?v=mock7',
        thumbnail: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=480&h=270&fit=crop&auto=format',
        author: 'Cycling Health',
        publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        relevanceScore: 0,
        tags: ['nutrition', 'weight loss', 'fat loss', 'diet'],
        duration: 840,
        viewCount: 156000,
        channelSubscribers: 85000
      },
      {
        id: 'mock_8_indoor_training_zwift_workout',
        source: 'youtube',
        type: 'video',
        title: 'Best Indoor Cycling Workouts for Busy Riders',
        description: 'Maximize your fitness in just 45 minutes with these high-intensity indoor training sessions.',
        url: 'https://youtube.com/watch?v=mock8',
        thumbnail: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=480&h=270&fit=crop&auto=format',
        author: 'Indoor Specialist',
        publishedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        relevanceScore: 0,
        tags: ['indoor', 'training', 'intervals', 'zwift'],
        duration: 600,
        viewCount: 42000,
        channelSubscribers: 28000
      },
      {
        id: 'mock_9_metabolism_science_endurance',
        source: 'youtube',
        type: 'video',
        title: 'Boosting Metabolism Through Endurance Training',
        description: 'The science behind how long rides affect your metabolic rate and fat burning potential.',
        url: 'https://youtube.com/watch?v=mock9',
        thumbnail: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=480&h=270&fit=crop&auto=format',
        author: 'Science of Sport',
        publishedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
        relevanceScore: 0,
        tags: ['metabolism', 'health', 'science', 'endurance'],
        duration: 1100,
        viewCount: 89000,
        channelSubscribers: 125000
      }
    ];

    return mockContent.map(item => ({
      ...item,
      relevanceScore: this.calculateRelevanceScore(item, profile)
    })).sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  // Save user profile
  saveUserProfile(profile: UserContentProfile): void {
    localStorage.setItem(STORAGE_KEYS.USER_CONTENT_PROFILE, JSON.stringify(profile));
  }

  // Load user profile
  loadUserProfile(): UserContentProfile | null {
    const stored = localStorage.getItem(STORAGE_KEYS.USER_CONTENT_PROFILE);
    if (!stored) return null;

    const profile = JSON.parse(stored);
    return {
      ...profile,
      lastUpdated: new Date(profile.lastUpdated)
    };
  }

  // Record user feedback for content items
  recordFeedback(itemId: string, feedback: 'like' | 'dislike'): void {
    try {
      console.log(`Recording ${feedback} feedback for item: ${itemId}`);

      const existingFeedback = localStorage.getItem(STORAGE_KEYS.CONTENT_FEEDBACK);
      const feedbackData = existingFeedback ? JSON.parse(existingFeedback) : {};

      feedbackData[itemId] = feedback;

      localStorage.setItem(STORAGE_KEYS.CONTENT_FEEDBACK, JSON.stringify(feedbackData));
      console.log('Feedback data saved:', feedbackData);

      // Clear content cache to force refresh with new feedback
      localStorage.removeItem(STORAGE_KEYS.CONTENT_CACHE);
      console.log('Content cache cleared - next refresh will use new feedback');

      // Update user profile to reflect new preferences
      this.updateUserProfileFromFeedback();

      // Extract and log what we learned
      const keywords = this.extractKeywordsFromContent({
        id: itemId,
        title: itemId.split('_').slice(2).join(' '), // Extract title from ID
        description: '',
        tags: []
      } as any);
      console.log(`Learned from ${feedback} feedback - keywords:`, keywords);

    } catch (error) {
      console.warn('Failed to record content feedback:', error);
    }
  }

  // Update user profile based on feedback patterns
  private updateUserProfileFromFeedback(): void {
    try {
      const currentProfile = this.loadUserProfile();
      if (!currentProfile) return;

      // Add feedback-derived interests to profile
      const feedbackInterests = this.extractInterestsFromFeedback();
      const updatedInterests = [...new Set([...currentProfile.interests, ...feedbackInterests])];

      const updatedProfile: UserContentProfile = {
        ...currentProfile,
        interests: updatedInterests,
        lastUpdated: new Date()
      };

      this.saveUserProfile(updatedProfile);
      console.log('Updated user profile with feedback-derived interests:', feedbackInterests);
    } catch (error) {
      console.warn('Failed to update user profile from feedback:', error);
    }
  }

  // Get aggregated content feed
  async getContentFeed(
    chatSessions: ChatSession[],
    activities: StravaActivity[]
  ): Promise<ContentItem[]> {
    // Load or generate user profile
    let userProfile = this.loadUserProfile();

    if (!userProfile || this.shouldUpdateProfile(userProfile)) {
      userProfile = await this.generateUserProfile(chatSessions, activities);
      this.saveUserProfile(userProfile);
    }

    // Fetch content from all sources
    const youtubeContent = await this.fetchYouTubeContent(userProfile);

    // Remove duplicates first, then sort by relevance
    const uniqueContent = this.deduplicateContent(youtubeContent);

    return uniqueContent
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, YOUTUBE_CONFIG.DISPLAY_LIMIT); // Return fewer items to reduce choice overload
  }

  // Check if profile needs updating
  private shouldUpdateProfile(profile: UserContentProfile): boolean {
    const daysSinceUpdate = (Date.now() - profile.lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceUpdate > 7; // Update weekly
  }

  // Remove duplicate content
  private deduplicateContent(content: ContentItem[]): ContentItem[] {
    const seen = new Set<string>();
    const seenTitles = new Set<string>();
    return content.filter(item => {
      // Create multiple deduplication keys
      const titleKey = item.title.toLowerCase().trim();
      const authorTitleKey = `${item.author.toLowerCase()}_${titleKey}`;
      const urlKey = item.url.toLowerCase();

      // Check for exact duplicates by URL
      if (seen.has(urlKey)) return false;

      // Check for very similar titles (edit distance or substring matching)
      const similarTitle = Array.from(seenTitles).some(existingTitle => {
        // Check if titles are very similar (one contains the other or high overlap)
        const shorter = titleKey.length < existingTitle.length ? titleKey : existingTitle;
        const longer = titleKey.length >= existingTitle.length ? titleKey : existingTitle;

        // If one title contains 80% of the other, consider them duplicates
        return longer.includes(shorter) && (shorter.length / longer.length) > 0.8;
      });

      if (similarTitle) return false;

      // Check for same author + very similar title
      if (seen.has(authorTitleKey)) return false;

      // Add to seen sets
      seen.add(urlKey);
      seen.add(authorTitleKey);
      seenTitles.add(titleKey);
      return true;
    });
  }
}

export const contentFeedService = new ContentFeedService();