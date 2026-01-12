# Health Balance Metrics

This document explains the calculation logic, inputs, and weighting for the
"Health Balance" spider chart found in the dashboard.

## Overview

The Health Balance score uses a **Dynamic, Relative Scoring Model** to provide a
holistic view of fitness and recovery. Instead of static targets (e.g., "Ride
150 miles"), it compares your **current workload** against your **historical
baselines** (last 6-8 weeks).

**Data Sources:**

- **Strava:** Moving time, heart rate, and activity counts.

**Axes:** The overall score is an equal-weighted average of 5 dimensions:

1. **Load (Volume Management)**
2. **Consistency (Habit Formation)**
3. **Endurance (Long Ride Progression)**
4. **Intensity (Zone Distribution)**
5. **Efficiency (EF Trend)**

---

## 1. Load (Volume Management)

**Goal:** Manage training stress using the **Acute:Chronic Workload Ratio
(ACWR)**.

- **Input:** Moving Time (minutes).
- **Baselines:**
  - **Acute Load:** Sum of duration for the last 7 days.
  - **Chronic Load:** Average weekly duration over the last 42 days (6 weeks).
- **Calculation:** `Ratio = Acute Load / Chronic Load`

**Scoring Logic:**

| Ratio Range   | Score   | Status                         |
| :------------ | :------ | :----------------------------- |
| **1.0 - 1.3** | **100** | **Perfect Progressive Build**  |
| **0.8 - 1.0** | **85**  | **Maintenance**                |
| **1.3 - 1.5** | **80**  | **Aggressive Build**           |
| **< 0.8**     | **60**  | **Detraining Risk**            |
| **> 1.5**     | **70**  | **Injury Risk (Overreaching)** |

---

## 2. Consistency (Habit Formation)

**Goal:** Reward regularity and habit formation.

- **Input:** Count of active training days per week for the last 8 weeks.
- **Calculation:** Standard Deviation (Std Dev) of training days/week.

**Scoring Logic:**

| Std Dev       | Score   | Status                   |
| :------------ | :------ | :----------------------- |
| **< 1.0**     | **100** | **Very Consistent**      |
| **1.0 - 2.0** | **80**  | **Generally Consistent** |
| **> 2.0**     | **40**  | **Erratic Training**     |

---

## 3. Endurance (Long Ride Progression)

**Goal:** Track the capacity to go long, relative to your norms.

- **Input:** Longest ride duration (minutes) of the current week vs the 4-week
  average longest ride.
- **Calculation:** `Ratio = Current Longest / Baseline Average`

**Scoring Logic:**

| Ratio           | Score   | Status                                 |
| :-------------- | :------ | :------------------------------------- |
| **> 1.05**      | **100** | **Building Endurance (> 5% increase)** |
| **0.90 - 1.05** | **90**  | **Maintenance**                        |
| **0.80 - 0.90** | **75**  | **Slight Reduction**                   |
| **< 0.80**      | **60**  | **Regression (< 80% baseline)**        |

---

## 4. Intensity (Zone Distribution)

**Goal:** Reward "Quality Work" (Zone 4+) and polarized training.

- **Input:** Percentage of total time spent in estimated Zone 4+ (Threshold or
  higher).
- **Estimation:**
  - Activities with `Avg HR >= 160bpm` count 90% as High Intensity.
  - Activities with `Max HR >= 170bpm` count 15% as High Intensity (Intervals).

**Scoring Logic:**

| % Time in Z4+ | Score   | Status                   |
| :------------ | :------ | :----------------------- |
| **15% - 25%** | **100** | **Ideal Intensity Dose** |
| **5% - 15%**  | **80**  | **Building Intensity**   |
| **25% - 30%** | **80**  | **High Intensity Dose**  |
| **< 5%**      | **50**  | **Base/Recovery Mode**   |
| **> 30%**     | **60**  | **Burnout Warning**      |

---

## 5. Efficiency (EF Trend)

**Goal:** Track fitness efficiency (Output vs Input).

- **Input:** `Efficiency Factor (EF)` per activity =
  `(Power | Speed) / Heart Rate`.
- **Calculation:** Compare Current Week Avg EF vs 4-Week Baseline Avg EF.
- **Metric:** Percentage trend (`(Current - Baseline) / Baseline`).

**Scoring Logic:**

| Trend      | Score   | Status                     |
| :--------- | :------ | :------------------------- |
| **> 1%**   | **100** | **Efficiency Trending UP** |
| **+/- 1%** | **80**  | **Efficiency Flat**        |
| **< -1%**  | **50**  | **Efficiency Declining**   |
| **N/A**    | **50**  | **Missing Power/HR Data**  |

---

## Data Quality

The system assigns a data quality label:

- **Excellent:** 6+ weeks of history + frequent HR data.
- **Good:** 4+ weeks of history.
- **Limited:** < 4 weeks of history (Scores may be calibrating).
