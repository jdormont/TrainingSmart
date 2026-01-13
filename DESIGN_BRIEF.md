# TrainingSmart AI - Product Design Brief

**TrainingSmart AI** is an intelligent training assistant that transforms Strava
activity data into actionable, bio-aware training plans via a private,
conversational AI coach.

---

## 💎 Primary Value Proposition

1. **Bio-Aware Intelligence**: Your training plan adapts daily to your _actual_
   recovery (Sleep, HRV) and execution, not just a static spreadsheet.
2. **Conversational Command**: Build, modify, and analyze your training
   naturally—"I'm tired today, give me a recovery ride"—without complex UI
   menus.
3. **Privacy-First Focus**: Professional-grade analytics that live on your
   device and calendar, with no data training on your personal activities.

---

## 🎯 Target User Segments

### 1. The Data-Driven Soloist

- **Profile**: Uses Strava, Oura/Garmin; loves numbers but lacks the time to
  analyze them deeply.
- **Need**: Wants the "Pro Coach" insight—_why_ did I fail that
  interval?—without the $300/mo cost.
- **Why Us**: We turn their expensive sensor data into plain-english advice.

### 2. The Time-Crunched Achiever

- **Profile**: Busy professional (30-45yo) with 6-8 hours/week to train.
- **Need**: Efficiency. If a meeting runs late, they need their plan to adapt
  _instantly_.
- **Why Us**: **Intent Chips** and **Calendar Sync** ensure training fits life,
  not the other way around.

---

## 🌟 Standout Differentiators

- **Bio-Aware Training Insights**: We don't just track load; we weight it
  against **Sleep**, **HRV**, and **Resting Heart Rate** to give a daily
  "Readiness Score."
- **Intent Chips**: One-click interventions ("Need Rest", "Short on Time", "Feel
  Fresh") that instantly rewrite the day's workout logic.
- **Midnight Pro UI**: A cohesive, high-contrast dark theme designed to reduce
  eye strain and highlight data vibrancy during late-night planning.
- **Focus Mode**: A streamlined planning interface that keeps the current week
  front-and-center, reducing decision fatigue.

---

## 🔑 Key Features

- **Smart Dashboard**: Split-view hero header with status alerts and 8-week
  **Training Trends** analysis.
- **AI Coach Chat**: Context-aware agent that knows your last 30 rides and can
  build structured plans from conversation.
- **Interactive Planner**: Drag-and-drop scheduling with **Strava
  Reconciliation** (Plan vs Actual adherence).
- **Apple Watch Health Sync**: Private, direct ingestion of health metrics via
  iOS Shortcuts.
- **Guest/Demo Mode**: Frictionless onboarding preview for new users.

---

## 📣 Marketing Angles

- **"Permission to Rest"**: Most apps push you to do more. We use your bio-data
  to tell you when to back off, preventing burnout.
- **"Your Data, Your Coach"**: Stop following generic PDFs. Train with a system
  that knows your FTP history and yesterday's sleep score.
- **"From Insight to Action"**: Don't just look at a graph. Click a button to
  turn that "Fatigue" warning into a "Recovery Week."

---

## 🗺️ User Highlights

- **The Morning Check-in**:
  1. User wakes up, checks **Dashboard**.
  2. Sees "Recovery: 42% (Low)" due to poor sleep.
  3. Clicks **"Need Rest" Intent Chip**.
  4. AI swaps "VO2 Max Intervals" for "Zone 1 Spin".

- **The Sunday Ritual**:
  1. Opens **Plans Page** in **Focus Mode**.
  2. Reviews last week's "Plan vs Actual" adherence (85%).
  3. Drags missed workout to Tuesday.
  4. Clicks **"Export to Calendar"** to sync logistics for the week ahead.

---

## 🛤️ Roadmap

### ✅ Now (Live & Complete)

- **Core**: Strava OAuth, Supabase Persistence, OpenAI Integration.
- **Bio-Awareness**: Health Metrics (Sleep/HRV) + Weighted Recovery Score.
- **Experience**: Midnight Pro Theme, Intent Chips, Planner Focus Mode.
- **Analytics**: PostHog Integration, Training Trends Refactor.

### 🔮 Next (Near Future)

- **Advanced Periodization**: Seasonal planning (Base, Build, Peak) logic in
  Plan Generator.
- **Social & Community**: Share plans or "Challenge" friends.
- **Content Feed Phase 2**: Instagram/RSS integration for personalized learning.

---

## 🎨 Design Philosophy

### 1. Immersion & Focus ("Midnight Pro")

Data should pop, but the interface should recede. We use a deep "Midnight"
palette to make colorful training metrics (Zones, Heart Rate) stand out without
visual clutter.

### 2. Simplicity Over Complexity

Obvious primary actions. Complex tools (like the CSV exporter or raw JSON views)
are tucked away. The "Golden Path"—Check Status -> Adjust Plan -> Ride—is
frictionless.

### 3. User Agency

We suggest, you decide. The AI offers a _recommendation_, but features like
**Intent Chips** and **Drag-and-Drop** put the final decision firmly in the
user's hands.

---

## ⚔️ Differentiation Matrix

| Feature                | TrainingSmart | Generic Plans | Pro Coach  | Strava Premium |
| :--------------------- | :-----------: | :-----------: | :--------: | :------------: |
| **Real Data Analysis** |      ✅       |      ❌       |     ✅     |       ✅       |
| **AI Personalization** |      ✅       |      ❌       | ⚠️ (Human) |       ❌       |
| **Bio-Aware Recovery** |      ✅       |      ❌       |     ✅     |  ⚠️ (Limited)  |
| **Calendar Workouts**  |      ✅       |      ✅       |     ❌     |       ❌       |
| **Privacy First**      |      ✅       |      ⚠️       |     ✅     |       ❌       |
| **Cost**               |     **$**     |     **$**     |  **$$$**   |     **$**      |

---

## 📈 Success Metrics

- **Adherence**: % of planned workouts matched to actual Strava activities.
- **Engagement**: Daily Active Users (DAU) interacting with **Intent Chips** or
  **Chat**.
- **Retention**: 30-day retention of users who sync **Health Metrics** (high
  investment).
- **Conversion**: % of "Demo Mode" users who auth with Strava.
