# Health Metrics & Rider Profile

TrainingSmart uses a dual-layer approach to monitoring your training status:

1. **Health Balance (Score 0-100):** A tactical view of your current training
   status.
2. **Rider Profile (Level 1-10):** A gamified, long-term view of your
   demonstrated abilities.

## The Rider Profile (Skill Web)

The Rider Profile visualizes your capabilities across 5 dimensions on a 1-10
scale. Your goal is to expand your web by leveling up each skill.

### 1. Discipline (Consistency)

Rewards habit formation and regularity.

- **Metric:** Average Training Days per Week (last 8 weeks).
- **Formula:** Level = `min(10, AvgDays * 1.5)`
- **Benchmarks:**
  - Level 6: 4 days/week
  - Level 9: 6 days/week
  - Level 10: 7 days/week (Machine status)

### 2. Stamina (Endurance)

Rewards stretching your long ride duration.

- **Metric:** Longest Ride Duration (current week).
- **Formula:** `Level = 1 + (Hours * 2)`
- **Benchmarks:**
  - Level 3: 1 Hour
  - Level 5: 2 Hours
  - Level 7: 3 Hours
  - Level 9: 4 Hours+

### 3. Punch (Intensity)

Rewards time spent in the "Hard" zone (Zone 4+).

- **Metric:** Percentage of total time in Zone 4+.
- **Formula:** `Level = 2 + (Percentage / 2.5)`
- **Benchmarks:**
  - Level 4: 5% Hard
  - Level 6: 10% Hard
  - Level 8: 15% Hard (Ideal Polarization)
  - Level 10: 20%+ Hard (Elite)

### 4. Capacity (Load Growth)

Rewards progressive overload (Acute:Chronic Workload Ratio).

- **Metric:** ACWR Ratio.
- **Formula:** `Level = 5 + (Ratio - 1.0) * 15`
- **Benchmarks:**
  - Level 2: 0.8 (Detraining)
  - Level 5: 1.0 (Maintenance)
  - Level 8: 1.2 (Healthy Growth)
  - Level 10: 1.3+ (Aggressive Build)

### 5. Form (Efficiency)

Rewards improvements in Efficiency Factor (Power/HR).

- **Metric:** 4-Week Efficiency Trend.
- **Formula:** `Level = 5 + (Trend% / 0.7)`
- **Benchmarks:**
  - Level 2: -2.1% (Loss)
  - Level 5: 0% (Flat)
  - Level 8: +2.1% (Strong Gains)
  - Level 10: +3.5% (Peak Form)

---

## Health Balance Scores (0-100)

_Legacy tactical scores used for day-to-day guidance._

- **Load:** 100 = ACWR 1.1-1.3.
- **Consistency:** 100 = Std Dev < 0.5.
- **Endurance:** 100 = Longest Ride > 110% Baseline.
- **Intensity:** 100 = Z4 > 15% AND Z3 < 20%.
- **Efficiency:** 100 = Trend > +2%.
