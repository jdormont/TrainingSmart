# Oura Ring Integration

This document outlines how TrainingSmart integrates with the Oura Cloud API to fetch and display recovery data.

## Overview

The integration uses the **Oura API V2** to retrieve Sleep, Readiness, and Activity data. Authentication is handled via OAuth 2.0.

- **Source Code**: [`src/services/ouraApi.ts`](src/services/ouraApi.ts)
- **Data Consumer**: [`src/hooks/useDashboardData.ts`](src/hooks/useDashboardData.ts)

## Data Freshness & Fetching Strategy

To ensure the Recovery Score reflects the user's current state, the system employs a "Zero-Config" fetching strategy that prioritizes the **latest available data**.

### 1. The 7-Day Window

When the dashboard loads, the app requests data for the **last 7 days**:

```typescript
// src/services/ouraApi.ts
const endDate = format(now, 'yyyy-MM-dd');
const startDate = format(subDays(now, 7), 'yyyy-MM-dd');
```

### 2. Latest Record Selection

The API returns a list of daily summaries for that window. The application iterates through this list and selects the record with the **most recent date**:

```typescript
// src/hooks/useDashboardData.ts
if (recentSleep.length > 0) {
    sleepData = recentSleep.reduce((latest, current) => 
        new Date(current.day) > new Date(latest.day) ? current : latest
    );
}
```

### Implications for "Stale" Data

This logic means the dashboard **always displays data**, even if today's data is missing.

- **Scenario A (Normal):** User wakes up, syncs ring to Oura App. Oura Cloud updates. Dashboard fetches today's data. **Status: Fresh.**
- **Scenario B (Not Synced):** User wakes up but *has not* synced ring to Oura App yet. Oura Cloud has no data for today. Dashboard fetches last 7 days, finds *Yesterday* as the latest record. **Status: Stale (Yesterday's Data).**

> [!NOTE]
> There is currently no UI indicator if the displayed data is from "Today" or "Yesterday". A mismatch might occur if the user checks the dashboard before syncing their ring.

## API Endpoints Used

| Metric Type | Endpoint | Scope |

|Data Type|API Path|Permission Scope|
|---|---|---|
|**Sleep**|`/v2/usercollection/sleep`|`daily`|
|**Readiness**|`/v2/usercollection/daily_readiness`|`daily`|
|**Activity**|`/v2/usercollection/daily_activity`|`daily`|

## Dashboard Usage

The fetched data is passed to the **Recovery Card** component.

- **Component**: [`src/components/dashboard/RecoveryCard.tsx`](src/components/dashboard/RecoveryCard.tsx)

### Metrics Displayed

1. **Sleep Score**: From Oura Sleep data (`score`).
2. **HRV**: Average HRV from Sleep data (`average_hrv`).
3. **Resting HR**: Lowest Heart Rate from Sleep data (`lowest_heart_rate`).
4. **Overall Status**: Derived from Oura Readiness score (`score`).

### Fallback Logic

If Oura is **not connected**, the system falls back to:

1. Apple Health / Manual Sync data (`daily_metrics` table).
2. "No Data" state if neither source is available.

## Oura Data Flow & Usage

This document explains how Oura Ring data is utilized within the TrainingSmart application, specifically in the Dashboard Recovery Tab and Weekly Insights calculation.

### Dashboard Recovery Tab

The Recovery Tab (
RecoveryCard.tsx
) provides a "snapshot" of your current physiological state.

#### Data Source

Hook:
useDashboardData.ts
Method: Fetches
getRecentSleepData()
 and
getRecentReadinessData()
 from ouraApi.
Selection: It selects the single latest available day from the fetched history to display.
Display Logic
The card visualizes three key components of recovery:

Sleep Score:
Source: sleepData.total_sleep_duration and calculated efficiency.
Fallback: If Oura data is missing, we calculate a score based on manually entered
DailyMetric
.
HRV (Heart Rate Variability):
Source: sleepData.average_hrv (Average HRV during sleep).
Display: Raw value in ms + a calculated 0-100 score relative to your baseline.
RHR (Resting Heart Rate):
Source: sleepData.lowest_heart_rate.
Display: Raw value in bpm + a calculated 0-100 score.
Overall Status ("Bio-State")
An Overall Recovery Score (0-100) dictates the gradient color and status text (e.g., "Prime State", "Recovery Needed").

Primary: Uses readinessData.score directly from Oura if available.
Secondary: If no Oura score, calculates a weighted average:
(HRV_Score * 0.5) + (RHR_Score * 0.3) + (Sleep_Score * 0.2)
.
2. Weekly Insights
The Weekly Insight (
WeeklyInsightCard.tsx
) uses a deeper analysis of your historical Oura data to generate coaching advice.

Data Source
Service:
weeklyInsightService.ts
Input: Full arrays of OuraSleepData[] and OuraReadinessData[] (last 30 days).
A. The "Bio-Aware" Matrix (Primary Logic)
The app determines your Recovery Status (Fresh, Fatigued, or Balanced) by comparing your recent metrics (last 3-day average) against your baseline (previous 27 days).

Fatigued: HRV drops >10% OR RHR rises >5bpm.
Fresh: HRV stable/up (>-2% drop) AND RHR stable/down (<2bpm rise).
Balanced: Everything else.
This status is intersected with your Training Volume ("Pacing") to select a specific insight template:

Behind Pace + Fatigued = "Permission to Rest"
Behind Pace + Fresh = "Primed for Performance" (Nudge to train hard)
Ahead of Pace + Fatigued = "Watch Your Load" (Warning)
B. AI Generation (Secondary/Enrichment)
If the matrix logic doesn't trigger a hard-coded scenario, or to enrich the content, the data is fed into an OpenAI prompt.

Prompt Data Includes:

Recovery Trends: Average sleep hours, sleep efficiency %, and readiness score over the last week.
Correlations: The system analyzes if your better bike rides correlate with longer sleep the night before.
Example Prompt sent to AI:
RECOVERY DATA:

- Average sleep: 7.2h/night (88% efficiency)
- Average readiness: 82/100
- Sleep-performance correlations: Available