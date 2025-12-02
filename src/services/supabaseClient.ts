// Supabase client configuration
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// Database types (generated from schema)
export interface Database {
  public: {
    Tables: {
      chat_sessions: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          category: string;
          created_at: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          category?: string;
          created_at?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          category?: string;
          created_at?: string;
          updated_at?: string;
          user_id?: string;
        };
      };
      chat_messages: {
        Row: {
          id: string;
          session_id: string;
          role: 'user' | 'assistant';
          content: string;
          timestamp: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          role: 'user' | 'assistant';
          content: string;
          timestamp?: string;
          user_id: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          role?: 'user' | 'assistant';
          content?: string;
          timestamp?: string;
          user_id?: string;
        };
      };
    };
  };
}