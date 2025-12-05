import type { ChatMessage, ChatContextSnapshot } from '../types';

interface ExtractionResult {
  context: ChatContextSnapshot;
  isGoalOriented: boolean;
  summary: string;
}

class ChatContextExtractor {
  private getEdgeFunctionUrl(): string {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error('Supabase URL not configured');
    }
    return `${supabaseUrl}/functions/v1/openai-extract-context`;
  }

  async detectPlanningIntent(messages: ChatMessage[]): Promise<boolean> {
    if (messages.length < 2) return false;

    const userMessages = messages
      .filter(m => m.role === 'user')
      .map(m => m.content.toLowerCase())
      .join(' ');

    const planningKeywords = [
      'plan', 'training plan', 'goal', 'race', 'event', 'prepare',
      'century', 'marathon', 'improve', 'build up', 'get ready',
      'schedule', 'weeks', 'months', 'train for', 'coaching',
      'program', 'structure'
    ];

    return planningKeywords.some(keyword => userMessages.includes(keyword));
  }

  async extractContext(messages: ChatMessage[]): Promise<ExtractionResult> {
    try {
      const response = await fetch(this.getEdgeFunctionUrl(), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to extract context');
      }

      const extracted = await response.json();

      const context: ChatContextSnapshot = {
        goals: extracted.goals || [],
        constraints: extracted.constraints || {},
        preferences: extracted.preferences || {},
        keyMessages: extracted.keyMessages || [],
        confidenceScores: extracted.confidenceScores || {
          goals: 0,
          constraints: 0,
          preferences: 0
        },
        extractedAt: new Date()
      };

      return {
        context,
        isGoalOriented: extracted.isGoalOriented || false,
        summary: extracted.summary || 'Training plan discussion'
      };
    } catch (error) {
      console.error('Context extraction error:', error);
      throw new Error(
        error instanceof Error
          ? error.message
          : 'Failed to extract training context from conversation'
      );
    }
  }

  getConfidenceLevel(score: number): 'high' | 'medium' | 'low' {
    if (score >= 75) return 'high';
    if (score >= 50) return 'medium';
    return 'low';
  }

  hasEnoughContext(context: ChatContextSnapshot): boolean {
    const hasGoals = context.goals.length > 0 && context.confidenceScores.goals >= 50;
    const hasReasonableConfidence =
      Object.values(context.confidenceScores).reduce((sum, score) => sum + score, 0) /
      Object.values(context.confidenceScores).length >= 40;

    return hasGoals && hasReasonableConfidence;
  }
}

export const chatContextExtractor = new ChatContextExtractor();
