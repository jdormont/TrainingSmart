// Strava API service layer
import axios from 'axios';
import { STRAVA_CONFIG, STORAGE_KEYS } from '../utils/constants';
import type { StravaAthlete, StravaActivity, StravaStats, AuthTokens } from '../types';

class StravaApiService {
  private baseURL = STRAVA_CONFIG.BASE_URL;

  // Get stored tokens
  private getTokens(): AuthTokens | null {
    const stored = localStorage.getItem(STORAGE_KEYS.STRAVA_TOKENS);
    return stored ? JSON.parse(stored) : null;
  }

  // Store tokens
  private setTokens(tokens: AuthTokens): void {
    localStorage.setItem(STORAGE_KEYS.STRAVA_TOKENS, JSON.stringify(tokens));
  }

  // Check if tokens are valid and refresh if needed
  private async ensureValidTokens(): Promise<string | null> {
    const tokens = this.getTokens();
    if (!tokens) return null;

    // Check if token is expired (with 5 minute buffer)
    const now = Math.floor(Date.now() / 1000);
    if (tokens.expires_at && tokens.expires_at - 300 < now) {
      try {
        const refreshed = await this.refreshTokens(tokens.refresh_token);
        return refreshed.access_token;
      } catch (error) {
        console.error('Failed to refresh tokens:', error);
        this.clearTokens();
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

  // Exchange authorization code for tokens
  async exchangeCodeForTokens(code: string): Promise<AuthTokens> {
    const clientId = import.meta.env.VITE_STRAVA_CLIENT_ID;
    const clientSecret = import.meta.env.VITE_STRAVA_CLIENT_SECRET;
    
    // Security warning for production
    if (import.meta.env.PROD) {
      console.warn('🚨 SECURITY WARNING: Strava client secret is exposed in frontend! Move token exchange to backend before production deployment.');
    }
    
    console.log('Token exchange attempt:', {
      clientId: clientId ? 'present' : 'missing',
      clientSecret: clientSecret ? 'present' : 'missing',
      code: code ? 'present' : 'missing',
      codeLength: code ? code.length : 0,
      codePreview: code ? code.substring(0, 10) + '...' : 'none'
    });
    
    if (!clientId || clientId === 'your_strava_client_id') {
      throw new Error('VITE_STRAVA_CLIENT_ID not configured in .env file');
    }
    
    if (!clientSecret || clientSecret === 'your_strava_client_secret') {
      throw new Error('VITE_STRAVA_CLIENT_SECRET not configured in .env file');
    }
    
    if (!code || code.trim().length === 0) {
      throw new Error('Authorization code is empty or invalid');
    }

    const requestData = {
      client_id: clientId,
      client_secret: clientSecret,
      code: code.trim(),
      grant_type: 'authorization_code',
    };

    console.log('Sending token exchange request:', {
      url: STRAVA_CONFIG.TOKEN_URL,
      data: {
        ...requestData,
        client_secret: '[HIDDEN]'
      }
    });
    
    try {
      const response = await axios.post(STRAVA_CONFIG.TOKEN_URL, requestData);

      console.log('Token exchange response:', response.status, response.data);

      if (!response.data.access_token) {
        throw new Error('No access token received from Strava');
      }

      const tokens: AuthTokens = response.data;
      this.setTokens(tokens);
      console.log('Successfully obtained Strava tokens');
      return tokens;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Strava API error details:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          message: error.message,
          headers: error.response?.headers,
          config: {
            url: error.config?.url,
            method: error.config?.method,
            data: error.config?.data ? '[DATA PRESENT]' : '[NO DATA]'
          }
        });
        
        // Handle specific Strava API error responses
        if (error.response?.status === 400) {
          const errorData = error.response.data;
          if (errorData?.errors) {
            const errorDetails = errorData.errors.map((err: any) => 
              `${err.field}: ${err.code} - ${err.resource}`
            ).join(', ');
            throw new Error(`Token exchange failed (400): ${errorDetails}`);
          } else if (errorData?.message) {
            throw new Error(`Token exchange failed (400): ${errorData.message}`);
          } else {
            throw new Error(`Token exchange failed (400): Invalid request. Check your client credentials and authorization code.`);
          }
        }
        
        const errorMessage = error.response?.data?.message || 
                           error.response?.data?.error || 
                           error.response?.statusText || 
                           error.message;
        throw new Error(`Token exchange failed (${error.response?.status}): ${errorMessage}`);
      }
      throw error;
    }
  }

  // Refresh access token
  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    const response = await axios.post(STRAVA_CONFIG.TOKEN_URL, {
      client_id: import.meta.env.VITE_STRAVA_CLIENT_ID,
      client_secret: import.meta.env.VITE_STRAVA_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    const tokens: AuthTokens = response.data;
    this.setTokens(tokens);
    return tokens;
  }

  // Clear stored tokens
  clearTokens(): void {
    localStorage.removeItem(STORAGE_KEYS.STRAVA_TOKENS);
    localStorage.removeItem(STORAGE_KEYS.ATHLETE_DATA);
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    const tokens = this.getTokens();
    if (!tokens) {
      console.log('No tokens found in localStorage');
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
}

export const stravaApi = new StravaApiService();