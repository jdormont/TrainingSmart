# Oura Ring Integration

This document outlines how TrainingSmart integrates with the Oura Cloud API to fetch and display recovery data.

## Overview

The integration uses the **Oura API V2** to retrieve Sleep, Readiness, and Activity data. Authentication is handled via OAuth 2.0.

- **Source Code**: [`src/services/ouraApi.ts`](src/services/ouraApi.ts)
- **Data Consumer**: [`src/hooks/useDashboardData.ts`](src/hooks/useDashboardData.ts)

## Data Freshness & Fetching Strategy
 
To ensure the Recovery Score reflects the user's current state while maintaining performance, the system employs a **Hybrid Persistence** strategy.

### 1. Persistence Layer (`daily_metrics`)

We now mirror Oura data into our own Supabase table `daily_metrics`. This allows:
- **Instant Loading**: Validation data is available immediately without waiting for Oura API.
- **Offline Support**: The dashboard works even if the Oura API is unreachable.
- **Historical Analysis**: We can query trends without rate-limit concerns.

### 2. Synchronization Flow

1. **On Load**: The dashboard immediately renders using the latest data from `daily_metrics`.
2. **Background Sync**: A background process checks the Oura API for new data.
3. **Update**: If new data is found (e.g., this morning's sleep), it is upserted to `daily_metrics` and the UI updates automatically.
4. **Client-Side UUIDs**: We use client-generated UUIDs to ensure idempotent inserts.

### Implications for "Stale" Data

- **Scenario A (Normal)**: User syncs ring to Oura App. Our background sync picks it up. Dashboard updates to "Today".
- **Scenario B (Not Synced)**: If the ring hasn't synced to Oura Cloud, we display the most recent persisted record (usually "Yesterday") with a clear date label.

> [!NOTE]
> The dashboard will dynamically check if the displayed data is from "Today" or older.

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