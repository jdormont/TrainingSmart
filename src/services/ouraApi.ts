// Oura Ring API service layer
import axios from 'axios';
import { format, subDays } from 'date-fns';
import { OURA_CONFIG, STORAGE_KEYS } from '../utils/constants';
import { tokenStorageService } from './tokenStorageService';
import { supabase } from './supabaseClient';
import type { OuraTokens, OuraSleepData, OuraReadinessData, OuraActivityData, DailyMetric } from '../types';

class OuraApiService {
  // Use the proxy path for both Dev (Vite) and Prod (Vercel) to avoid CORS issues.
  private baseURL = '/api/oura';
  private migrationChecked = false;

  // Get stored tokens (checks database first, falls back to localStorage for migration)
  private async getTokens(): Promise<OuraTokens | null> {
    const dbTokens = await tokenStorageService.getTokens('oura');
    if (dbTokens) {
      return {
        access_token: dbTokens.access_token,
        token_type: dbTokens.token_type,
        refresh_token: dbTokens.refresh_token,
        expires_at: dbTokens.expires_at
      };
    }

    if (!this.migrationChecked) {
      this.migrationChecked = true;
      const stored = localStorage.getItem(STORAGE_KEYS.OURA_TOKENS);
      if (stored) {
        try {
          const tokens = JSON.parse(stored);
          await this.setTokens(tokens);
          localStorage.removeItem(STORAGE_KEYS.OURA_TOKENS);
          return tokens;
        } catch (error) {
          console.error('Failed to migrate Oura localStorage tokens to database:', error);
        }
      }
    }

    return null;
  }

  // Store tokens
  private async setTokens(tokens: OuraTokens): Promise<void> {
    try {
      await tokenStorageService.setTokens('oura', {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        // If we have expires_in (seconds), calculate absolute expires_at
        expires_at: tokens.expires_in ? Math.floor(Date.now() / 1000) + tokens.expires_in : (tokens.expires_at || 0),
        expires_in: tokens.expires_in || 0,
        token_type: tokens.token_type || 'Bearer'
      });
    } catch (error) {
      console.error('Failed to save Oura tokens to database:', error);
      // Fallback only if database save fails
      localStorage.setItem(STORAGE_KEYS.OURA_TOKENS, JSON.stringify(tokens));
    }
  }

  // Check if tokens are valid and refresh if needed
  private async ensureValidTokens(): Promise<string | null> {
    const tokens = await this.getTokens();
    if (!tokens) return null;

    // Check if simplified PAT (no expires_at)
    if (!tokens.expires_at) {
        return tokens.access_token;
    }

    // Check expiration (buffer of 60 seconds)
    if (Date.now() >= (tokens.expires_at - 60) * 1000) {
        console.log('Oura Access Token expired, refreshing...');
        try {
            const newTokens = await this.refreshTokens(tokens.refresh_token);
            return newTokens.access_token;
        } catch (error) {
            console.error('Failed to refresh Oura token:', error);
            // If refresh fails, we might want to clear tokens so user is forced to re-login?
            // For now, let's keep old tokens but return null or throw. 
            // Better to return null so the app knows we aren't auth'd.
            return null;
        }
    }

    return tokens.access_token;
  }

  // Generate Oura OAuth URL
  generateAuthUrl(): string {
    const clientId = import.meta.env.VITE_OURA_CLIENT_ID;
    const redirectUri = import.meta.env.VITE_OURA_REDIRECT_URI;
    
    console.log('=== OURA OAUTH DEBUG ===');
    console.log('Environment variables:');
    console.log('- VITE_OURA_CLIENT_ID:', clientId ? `${clientId.substring(0, 8)}...` : 'NOT SET');
    console.log('- VITE_OURA_REDIRECT_URI:', redirectUri);
    console.log('- OURA_CONFIG.AUTH_URL:', OURA_CONFIG.AUTH_URL);
    
    if (!clientId || clientId === 'your_oura_client_id') {
      throw new Error('Oura Client ID not configured. Please set VITE_OURA_CLIENT_ID in your .env file.');
    }
    
    if (!redirectUri) {
      throw new Error('Oura Redirect URI not configured. Please set VITE_OURA_REDIRECT_URI in your .env file.');
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: OURA_CONFIG.SCOPES,
      state: Math.random().toString(36).substring(2, 15), // CSRF protection
    });

    const authUrl = `${OURA_CONFIG.AUTH_URL}?${params.toString()}`;
    
    console.log('Generated OAuth parameters:');
    console.log('- client_id:', clientId);
    console.log('- redirect_uri:', redirectUri);
    console.log('- response_type: code');
    console.log('- scope:', OURA_CONFIG.SCOPES);
    console.log('');
    console.log('🔗 FULL OAUTH URL:');
    console.log(authUrl);
    console.log('');
    console.log('Copy this URL and try opening it in a new tab if the redirect fails');
    console.log('========================');
    
    return authUrl;
  }

  // Exchange authorization code for tokens
  async exchangeCodeForTokens(code: string): Promise<OuraTokens> {
    const clientId = import.meta.env.VITE_OURA_CLIENT_ID;
    const clientSecret = import.meta.env.VITE_OURA_CLIENT_SECRET;
    const redirectUri = import.meta.env.VITE_OURA_REDIRECT_URI;
    
    // Security warning for production
    if (import.meta.env.PROD) {
      console.warn('🚨 SECURITY WARNING: Oura client secret is exposed in frontend! Move token exchange to backend before production deployment.');
    }
    
    if (!clientId || clientId === 'your_oura_client_id') {
      throw new Error('VITE_OURA_CLIENT_ID not configured in .env file');
    }
    
    if (!clientSecret || clientSecret === 'your_oura_client_secret') {
      throw new Error('VITE_OURA_CLIENT_SECRET not configured in .env file');
    }
    
    if (!code || code.trim().length === 0) {
      throw new Error('Authorization code is empty or invalid');
    }

    const requestData = {
      client_id: clientId,
      client_secret: clientSecret,
      code: code.trim(),
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    };
    
    try {
      // Use the baseURL (which is proxied in Dev) or fallback to direct URL.
      // NOTE: In production, this requires a Vercel rewrite or backend function to avoid CORS.
      const tokenUrl = `${this.baseURL}/oauth/token`;
      
      const response = await axios.post(tokenUrl, requestData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      if (!response.data.access_token) {
        throw new Error('No access token received from Oura');
      }

      const tokens: OuraTokens = response.data;
      this.setTokens(tokens);
      console.log('Successfully obtained Oura tokens');
      return tokens;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.error_description || 
                           error.response?.data?.error || 
                           error.response?.statusText || 
                           error.message;
        throw new Error(`Oura token exchange failed (${error.response?.status}): ${errorMessage}`);
      }
      throw error;
    }
  }

  // Refresh access token
  async refreshTokens(refreshToken: string): Promise<OuraTokens> {
    const response = await axios.post(OURA_CONFIG.TOKEN_URL, {
      client_id: import.meta.env.VITE_OURA_CLIENT_ID,
      client_secret: import.meta.env.VITE_OURA_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    const tokens: OuraTokens = response.data;
    this.setTokens(tokens);
    return tokens;
  }

  // Clear stored tokens
  async clearTokens(): Promise<void> {
    await tokenStorageService.deleteTokens('oura');
    localStorage.removeItem(STORAGE_KEYS.OURA_TOKENS);
  }

  // Check if user is authenticated
  async isAuthenticated(): Promise<boolean> {
    try {
      const tokens = await this.getTokens();
      const isAuth = !!tokens?.access_token;
      console.log('Oura authentication check:', {
        hasTokens: !!tokens,
        hasAccessToken: !!tokens?.access_token,
        isAuthenticated: isAuth
      });
      return isAuth;
    } catch (error) {
      console.error('Error checking Oura authentication:', error);
      return false;
    }
  }

  // Get sleep data for date range
  async getSleepData(startDate: string, endDate: string): Promise<OuraSleepData[]> {
    try {
      const accessToken = await this.ensureValidTokens();
      if (!accessToken) {
        throw new Error('No valid Oura access token');
      }

      console.log('Fetching Oura sleep data:', { startDate, endDate });
      
      const response = await axios.get(`${this.baseURL}/v2/usercollection/sleep`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
        params: {
          start_date: startDate,
          end_date: endDate,
        },
      });

      console.log('Oura sleep API response:', {
        status: response.status,
        dataCount: response.data?.data?.length || 0,
        firstRecord: response.data?.data?.[0] || null,
        responseStructure: Object.keys(response.data || {})
      });
      
      return response.data.data || [];
    } catch (error) {
      console.error('Failed to fetch Oura sleep data:', error);
      if (axios.isAxiosError(error)) {
        console.error('Oura API error details:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data
        });
      }
      throw error;
    }
  }

  // Get readiness data for date range
  async getReadinessData(startDate: string, endDate: string): Promise<OuraReadinessData[]> {
    try {
      const accessToken = await this.ensureValidTokens();
      if (!accessToken) {
        throw new Error('No valid Oura access token');
      }

      console.log('Fetching Oura readiness data:', { startDate, endDate });
      
      const response = await axios.get(`${this.baseURL}/v2/usercollection/daily_readiness`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
        params: {
          start_date: startDate,
          end_date: endDate,
        },
      });

      console.log('Oura readiness API response:', {
        status: response.status,
        dataCount: response.data?.data?.length || 0,
        firstRecord: response.data?.data?.[0] || null,
        responseStructure: Object.keys(response.data || {})
      });
      
      return response.data.data || [];
    } catch (error) {
      console.error('Failed to fetch Oura readiness data:', error);
      if (axios.isAxiosError(error)) {
        console.error('Oura API error details:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data
        });
      }
      throw error;
    }
  }

  // Get activity data for date range
  async getActivityData(startDate: string, endDate: string): Promise<OuraActivityData[]> {
    const accessToken = await this.ensureValidTokens();
    if (!accessToken) {
      throw new Error('No valid Oura access token');
    }

    const response = await axios.get(`${this.baseURL}/v2/usercollection/daily_activity`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      params: {
        start_date: startDate,
        end_date: endDate,
      },
    });

    return response.data.data;
  }

  // Get recent sleep data (last 7 days)
  async getRecentSleepData(): Promise<OuraSleepData[]> {
    const now = new Date();
    const endDate = format(now, 'yyyy-MM-dd');
    const startDate = format(subDays(now, 7), 'yyyy-MM-dd');
    
    console.log('Sleep data date range:', { startDate, endDate, currentDate: now.toISOString().split('T')[0] });
    
    return this.getSleepData(startDate, endDate);
  }

  // Get recent readiness data (last 7 days)
  async getRecentReadinessData(): Promise<OuraReadinessData[]> {
    const now = new Date();
    const endDate = format(now, 'yyyy-MM-dd');
    const startDate = format(subDays(now, 7), 'yyyy-MM-dd');
    
    console.log('Readiness data date range:', { startDate, endDate, currentDate: now.toISOString().split('T')[0] });
    
    return this.getReadinessData(startDate, endDate);
  }

  // Get recent activity data (last 7 days)
  async getRecentActivityData(): Promise<OuraActivityData[]> {
    const now = new Date();
    const endDate = format(now, 'yyyy-MM-dd');
    const startDate = format(subDays(now, 7), 'yyyy-MM-dd');
    
    console.log('Activity data date range:', { startDate, endDate, currentDate: now.toISOString().split('T')[0] });
    
    return this.getActivityData(startDate, endDate);
  }

  // Sync Oura data to Supabase (Database Persistence)
  async syncOuraToDatabase(userId: string, startDate?: string, endDate?: string): Promise<void> {
      try {
          console.log('🔄 Starting Oura -> Supabase Sync...');
          
          // 1. Determine Date Range (Default to last 7 days if not provided)
          const now = new Date();
          const end = endDate || format(now, 'yyyy-MM-dd');
          const start = startDate || format(subDays(now, 7), 'yyyy-MM-dd');

          // 2. Fetch all raw data from Oura API
          const sleepData = await this.getSleepData(start, end);
          const readinessData = await this.getReadinessData(start, end);
          
          if (!sleepData.length && !readinessData.length) {
              console.log('No Oura data found to sync for range:', { start, end });
              return;
          }

          console.log(`📥 Fetched ${sleepData.length} sleep records and ${readinessData.length} readiness records.`);

          // 3. Map to DailyMetric objects
          // We iterate by date to merge Sleep + Readiness into one DailyMetric
          const metricsMap = new Map<string, Partial<DailyMetric>>();

          // Process Sleep
          sleepData.forEach(sleep => {
              if (!metricsMap.has(sleep.day)) metricsMap.set(sleep.day, { user_id: userId, date: sleep.day, source: 'oura' });
              const m = metricsMap.get(sleep.day)!;
              
              m.sleep_minutes = Math.round(sleep.total_sleep_duration / 60);
              m.resting_hr = sleep.lowest_heart_rate;
              m.hrv = sleep.average_hrv;
              m.respiratory_rate = sleep.average_breath;
              m.deep_sleep_minutes = Math.round(sleep.deep_sleep_duration / 60);
              m.rem_sleep_minutes = Math.round(sleep.rem_sleep_duration / 60);
              m.light_sleep_minutes = Math.round(sleep.light_sleep_duration / 60);
              m.sleep_efficiency = sleep.efficiency;
              m.temperature_deviation = sleep.temperature_deviation;
          });

          // Process Readiness (Merge in)
          readinessData.forEach(readiness => {
               if (!metricsMap.has(readiness.day)) metricsMap.set(readiness.day, { user_id: userId, date: readiness.day, source: 'oura' });
               const m = metricsMap.get(readiness.day)!;
               
               m.recovery_score = readiness.score;
               
               // Fallback: If temperature not in sleep (v2 sometimes differs), check readiness
               if (m.temperature_deviation === undefined) {
                   m.temperature_deviation = readiness.temperature_deviation;
               }
          });

          // 4. Convert to Array and Validate
          const upsertPayload: DailyMetric[] = [];
          metricsMap.forEach(metric => {
              // Only push if we have at least the critical fields (Sleep OR Readiness score)
              // Note: Types require specific fields, but upsert might handle partials if we are careful? 
              // Actually, TS definition requires sleep_minutes etc. so we must ensure defaults if missing.
              
              const fullMetric: DailyMetric = {
                  user_id: userId,
                  date: metric.date!,
                  source: 'oura',
                  sleep_minutes: metric.sleep_minutes || 0,
                  resting_hr: metric.resting_hr || 0,
                  hrv: metric.hrv || 0,
                  recovery_score: metric.recovery_score || 0,
                  respiratory_rate: metric.respiratory_rate,
                  deep_sleep_minutes: metric.deep_sleep_minutes,
                  rem_sleep_minutes: metric.rem_sleep_minutes,
                  light_sleep_minutes: metric.light_sleep_minutes,
                  sleep_efficiency: metric.sleep_efficiency,
                  temperature_deviation: metric.temperature_deviation
              };
              upsertPayload.push(fullMetric);
          });

          // 5. Upsert to Supabase
          if (upsertPayload.length > 0) {
              const { error } = await supabase
                  .from('daily_metrics')
                  .upsert(upsertPayload, { onConflict: 'user_id,date' }); // Match constraint

              if (error) throw error;
              console.log(`✅ Successfully synced ${upsertPayload.length} Oura records to Supabase!`);
          }

      } catch (error) {
          console.error('❌ Failed to sync Oura data to database:', error);
          throw error;
      }
  }
}

export const ouraApi = new OuraApiService();