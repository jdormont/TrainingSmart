import { supabase } from './supabaseClient';
import type { AuthTokens } from '../types';

type TokenProvider = 'strava' | 'oura' | 'google_calendar';

class TokenStorageService {
  async getTokens(provider: TokenProvider): Promise<AuthTokens | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('user_tokens')
        .select('*')
        .eq('user_id', user.id)
        .eq('provider', provider)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token || '',
        expires_at: data.expires_at ? new Date(data.expires_at).getTime() / 1000 : 0,
        expires_in: 0,
        token_type: data.token_type || 'Bearer'
      };
    } catch (error) {
      console.error(`Failed to get ${provider} tokens from database:`, error);
      return null;
    }
  }

  async setTokens(provider: TokenProvider, tokens: AuthTokens): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const expiresAt = tokens.expires_at
        ? new Date(tokens.expires_at * 1000).toISOString()
        : null;

      console.log(`Saving ${provider} tokens to DB...`, { 
        expires_at: expiresAt, 
        has_refresh: !!tokens.refresh_token 
      });

      const { error } = await supabase
        .from('user_tokens')
        .upsert({
          user_id: user.id,
          provider,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || null,
          expires_at: expiresAt,
          token_type: tokens.token_type || 'Bearer',
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,provider'
        });

      if (error) {
        console.error(`DB Upsert Error for ${provider}:`, error);
        throw error;
      }
      
      console.log(`Successfully saved ${provider} tokens to DB`);
    } catch (error) {
      console.error(`Failed to save ${provider} tokens to database:`, error);
      throw error;
    }
  }

  async deleteTokens(provider: TokenProvider): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('user_tokens')
        .delete()
        .eq('user_id', user.id)
        .eq('provider', provider);

      if (error) throw error;
    } catch (error) {
      console.error(`Failed to delete ${provider} tokens from database:`, error);
      throw error;
    }
  }

  async hasTokens(provider: TokenProvider): Promise<boolean> {
    const tokens = await this.getTokens(provider);
    return tokens !== null && !!tokens.access_token;
  }
}

export const tokenStorageService = new TokenStorageService();
