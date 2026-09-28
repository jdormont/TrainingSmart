import { stravaCacheService } from './stravaCacheService';
import { healthMetricsService } from './healthMetricsService';

/**
 * Tool-calling support for the AI coach chat. Mirrors the AIToolDefinition /
 * AIToolCall shapes in supabase/functions/_shared/ai-provider.ts (plain JSON
 * over the wire, so no shared import across the Vite/Deno boundary) — tools
 * are declared here and executed here, never server-side: openai-chat has no
 * user identity or DB access (see CLAUDE.md's secrets-boundary note), so
 * giving the model a live look at this athlete's training data has to happen
 * on the client, which already has both.
 */

export interface CoachingToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface CoachingToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export const COACHING_TOOLS: CoachingToolDefinition[] = [
  {
    name: 'get_load_ratio',
    description:
      "Get the athlete's current acute:chronic training-load ratio (last 7 days vs 42-day chronic average) with its trend and a plain-language risk assessment. Use this before telling an athlete to push harder or back off, instead of guessing from the conversation alone.",
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_power_curve',
    description:
      "Get the athlete's best power output (watts) at standard durations (5s, 1m, 5m, 20m, 60m) over a recent window. Use this to ground FTP, sprint, or endurance discussions in the athlete's actual measured (or HR-estimated) power data.",
    inputSchema: {
      type: 'object',
      properties: {
        windowDays: { type: 'number', description: 'How many days back to look. Defaults to 90.' },
      },
      required: [],
    },
  },
  {
    name: 'get_decoupling_trend',
    description:
      "Get the athlete's aerobic (cardiac) decoupling trend across recent rides with power+HR data — whether heart-rate drift at a given power output is rising (worsening aerobic fitness or accumulating fatigue) or falling (improving aerobic efficiency). Use this before telling an athlete their aerobic base is improving or declining.",
    inputSchema: {
      type: 'object',
      properties: {
        windowDays: { type: 'number', description: 'How many days back to look. Defaults to 60.' },
      },
      required: [],
    },
  },
];

async function getLoadRatioResult(): Promise<Record<string, unknown>> {
  const activities = await stravaCacheService.getActivitiesForStats(60);
  const load = healthMetricsService.calculateLoad(activities);
  const ratioComponent = load.components.find(c => c.name === 'A:C Ratio');

  return {
    acuteChronicRatio: ratioComponent ? parseFloat(String(ratioComponent.value)) : null,
    trend: load.trend,
    assessment: load.suggestion,
  };
}

function readWindowDays(input: Record<string, unknown>): number | undefined {
  return typeof input.windowDays === 'number' && input.windowDays > 0 ? input.windowDays : undefined;
}

/**
 * Executes a tool call the model requested and returns its result serialized
 * as a JSON string (the shape callAI's tool-result messages expect). Never
 * throws — a failed lookup (no Strava connected, no data yet, a query error)
 * comes back as a small JSON error object so the model can tell the athlete
 * why it doesn't have the data, rather than the whole chat turn failing.
 */
export async function executeCoachingTool(toolCall: CoachingToolCall): Promise<string> {
  try {
    switch (toolCall.name) {
      case 'get_load_ratio':
        return JSON.stringify(await getLoadRatioResult());
      case 'get_power_curve':
        return JSON.stringify(await stravaCacheService.getPowerCurveRollup(readWindowDays(toolCall.input)));
      case 'get_decoupling_trend':
        return JSON.stringify(await stravaCacheService.getDecouplingTrend(readWindowDays(toolCall.input)));
      default:
        return JSON.stringify({ error: `Unknown tool: ${toolCall.name}` });
    }
  } catch (err) {
    console.error(`Error executing coaching tool "${toolCall.name}":`, err);
    return JSON.stringify({ error: err instanceof Error ? err.message : 'Tool execution failed' });
  }
}
