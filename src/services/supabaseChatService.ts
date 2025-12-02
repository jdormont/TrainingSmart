// Supabase-based chat session service
import { supabase } from './supabaseClient';
import type { ChatSession, ChatMessage } from '../types';

class SupabaseChatService {
  // Get current user ID
  private async getCurrentUserId(): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  }

  // Ensure user is authenticated
  private async ensureAuthenticated(): Promise<string> {
    const userId = await this.getCurrentUserId();
    if (!userId) {
      throw new Error('User must be authenticated to access chat sessions');
    }
    return userId;
  }

  // Convert database row to ChatSession
  private async dbSessionToChatSession(dbSession: any): Promise<ChatSession> {
    // Get messages for this session
    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', dbSession.id)
      .order('timestamp', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      throw error;
    }

    return {
      id: dbSession.id,
      name: dbSession.name,
      description: dbSession.description,
      category: dbSession.category as ChatSession['category'],
      messages: (messages || []).map(msg => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        timestamp: new Date(msg.timestamp)
      })),
      createdAt: new Date(dbSession.created_at),
      updatedAt: new Date(dbSession.updated_at)
    };
  }

  // Get all chat sessions for current user
  async getSessions(): Promise<ChatSession[]> {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) {
        // Return empty array if not authenticated (fallback to localStorage)
        return this.getLocalStorageSessions();
      }

      const { data: sessions, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error fetching sessions:', error);
        // Fallback to localStorage on error
        return this.getLocalStorageSessions();
      }

      // Convert database sessions to ChatSession objects
      const chatSessions = await Promise.all(
        (sessions || []).map(session => this.dbSessionToChatSession(session))
      );

      return chatSessions;
    } catch (error) {
      console.error('Error in getSessions:', error);
      // Fallback to localStorage
      return this.getLocalStorageSessions();
    }
  }

  // Fallback to localStorage sessions
  private getLocalStorageSessions(): ChatSession[] {
    try {
      const stored = localStorage.getItem('chat_sessions');
      if (!stored) return [];
      
      const sessions = JSON.parse(stored);
      return sessions.map((session: any) => ({
        ...session,
        createdAt: new Date(session.createdAt),
        updatedAt: new Date(session.updatedAt),
        messages: session.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }))
      }));
    } catch (error) {
      console.error('Error loading localStorage sessions:', error);
      return [];
    }
  }

  // Create a new chat session
  async createSession(
    name: string, 
    category: ChatSession['category'] = 'general', 
    description?: string
  ): Promise<ChatSession> {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) {
        // Fallback to localStorage
        return this.createLocalStorageSession(name, category, description);
      }

      const { data: session, error } = await supabase
        .from('chat_sessions')
        .insert({
          name,
          description,
          category,
          user_id: userId
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating session:', error);
        throw error;
      }

      const chatSession = await this.dbSessionToChatSession(session);
      
      // Set as active session
      this.setActiveSession(chatSession.id);
      
      return chatSession;
    } catch (error) {
      console.error('Error in createSession:', error);
      // Fallback to localStorage
      return this.createLocalStorageSession(name, category, description);
    }
  }

  // Fallback localStorage session creation
  private createLocalStorageSession(
    name: string, 
    category: ChatSession['category'] = 'general', 
    description?: string
  ): ChatSession {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      name,
      description,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      category
    };

    const sessions = this.getLocalStorageSessions();
    sessions.push(newSession);
    localStorage.setItem('chat_sessions', JSON.stringify(sessions));
    
    this.setActiveSession(newSession.id);
    return newSession;
  }

  // Add message to session
  async addMessageToSession(sessionId: string, message: ChatMessage): Promise<void> {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) {
        // Fallback to localStorage
        return this.addLocalStorageMessage(sessionId, message);
      }

      // Insert message
      const { error: messageError } = await supabase
        .from('chat_messages')
        .insert({
          session_id: sessionId,
          role: message.role,
          content: message.content,
          timestamp: message.timestamp.toISOString(),
          user_id: userId
        });

      if (messageError) {
        console.error('Error adding message:', messageError);
        throw messageError;
      }

      // Update session's updated_at timestamp
      const { error: sessionError } = await supabase
        .from('chat_sessions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', sessionId)
        .eq('user_id', userId);

      if (sessionError) {
        console.error('Error updating session timestamp:', sessionError);
      }
    } catch (error) {
      console.error('Error in addMessageToSession:', error);
      // Fallback to localStorage
      this.addLocalStorageMessage(sessionId, message);
    }
  }

  // Fallback localStorage message addition
  private addLocalStorageMessage(sessionId: string, message: ChatMessage): void {
    const sessions = this.getLocalStorageSessions();
    const sessionIndex = sessions.findIndex(s => s.id === sessionId);
    
    if (sessionIndex !== -1) {
      sessions[sessionIndex].messages.push(message);
      sessions[sessionIndex].updatedAt = new Date();
      localStorage.setItem('chat_sessions', JSON.stringify(sessions));
    }
  }

  // Delete a session
  async deleteSession(sessionId: string): Promise<void> {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) {
        // Fallback to localStorage
        return this.deleteLocalStorageSession(sessionId);
      }

      const { error } = await supabase
        .from('chat_sessions')
        .delete()
        .eq('id', sessionId)
        .eq('user_id', userId);

      if (error) {
        console.error('Error deleting session:', error);
        throw error;
      }

      // Clear active session if it was deleted
      const activeSessionId = this.getActiveSessionId();
      if (activeSessionId === sessionId) {
        this.clearActiveSession();
      }
    } catch (error) {
      console.error('Error in deleteSession:', error);
      // Fallback to localStorage
      this.deleteLocalStorageSession(sessionId);
    }
  }

  // Fallback localStorage session deletion
  private deleteLocalStorageSession(sessionId: string): void {
    const sessions = this.getLocalStorageSessions();
    const filteredSessions = sessions.filter(s => s.id !== sessionId);
    localStorage.setItem('chat_sessions', JSON.stringify(filteredSessions));
    
    const activeSessionId = this.getActiveSessionId();
    if (activeSessionId === sessionId) {
      this.clearActiveSession();
    }
  }

  // Update session
  async updateSession(sessionId: string, updates: Partial<ChatSession>): Promise<void> {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) {
        // Fallback to localStorage
        return this.updateLocalStorageSession(sessionId, updates);
      }

      const { error } = await supabase
        .from('chat_sessions')
        .update({
          name: updates.name,
          description: updates.description,
          category: updates.category,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId)
        .eq('user_id', userId);

      if (error) {
        console.error('Error updating session:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error in updateSession:', error);
      // Fallback to localStorage
      this.updateLocalStorageSession(sessionId, updates);
    }
  }

  // Fallback localStorage session update
  private updateLocalStorageSession(sessionId: string, updates: Partial<ChatSession>): void {
    const sessions = this.getLocalStorageSessions();
    const sessionIndex = sessions.findIndex(s => s.id === sessionId);
    
    if (sessionIndex !== -1) {
      sessions[sessionIndex] = {
        ...sessions[sessionIndex],
        ...updates,
        updatedAt: new Date()
      };
      localStorage.setItem('chat_sessions', JSON.stringify(sessions));
    }
  }

  // Get specific session
  async getSession(sessionId: string): Promise<ChatSession | null> {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) {
        // Fallback to localStorage
        const sessions = this.getLocalStorageSessions();
        return sessions.find(s => s.id === sessionId) || null;
      }

      const { data: session, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Error fetching session:', error);
        return null;
      }

      return await this.dbSessionToChatSession(session);
    } catch (error) {
      console.error('Error in getSession:', error);
      // Fallback to localStorage
      const sessions = this.getLocalStorageSessions();
      return sessions.find(s => s.id === sessionId) || null;
    }
  }

  // Active session management (still uses localStorage for simplicity)
  setActiveSession(sessionId: string): void {
    localStorage.setItem('active_chat_session', sessionId);
  }

  getActiveSessionId(): string | null {
    return localStorage.getItem('active_chat_session');
  }

  clearActiveSession(): void {
    localStorage.removeItem('active_chat_session');
  }

  // Category helpers (unchanged)
  getCategoryColor(category: ChatSession['category']): string {
    const colors = {
      training: 'bg-blue-100 text-blue-800',
      recovery: 'bg-green-100 text-green-800',
      nutrition: 'bg-yellow-100 text-yellow-800',
      goals: 'bg-purple-100 text-purple-800',
      analysis: 'bg-red-100 text-red-800',
      general: 'bg-gray-100 text-gray-800',
      content_preferences: 'bg-orange-100 text-orange-800'
    };
    return colors[category || 'general'];
  }

  getCategoryIcon(category: ChatSession['category']): string {
    const icons = {
      training: '🚴',
      recovery: '😴',
      nutrition: '🥗',
      goals: '🎯',
      analysis: '📊',
      general: '💬',
      content_preferences: '📺'
    };
    return icons[category || 'general'];
  }

  // Migration helper: Move localStorage data to Supabase
  async migrateLocalStorageToSupabase(): Promise<void> {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) {
        console.log('User not authenticated, skipping migration');
        return;
      }

      const localSessions = this.getLocalStorageSessions();
      if (localSessions.length === 0) {
        console.log('No local sessions to migrate');
        return;
      }

      console.log(`Migrating ${localSessions.length} sessions to Supabase...`);

      for (const session of localSessions) {
        // Create session in Supabase
        const { data: newSession, error: sessionError } = await supabase
          .from('chat_sessions')
          .insert({
            name: session.name,
            description: session.description,
            category: session.category,
            user_id: userId,
            created_at: session.createdAt.toISOString(),
            updated_at: session.updatedAt.toISOString()
          })
          .select()
          .single();

        if (sessionError) {
          console.error('Error migrating session:', sessionError);
          continue;
        }

        // Migrate messages
        if (session.messages.length > 0) {
          const messagesToInsert = session.messages.map(msg => ({
            session_id: newSession.id,
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp.toISOString(),
            user_id: userId
          }));

          const { error: messagesError } = await supabase
            .from('chat_messages')
            .insert(messagesToInsert);

          if (messagesError) {
            console.error('Error migrating messages:', messagesError);
          }
        }
      }

      console.log('Migration completed successfully');
      
      // Optionally clear localStorage after successful migration
      // localStorage.removeItem('chat_sessions');
    } catch (error) {
      console.error('Error during migration:', error);
    }
  }
}

export const supabaseChatService = new SupabaseChatService();