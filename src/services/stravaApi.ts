// Strava API service layer
import axios from 'axios';
import { STRAVA_CONFIG, STORAGE_KEYS } from '../utils/constants';
import { tokenStorageService } from './tokenStorageService';
import type { StravaAthlete, StravaActivity, StravaStats, AuthTokens, StravaZone } from '../types';

class StravaApiService {
  private baseURL = STRAVA_CONFIG.BASE_URL;
  private migrationChecked = false;

  // Get stored tokens (checks database first, falls back to localStorage for migration)
  private async getTokens(): Promise<AuthTokens | null> {
    const dbTokens = await tokenStorageService.getTokens('strava');
    if (dbTokens) {
      return dbTokens;
    }

    if (!this.migrationChecked) {
      this.migrationChecked = true;
      const stored = localStorage.getItem(STORAGE_KEYS.STRAVA_TOKENS);
      if (stored) {
        try {
          const tokens = JSON.parse(stored);
          await this.setTokens(tokens);
          localStorage.removeItem(STORAGE_KEYS.STRAVA_TOKENS);
          return tokens;
        } catch (error) {
          console.error('Failed to migrate localStorage tokens to database:', error);
        }
      }
    }

    return null;
  }

  // Store tokens
  private async setTokens(tokens: AuthTokens): Promise<void> {
    try {
      await tokenStorageService.setTokens('strava', tokens);
    } catch (error) {
      console.error('Failed to save tokens to database:', error);
      localStorage.setItem(STORAGE_KEYS.STRAVA_TOKENS, JSON.stringify(tokens));
    }
  }

  // Check if tokens are valid and refresh if needed
  private async ensureValidTokens(): Promise<string | null> {
    const tokens = await this.getTokens();
    if (!tokens) return null;

    // Check if token is expired (with 5 minute buffer)
    const now = Math.floor(Date.now() / 1000);
    if (tokens.expires_at && tokens.expires_at - 300 < now) {
      try {
        const refreshed = await this.refreshTokens(tokens.refresh_token);
        return refreshed.access_token;
      } catch (error) {
        console.error('Failed to refresh tokens:', error);
        await this.clearTokens();
        return null;
      }
    }

    return tokens.access_token;
  }

  // Generate Strava OAuth URL
  generateAuthUrl(): string {
    const clientId = import.meta.env.VITE_STRAVA_CLIENT_ID;
    const redirectUri = import.meta.env.VITE_STRAVA_REDIRECT_URI;

    // Security check for production
    if (import.meta.env.PROD && (!clientId || clientId.includes('your_'))) {
      throw new Error('⚠️ SECURITY: Strava Client ID not properly configured for production deployment!');
    }

    // Check if environment variables are configured
    if (!clientId || clientId === 'your_actual_strava_client_id_here') {
      throw new Error('Strava Client ID not configured. Please set VITE_STRAVA_CLIENT_ID in your .env file.');
    }

    if (!redirectUri) {
      throw new Error('Strava Redirect URI not configured. Please set VITE_STRAVA_REDIRECT_URI in your .env file.');
    }

    console.log('OAuth URL params:', {
      clientId,
      redirectUri,
      scopes: STRAVA_CONFIG.SCOPES
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: STRAVA_CONFIG.SCOPES,
      approval_prompt: 'auto',
    });

    return `${STRAVA_CONFIG.AUTH_URL}?${params.toString()}`;
  }

  // Exchange authorization code for tokens using Edge Function
  async exchangeCodeForTokens(code: string): Promise<AuthTokens> {
    const redirectUri = import.meta.env.VITE_STRAVA_REDIRECT_URI;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    console.log('Token exchange attempt via Edge Function:', {
      code: code ? 'present' : 'missing',
      codeLength: code ? code.length : 0,
      redirectUri: redirectUri ? 'present' : 'missing'
    });

    if (!code || code.trim().length === 0) {
      throw new Error('Authorization code is empty or invalid');
    }

    if (!redirectUri) {
      throw new Error('Redirect URI not configured');
    }

    if (!supabaseUrl) {
      throw new Error('Supabase URL not configured');
    }

    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/strava-oauth-exchange`;
    const params = new URLSearchParams({
      code: code.trim(),
      redirect_uri: redirectUri,
    });

    console.log('Calling Edge Function:', edgeFunctionUrl);

    try {
      const response = await fetch(`${edgeFunctionUrl}?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(`Token exchange failed: ${errorData.error || response.statusText}`);
      }

      const data = await response.json();
      console.log('Token exchange successful via Edge Function');

      if (!data.access_token) {
        throw new Error('No access token received from Strava');
      }

      const tokens: AuthTokens = data;
      this.setTokens(tokens);
      console.log('Successfully obtained Strava tokens');
      return tokens;
    } catch (error) {
      console.error('Edge Function token exchange error:', error);
      throw error;
    }
  }

  // Refresh access token using Edge Function
  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase configuration not found');
    }

    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/strava-refresh-token`;

    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(`Token refresh failed: ${errorData.error || response.statusText}`);
    }

    const data = await response.json();
    const tokens: AuthTokens = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
      expires_in: data.expires_in,
      token_type: data.token_type,
    };

    this.setTokens(tokens);
    return tokens;
  }

  // Clear stored tokens
  async clearTokens(): Promise<void> {
    await tokenStorageService.deleteTokens('strava');
    localStorage.removeItem(STORAGE_KEYS.STRAVA_TOKENS);
    localStorage.removeItem(STORAGE_KEYS.ATHLETE_DATA);
  }

  // Check if user is authenticated
  async isAuthenticated(): Promise<boolean> {
    const tokens = await this.getTokens();
    if (!tokens) {
      console.log('No tokens found in database or localStorage');
      return false;
    }

    console.log('Tokens found:', {
      hasAccessToken: !!tokens.access_token,
      expiresAt: tokens.expires_at,
      now: Math.floor(Date.now() / 1000)
    });

    return !!tokens.access_token;
  }

  // Get authenticated athlete
  async getAthlete(): Promise<StravaAthlete> {
    const accessToken = await this.ensureValidTokens();
    if (!accessToken) {
      throw new Error('No valid access token');
    }

    try {
      const response = await axios.get(`${this.baseURL}/athlete`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        timeout: 10000, // 10s timeout
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new Error('Request timed out. Please check your internet connection.');
        }
        if (error.code === 'ERR_NETWORK') {
          throw new Error('Network error. Please check your internet connection.');
        }
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'] || '15 minutes';
          throw new Error(`Strava API rate limit exceeded. Please wait ${retryAfter} and try again.`);
        }
      }
      throw error;
    }
  }

  // Get athlete activities
  async getActivities(page = 1, perPage = 30): Promise<StravaActivity[]> {
    const accessToken = await this.ensureValidTokens();
    if (!accessToken) {
      throw new Error('No valid access token');
    }

    try {
      const response = await axios.get(`${this.baseURL}/athlete/activities`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          page,
          per_page: perPage,
        },
        timeout: 15000, // 15s timeout for activities
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new Error('Request timed out. Please check your internet connection.');
        }
        if (error.code === 'ERR_NETWORK') {
          throw new Error('Network error. Please check your internet connection.');
        }
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'] || '15 minutes';
          throw new Error(`Strava API rate limit exceeded. Please wait ${retryAfter} and try again.`);
        }
      }
      throw error;
    }
  }

  // Get athlete stats
  async getAthleteStats(athleteId: number): Promise<StravaStats> {
    const accessToken = await this.ensureValidTokens();
    if (!accessToken) {
      throw new Error('No valid access token');
    }

    try {
      const response = await axios.get(`${this.baseURL}/athletes/${athleteId}/stats`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 429) {
        const retryAfter = error.response.headers['retry-after'] || '15 minutes';
        throw new Error(`Strava API rate limit exceeded. Please wait ${retryAfter} and try again. Strava limits: 100 requests per 15 minutes, 1000 per day.`);
      }
      throw error;
    }
  }

  // Get specific activity details
  async getActivity(activityId: number): Promise<StravaActivity> {
    const accessToken = await this.ensureValidTokens();
    if (!accessToken) {
      throw new Error('No valid access token');
    }

    try {
      const response = await axios.get(`${this.baseURL}/activities/${activityId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 429) {
        const retryAfter = error.response.headers['retry-after'] || '15 minutes';
        throw new Error(`Strava API rate limit exceeded. Please wait ${retryAfter} and try again. Strava limits: 100 requests per 15 minutes, 1000 per day.`);
      }
      throw error;
    }
  }

  // Get activity zones
  async getActivityZones(activityId: number): Promise<StravaZone[]> {
    const accessToken = await this.ensureValidTokens();
    if (!accessToken) {
      throw new Error('No valid access token');
    }

    try {
      const response = await axios.get(`${this.baseURL}/activities/${activityId}/zones`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 429) {
        const retryAfter = error.response.headers['retry-after'] || '15 minutes';
        throw new Error(`Strava API rate limit exceeded. Please wait ${retryAfter} and try again.`);
      }
      // Zones might not exist for all activities (e.g. manual entry without HR/Power)
      console.warn(`Could not fetch zones for activity ${activityId}`, error);
      return [];
    }
  }

  // Get activity streams (watts, etc.)
  async getActivityStreams(activityId: number, types: string[]): Promise<any[]> {
    const accessToken = await this.ensureValidTokens();
    if (!accessToken) {
      throw new Error('No valid access token');
    }

    try {
      const response = await axios.get(`${this.baseURL}/activities/${activityId}/streams`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
          keys: types.join(','),
          key_by_type: true
        }
      });

      return response.data;
    } catch (error) {
       console.warn(`Could not fetch streams for activity ${activityId}`, error);
       // Return empty object/array on failure so we gracefully fallback
       return [];
    }
  }
}

export const stravaApi = new StravaApiService();