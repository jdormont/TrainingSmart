// Authentication service for Supabase
import { supabase } from './supabaseClient';
import type { User, Session } from '@supabase/supabase-js';

class AuthService {
  // Sign up with email and password
  async signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) throw error;
    return data;
  }

  // Sign in with email and password
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
  }

  // Sign out
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  // Get current user
  async getCurrentUser(): Promise<User | null> {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  }

  // Get current session
  async getCurrentSession(): Promise<Session | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  }

  // Check if user is authenticated
  async isAuthenticated(): Promise<boolean> {
    const user = await this.getCurrentUser();
    return !!user;
  }

  // Listen to auth state changes
  onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    return supabase.auth.onAuthStateChange(callback);
  }

  // Create anonymous session for users who don't want to sign up
  async createAnonymousSession(): Promise<string> {
    // Generate a unique anonymous user ID
    const anonymousId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store in localStorage for persistence
    localStorage.setItem('anonymous_user_id', anonymousId);
    
    return anonymousId;
  }

  // Get anonymous user ID
  getAnonymousUserId(): string | null {
    return localStorage.getItem('anonymous_user_id');
  }

  // Check if user is anonymous
  isAnonymous(): boolean {
    return !!this.getAnonymousUserId() && !this.getCurrentUser();
  }
}

export const authService = new AuthService();