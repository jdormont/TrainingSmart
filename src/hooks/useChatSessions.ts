import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabaseClient';
import { ChatSession } from '../types';

export const useChatSessions = () => {
  const queryClient = useQueryClient();

  const fetchSessions = async (): Promise<ChatSession[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*, chat_messages(*)')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching chat sessions:', error);
      throw error;
    }

    return (data || []).map((session: any) => ({
      id: session.id,
      name: session.title || session.name || 'Untitled Chat',
      description: session.summary || session.description,
      messages: (session.chat_messages || []).map((msg: any) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.timestamp)
      })).sort((a: any, b: any) => a.timestamp.getTime() - b.timestamp.getTime()),
      createdAt: new Date(session.created_at),
      updatedAt: new Date(session.updated_at),
      category: session.category || 'general'
    }));
  };

  return useQuery({
    queryKey: ['chat-sessions'],
    queryFn: fetchSessions,
    staleTime: 300000,
  });
};
