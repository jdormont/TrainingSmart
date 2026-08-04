import { format } from 'date-fns';
import { computeGoalTiming } from '../utils/goalTiming';
import type { AthleteMemoryContext, Goal } from '../types';

const NARRATIVE_MAX_CHARS = 800;
const GOAL_HISTORY_DISPLAY_LIMIT = 3;
const POWER_CURVE_BUCKETS_TO_SHOW = ['5s', '1m', '5m', '20m', '60m'];

function formatDateLabel(isoDate: string): string {
  try {
    return format(new Date(`${isoDate}T00:00:00`), 'MMM d, yyyy');
  } catch {
    return isoDate;
  }
}

function buildActiveGoalSection(goal: Goal | null, today: Date): string {
  if (!goal) return '';

  const timing = computeGoalTiming(goal, today);
  const criteriaLine = goal.successCriteria.length > 0
    ? `\nSuccess criteria: ${goal.successCriteria.map(c => `${c.metric} ${c.target}${c.unit ?? ''}`).join(', ')}`
    : '';

  return `\n\nACTIVE GOAL (this is the athlete's current focus — the only goal that is current):
- ${goal.title}${goal.description ? ` — ${goal.description}` : ''}${timing ? `\n- ${timing.summary}` : ''}${criteriaLine}`;
}

function buildGoalHistorySection(goalHistory: Goal[]): string {
  if (goalHistory.length === 0) return '';

  const lines = goalHistory.slice(0, GOAL_HISTORY_DISPLAY_LIMIT).map(g => {
    const closedDate = g.closedAt ? formatDateLabel(g.closedAt.toISOString().split('T')[0]) : 'unknown date';
    const statusLabel = g.status === 'completed' ? 'Completed' : 'Abandoned';
    const reasonPart = g.closedReason ? `: ${g.closedReason}` : '';
    return `- ${g.title} (${statusLabel} ${closedDate})${reasonPart}`;
  });

  return `\n\nPAST GOALS — background only, NOT current focus. Never refer to these as ongoing, upcoming, or current; use them only to calibrate plan aggressiveness or reference past accomplishments if the athlete brings them up:
${lines.join('\n')}`;
}

function buildProfileSection(profile: AthleteMemoryContext['profile']): string {
  if (!profile) return '';

  const truncatedNarrative = profile.narrative.length > NARRATIVE_MAX_CHARS
    ? `${profile.narrative.slice(0, NARRATIVE_MAX_CHARS)}...`
    : profile.narrative;

  const constraintsParts = [
    profile.constraints.timeAvailability,
    ...(profile.constraints.equipment || []),
    ...(profile.constraints.injuries || []),
    ...(profile.constraints.other || []),
  ].filter(Boolean);
  const constraintsLine = constraintsParts.length > 0 ? `\n- Constraints: ${constraintsParts.join('; ')}` : '';

  const preferenceParts = [
    ...(profile.preferences.workoutTypes || []),
    profile.preferences.intensityPreference,
  ].filter(Boolean);
  const preferencesLine = preferenceParts.length > 0 ? `\n- Preferences: ${preferenceParts.join('; ')}` : '';

  const patternsLine = profile.notablePatterns.length > 0
    ? `\n- Notable patterns: ${profile.notablePatterns.map(p => p.observation).join('; ')}`
    : '';

  if (!truncatedNarrative && !constraintsLine && !preferencesLine && !patternsLine) return '';

  return `\n\nCOACH MEMORY — DURABLE TRAITS (physiology, equipment, standing preferences, recurring behavioral patterns):${truncatedNarrative ? `\n${truncatedNarrative}` : ''}${constraintsLine}${preferencesLine}${patternsLine}`;
}

function buildFtpSection(currentFtp: AthleteMemoryContext['currentFtp'], fallbackFtp?: number): string {
  if (currentFtp) {
    const sourceLabel = currentFtp.confidence === 'estimated' ? ' (estimated)' : '';
    return `\n\nCURRENT FTP: ${currentFtp.ftpWatts}w as of ${formatDateLabel(currentFtp.effectiveDate)}${sourceLabel}`;
  }
  if (fallbackFtp) {
    return `\n\nCURRENT FTP: ${fallbackFtp}w`;
  }
  return '';
}

function buildPowerCurveSection(powerCurve: AthleteMemoryContext['powerCurve']): string {
  if (!powerCurve || powerCurve.activityCount === 0) return '';

  const parts = POWER_CURVE_BUCKETS_TO_SHOW
    .map(bucket => {
      const watts = powerCurve.curve[bucket];
      return watts ? `${bucket}: ${watts}W` : null;
    })
    .filter((p): p is string => p !== null);

  if (parts.length === 0) return '';

  return `\n\nPOWER CURVE (best efforts, last ${powerCurve.windowDays} days): ${parts.join(', ')}`;
}

function buildRecentNotesSection(recentNotes: AthleteMemoryContext['recentNotes']): string {
  if (recentNotes.length === 0) return '';

  const lines = recentNotes.map(n => `- ${formatDateLabel(n.noteDate)}: ${n.note}`);
  return `\n\nRECENT NOTES (rolling 30-day window — one-off observations, not durable):\n${lines.join('\n')}`;
}

/**
 * Assembles the full athlete-memory block injected into AI prompts (chat,
 * plan generation, analysis). Computes all relative-time phrasing live from
 * absolute dates via computeGoalTiming — nothing here is ever stored as text.
 * goalHistory is always rendered under an explicit "background only" heading
 * so a closed goal can never again be presented to the model as current.
 */
export function buildAthleteMemoryBlock(
  memory: AthleteMemoryContext | null | undefined,
  today: Date = new Date(),
  fallbackFtp?: number,
): string {
  if (!memory) {
    return fallbackFtp ? buildFtpSection(null, fallbackFtp) : '';
  }

  return [
    buildActiveGoalSection(memory.activeGoal, today),
    buildGoalHistorySection(memory.goalHistory),
    buildProfileSection(memory.profile),
    buildFtpSection(memory.currentFtp, fallbackFtp),
    buildPowerCurveSection(memory.powerCurve),
    buildRecentNotesSection(memory.recentNotes),
  ].join('');
}
