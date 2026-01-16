# Rider Profile Metrics (Skills)

This document explains the **Rider Profile** (Spider Chart), a gamified visualization of your athletic capabilities. Unlike the "Health Balance" score (which monitors safety and recovery), the Rider Profile scores you on a **Level 1–10** scale to gamify your progress.

## Overview
The profile consists of 5 key Dimensions (Skills). Each level requires meeting specific performance criteria.

| Skill | Metric | Logic |
| :--- | :--- | :--- |
| **Discipline** | Consistency | Days/Week |
| **Stamina** | Endurance | Longest Ride Duration |
| **Punch** | Intensity | % of Time in Zone 4+ |
| **Capacity** | Load | ACWR (Growth Rate) |
| **Form** | Efficiency | Efficiency Factor Trend |

---

## 1. Discipline (Consistency)
**"The Habit Engine"**

*   **Input**: Average training days per week.
*   **Formula**: `Level = min(10, AvgDays * 1.5)`
*   **XP Scaling**: Roughly 1.5 levels per training day.

### Level Guide
*   **Level 10 (Pro)**: ~7 days/week. ("Maximum Discipline")
*   **Level 7 (Puncheur)**: ~5 days/week.
*   **Level 4 (Rouleur)**: ~3 days/week.
*   **Level 1 (Rookie)**: < 1 day/week.

---

## 2. Stamina (Endurance)
**"The Diesel Engine"**

*   **Input**: Duration of your single longest ride this week.
*   **Formula**: `Level = 1 + (Minutes / 30)`
*   **XP Scaling**: +1 Level for every 30 minutes added to your long ride.

### Level Guide
*   **Level 10 (Pro)**: Ride > **4.5 hours** (270 mins).
*   **Level 7 (Puncheur)**: Ride ~ **3 hours**.
*   **Level 5 (Rouleur)**: Ride ~ **2 hours**.
*   **Level 3**: Ride ~ **1 hour**.

---

## 3. Punch (Intensity)
**"The Turbo"**

*   **Input**: Percentage of training time spent in Zone 4 (Threshold) or higher (>160bpm proxy).
*   **Formula**: `Level = 2 + (Zone4% / 2.5)`
*   **XP Scaling**: +1 Level for every 2.5% increase in Zone 4 volume.

### Level Guide
*   **Level 10 (Pro)**: **20%** of total time in Z4+. ("Elite Intensity")
*   **Level 8**: **15%** in Z4+.
*   **Level 6 (Puncheur)**: **10%** in Z4+.
*   **Level 4 (Rouleur)**: **5%** in Z4+.
*   **Level 2**: **0%** (All easy riding).

---

## 4. Capacity (Load)
**"The Sponge"**

*   **Input**: Acute to Chronic Workload Ratio (ACWR).
*   **Formula**: `Level = 5 + (Ratio - 1.0) * 15`
*   **XP Scaling**: Baseline (Ratio 1.0) is Level 5. Growth adds levels. Decline removes levels.

### Level Guide
*   **Level 10 (Pro)**: Ratio **1.3+** (Aggressive Build).
*   **Level 8**: Ratio **1.2** (Steady Growth).
*   **Level 5 (Rouleur)**: Ratio **1.0** (Maintenance).
*   **Level 2**: Ratio **0.8** (Detraining).

---

## 5. Form (Efficiency)
**"The Aero"**

*   **Input**: Efficiency Factor (EF) Trend (Power/HR).
*   **Formula**: `Level = 5 + (Trend% / 0.7)`
*   **XP Scaling**: Baseline (0% change) is Level 5. +1 Level for every +0.7% improvement in efficiency.

### Level Guide
*   **Level 10 (Pro)**: Trend **> +3.5%**. ("Peak Efficiency")
*   **Level 8**: Trend **+2.1%**.
*   **Level 5 (Rouleur)**: Trend **0%** (Stable).
*   **Level 2**: Trend **-2.1%** (Loss of efficiency).

---

## Tiers
The chart color-codes your levels:
*   **Pro (Purple)**: Level 9-10
*   **Puncheur (Orange)**: Level 7-8
*   **Rouleur (Teal)**: Level 4-6
*   **Rookie (Slate)**: Level 1-3
