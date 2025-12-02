// Authentication wrapper component
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { authService } from '../../services/authService';
import { supabaseChatService } from '../../services/supabaseChatService';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAnonymous: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  continueAsGuest: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAnonymous, setIsAnonymous] = useState(false);

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const currentSession = await authService.getCurrentSession();
        setSession(currentSession);
        setUser(currentSession?.user || null);
        
        // Check for anonymous user
        const anonymousId = authService.getAnonymousUserId();
        setIsAnonymous(!!anonymousId && !currentSession?.user);
        
        // Migrate localStorage data if user just signed in
        if (currentSession?.user) {
          await supabaseChatService.migrateLocalStorageToSupabase();
        }
      } catch (error) {
        console.error('Error getting initial session:', error);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = authService.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session);
        setSession(session);
        setUser(session?.user || null);
        setIsAnonymous(false);
        
        if (event === 'SIGNED_IN' && session?.user) {
          // Migrate localStorage data when user signs in
          await supabaseChatService.migrateLocalStorageToSupabase();
        }
        
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      await authService.signIn(email, password);
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const signUp = async (email: string, password: string) => {
    setLoading(true);
    try {
      await authService.signUp(email, password);
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await authService.signOut();
      // Clear anonymous session
      localStorage.removeItem('anonymous_user_id');
      setIsAnonymous(false);
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const continueAsGuest = async () => {
    setLoading(true);
    try {
      await authService.createAnonymousSession();
      setIsAnonymous(true);
    } catch (error) {
      console.error('Error creating anonymous session:', error);
    } finally {
      setLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    session,
    loading,
    isAnonymous,
    signIn,
    signUp,
    signOut,
    continueAsGuest,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};