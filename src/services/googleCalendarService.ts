import { supabase } from './supabaseClient';
import type { Workout } from '../types';

interface GoogleCalendarTokens {
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

interface GoogleCalendarEvent {
  summary: string;
  description: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
}

class GoogleCalendarService {
  private readonly GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  private readonly GOOGLE_CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;
  private readonly REDIRECT_URI = import.meta.env.VITE_GOOGLE_REDIRECT_URI || `${window.location.origin}/settings`;
  private readonly CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';
  private readonly SCOPES = 'https://www.googleapis.com/auth/calendar.events';

  async getCurrentUserId(): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  }

  initiateOAuthFlow(): void {
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.append('client_id', this.GOOGLE_CLIENT_ID);
    authUrl.searchParams.append('redirect_uri', this.REDIRECT_URI);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', this.SCOPES);
    authUrl.searchParams.append('access_type', 'offline');
    authUrl.searchParams.append('prompt', 'consent');

    window.location.href = authUrl.toString();
  }

  async handleOAuthCallback(code: string): Promise<void> {
    const userId = await this.getCurrentUserId();
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: this.GOOGLE_CLIENT_ID,
        client_secret: this.GOOGLE_CLIENT_SECRET,
        redirect_uri: this.REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.json();
      throw new Error(`Failed to exchange code for tokens: ${error.error_description || error.error}`);
    }

    const tokens = await tokenResponse.json();
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    const { error } = await supabase
      .from('google_calendar_tokens')
      .upsert({
        user_id: userId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt.toISOString(),
      }, {
        onConflict: 'user_id',
      });

    if (error) {
      throw new Error(`Failed to save tokens: ${error.message}`);
    }
  }

  async getTokens(): Promise<GoogleCalendarTokens | null> {
    const userId = await this.getCurrentUserId();
    if (!userId) return null;

    const { data, error } = await supabase
      .from('google_calendar_tokens')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) return null;

    const expiresAt = new Date(data.expires_at);
    const now = new Date();

    if (expiresAt <= now) {
      return await this.refreshAccessToken(data.refresh_token);
    }

    return data as GoogleCalendarTokens;
  }

  private async refreshAccessToken(refreshToken: string): Promise<GoogleCalendarTokens | null> {
    const userId = await this.getCurrentUserId();
    if (!userId) return null;

    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          refresh_token: refreshToken,
          client_id: this.GOOGLE_CLIENT_ID,
          client_secret: this.GOOGLE_CLIENT_SECRET,
          grant_type: 'refresh_token',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to refresh token');
      }

      const tokens = await response.json();
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

      const { error } = await supabase
        .from('google_calendar_tokens')
        .update({
          access_token: tokens.access_token,
          expires_at: expiresAt.toISOString(),
        })
        .eq('user_id', userId);

      if (error) {
        throw new Error(`Failed to update tokens: ${error.message}`);
      }

      return {
        access_token: tokens.access_token,
        refresh_token: refreshToken,
        expires_at: expiresAt.toISOString(),
      };
    } catch (error) {
      console.error('Failed to refresh access token:', error);
      return null;
    }
  }

  async isConnected(): Promise<boolean> {
    const tokens = await this.getTokens();
    return tokens !== null;
  }

  async disconnect(): Promise<void> {
    const userId = await this.getCurrentUserId();
    if (!userId) return;

    const tokens = await this.getTokens();
    if (tokens) {
      try {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${tokens.access_token}`, {
          method: 'POST',
        });
      } catch (error) {
        console.error('Failed to revoke token:', error);
      }
    }

    const { error } = await supabase
      .from('google_calendar_tokens')
      .delete()
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to disconnect: ${error.message}`);
    }
  }

  async getConnectionStatus(): Promise<{ connected: boolean; connectedAt?: Date }> {
    const userId = await this.getCurrentUserId();
    if (!userId) return { connected: false };

    const { data, error } = await supabase
      .from('google_calendar_tokens')
      .select('created_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) return { connected: false };

    return {
      connected: true,
      connectedAt: new Date(data.created_at),
    };
  }

  private formatWorkoutDescription(workout: Workout): string {
    const lines = [];

    lines.push(`Type: ${this.capitalizeFirst(workout.type)}`);
    lines.push(`Intensity: ${this.capitalizeFirst(workout.intensity)}`);

    if (workout.duration > 0) {
      lines.push(`Duration: ${this.formatDuration(workout.duration)}`);
    }

    if (workout.distance) {
      const miles = (workout.distance / 1609.34).toFixed(1);
      lines.push(`Distance: ${miles} miles`);
    }

    if (workout.description) {
      lines.push('');
      lines.push('Details:');
      lines.push(this.stripMarkdown(workout.description));
    }

    lines.push('');
    lines.push('---');
    lines.push(`View in app: ${window.location.origin}/plans`);

    return lines.join('\n');
  }

  private stripMarkdown(text: string): string {
    return text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/^#+\s+/gm, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .trim();
  }

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes} minutes`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  }

  private getDefaultWorkoutTime(scheduledDate: Date, type: string): Date {
    const workoutDate = new Date(scheduledDate);

    const defaultTimes: Record<string, { hour: number; minute: number }> = {
      bike: { hour: 6, minute: 0 },
      run: { hour: 6, minute: 0 },
      swim: { hour: 6, minute: 0 },
      strength: { hour: 17, minute: 0 },
      rest: { hour: 0, minute: 0 },
    };

    const time = defaultTimes[type] || { hour: 9, minute: 0 };
    workoutDate.setHours(time.hour, time.minute, 0, 0);

    return workoutDate;
  }

  async exportWorkoutToCalendar(workout: Workout): Promise<string> {
    const tokens = await this.getTokens();
    if (!tokens) {
      throw new Error('Google Calendar not connected. Please connect your calendar in Settings.');
    }

    if (workout.google_calendar_event_id) {
      throw new Error('This workout has already been exported to Google Calendar.');
    }

    const startDateTime = this.getDefaultWorkoutTime(workout.scheduledDate, workout.type);
    const endDateTime = new Date(startDateTime.getTime() + workout.duration * 60 * 1000);
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const event: GoogleCalendarEvent = {
      summary: `${this.getTypeEmoji(workout.type)} ${workout.name}`,
      description: this.formatWorkoutDescription(workout),
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone,
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone,
      },
    };

    const response = await fetch(`${this.CALENDAR_API_BASE}/calendars/primary/events`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to create calendar event: ${error.error?.message || 'Unknown error'}`);
    }

    const createdEvent = await response.json();

    const { error: updateError } = await supabase
      .from('workouts')
      .update({ google_calendar_event_id: createdEvent.id })
      .eq('id', workout.id);

    if (updateError) {
      console.error('Failed to update workout with calendar event ID:', updateError);
    }

    return createdEvent.id;
  }

  async exportWorkoutsToCalendar(workouts: Workout[]): Promise<{ success: number; failed: number; errors: string[] }> {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const workout of workouts) {
      try {
        if (workout.google_calendar_event_id) {
          results.failed++;
          results.errors.push(`"${workout.name}" already exported`);
          continue;
        }

        await this.exportWorkoutToCalendar(workout);
        results.success++;
      } catch (error) {
        results.failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`"${workout.name}": ${errorMessage}`);
      }
    }

    return results;
  }

  private getTypeEmoji(type: string): string {
    const emojis: Record<string, string> = {
      bike: '🚴',
      run: '🏃',
      swim: '🏊',
      strength: '💪',
      rest: '😌',
    };
    return emojis[type] || '🏋️';
  }
}

export const googleCalendarService = new GoogleCalendarService();
