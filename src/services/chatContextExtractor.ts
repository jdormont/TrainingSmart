import axios from 'axios';
import type { ChatMessage, ChatContextSnapshot } from '../types';

interface ExtractionResult {
  context: ChatContextSnapshot;
  isGoalOriented: boolean;
  summary: string;
}

class ChatContextExtractor {
  private apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  private baseURL = 'https://api.openai.com/v1';

  constructor() {
    if (import.meta.env.PROD && this.apiKey) {
      console.error('🚨 SECURITY WARNING: OpenAI API key exposed in frontend!');
    }
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
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    if (import.meta.env.PROD) {
      throw new Error('🚨 SECURITY: OpenAI API calls blocked in production');
    }

    const conversationText = messages
      .map(m => `${m.role === 'user' ? 'User' : 'Coach'}: ${m.content}`)
      .join('\n\n');

    const extractionPrompt = `Analyze this training coaching conversation and extract structured planning context.

CONVERSATION:
${conversationText}

Extract the following information with confidence scores (0-100):

1. GOALS: What training goals has the user mentioned? (e.g., "complete a century ride", "improve FTP by 20 watts")
2. CONSTRAINTS:
   - Time availability: When can they train? How many hours per week?
   - Equipment: What do they have access to? (indoor trainer, road bike, etc.)
   - Injuries/Limitations: Any physical constraints mentioned?
   - Other: Any other limitations (travel, work schedule, etc.)
3. PREFERENCES:
   - Workout types: What activities do they prefer? (outdoor rides, indoor training, etc.)
   - Intensity preference: Do they prefer hard efforts or steady endurance?
   - Training days: Which days of the week do they prefer to train?

4. KEY MESSAGES: Identify 2-5 most relevant message excerpts that contain important planning information

Respond with ONLY valid JSON in this exact format:
{
  "goals": ["goal 1", "goal 2"],
  "constraints": {
    "timeAvailability": "string or null",
    "equipment": ["item1", "item2"] or [],
    "injuries": ["limitation1"] or [],
    "other": ["other constraint"] or []
  },
  "preferences": {
    "workoutTypes": ["type1", "type2"] or [],
    "intensityPreference": "string or null",
    "trainingDays": [0, 2, 4] or []
  },
  "keyMessages": [
    {
      "messageId": "${messages[0]?.id || 'unknown'}",
      "content": "relevant excerpt from conversation",
      "relevance": "why this message is important for planning"
    }
  ],
  "confidenceScores": {
    "goals": 85,
    "constraints": 70,
    "preferences": 60
  },
  "isGoalOriented": true,
  "summary": "Brief 1-2 sentence summary of what the user wants to achieve"
}

IMPORTANT:
- Return ONLY the JSON object, no other text
- Confidence scores should reflect how explicit the information was (100 = explicitly stated, 50 = inferred, 0 = not mentioned)
- Set isGoalOriented to true if the user has discussed training goals, false otherwise
- Use actual message IDs from the conversation when possible`;

    try {
      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are an expert at analyzing training conversations and extracting structured planning information. Respond only with valid JSON.'
            },
            {
              role: 'user',
              content: extractionPrompt
            }
          ],
          temperature: 0.3,
          max_tokens: 1500
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      const content = response.data.choices[0].message.content;

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to extract JSON from AI response');
      }

      const extracted = JSON.parse(jsonMatch[0]);

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

      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.error?.message || error.message;
        throw new Error(`Failed to extract context: ${message}`);
      }

      throw new Error('Failed to extract training context from conversation');
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
