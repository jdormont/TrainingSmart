// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { openaiService } from './openaiApi';
import { executeCoachingTool, COACHING_TOOLS } from './coachingTools';
import type { ChatMessage, StravaAthlete, StravaActivity } from '../types';

vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
    isAxiosError: vi.fn(() => false),
  },
}));

vi.mock('./coachingTools', async importOriginal => {
  const actual = await importOriginal<typeof import('./coachingTools')>();
  return {
    ...actual,
    executeCoachingTool: vi.fn(),
  };
});

function userMessage(content: string): ChatMessage {
  return { id: 'm1', role: 'user', content, timestamp: new Date() };
}

function minimalContext() {
  return {
    athlete: { firstname: 'Test', lastname: 'Athlete', city: '', state: '' } as StravaAthlete,
    recentActivities: [] as StravaActivity[],
    weeklyVolume: { distance: 0, time: 0, activities: 0 },
  };
}

function axiosResponse(data: { content: string; toolCalls?: unknown }) {
  return { data };
}

describe('OpenAIService.getChatResponse tool-calling loop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the final answer directly when the model calls no tools', async () => {
    vi.mocked(axios.post).mockResolvedValueOnce(axiosResponse({ content: 'Just ride Zone 2 today.' }));

    const result = await openaiService.getChatResponse([userMessage('What should I ride today?')], minimalContext());

    expect(result).toBe('Just ride Zone 2 today.');
    expect(axios.post).toHaveBeenCalledTimes(1);
    const [, body] = vi.mocked(axios.post).mock.calls[0];
    expect((body as any).tools).toEqual(COACHING_TOOLS);
  });

  it('executes a requested tool client-side and feeds the result back for a final answer', async () => {
    vi.mocked(axios.post)
      .mockResolvedValueOnce(
        axiosResponse({
          content: '',
          toolCalls: [{ id: 'call-1', name: 'get_load_ratio', input: {} }],
        }),
      )
      .mockResolvedValueOnce(axiosResponse({ content: 'Your load ratio is healthy, keep going.' }));

    vi.mocked(executeCoachingTool).mockResolvedValueOnce(JSON.stringify({ acuteChronicRatio: 1.2, trend: 'improving' }));

    const result = await openaiService.getChatResponse([userMessage('Am I overtraining?')], minimalContext());

    expect(result).toBe('Your load ratio is healthy, keep going.');
    expect(executeCoachingTool).toHaveBeenCalledWith({ id: 'call-1', name: 'get_load_ratio', input: {} });
    expect(axios.post).toHaveBeenCalledTimes(2);

    const [, secondBody] = vi.mocked(axios.post).mock.calls[1];
    const messages = (secondBody as any).messages;
    const assistantToolCallMsg = messages.find((m: any) => m.toolCalls);
    const toolResultMsg = messages.find((m: any) => m.toolResults);
    expect(assistantToolCallMsg.toolCalls).toEqual([{ id: 'call-1', name: 'get_load_ratio', input: {} }]);
    expect(toolResultMsg.toolResults).toEqual([
      { toolCallId: 'call-1', content: JSON.stringify({ acuteChronicRatio: 1.2, trend: 'improving' }) },
    ]);
  });

  it('forces a final text-only call once MAX_TOOL_ROUNDS is exhausted', async () => {
    const toolCallResponse = axiosResponse({
      content: '',
      toolCalls: [{ id: 'call-x', name: 'get_power_curve', input: {} }],
    });
    vi.mocked(axios.post)
      .mockResolvedValueOnce(toolCallResponse)
      .mockResolvedValueOnce(toolCallResponse)
      .mockResolvedValueOnce(toolCallResponse)
      .mockResolvedValueOnce(axiosResponse({ content: 'Here is what I can tell you so far.' }));

    vi.mocked(executeCoachingTool).mockResolvedValue(JSON.stringify({ curve: {} }));

    const result = await openaiService.getChatResponse([userMessage('How is my sprint power trending?')], minimalContext());

    expect(result).toBe('Here is what I can tell you so far.');
    expect(axios.post).toHaveBeenCalledTimes(4);

    const [, finalBody] = vi.mocked(axios.post).mock.calls[3];
    expect((finalBody as any).tools).toBeUndefined();
  });

  it('still surfaces a friendly timeout error through the tool-calling loop', async () => {
    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    vi.mocked(axios.post).mockRejectedValueOnce({ isAxiosError: true, code: 'ECONNABORTED' });

    await expect(
      openaiService.getChatResponse([userMessage('Hi')], minimalContext()),
    ).rejects.toThrow('AI Coach check-in timed out. Please try again.');
  });
});
