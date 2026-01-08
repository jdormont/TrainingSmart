# TrainingSmart AI

## Can I train smarter, not harder?

**TrainingSmart AI** is your personal digital cycling coach. It looks at your actual ride data (from Strava), understands your recovery needs (like how well you slept), and uses advanced AI to give you personalized training advice and plans.

Instead of generic "one-size-fits-all" plans, TrainingSmart AI adapts to *you*.

### Key Features

*   **🏆 Connect with Strava**: Automatically pulls in your ride history so the AI knows your fitness level.
*   **🤖 AI Coach Chat**: Ask questions like "I'm feeling tired today, what should I do?" or "How do I improve my hill climbing?" and get answers based on your real data.
*   **📊 Smart Dashboard**: See your weekly progress, fatigue levels, and personalized tips at a glance.
*   **📅 Custom Training Plans**: Generate a training plan for your specific goal (e.g., "Prepare for a Century Ride in 8 weeks") that fits your schedule. 

*   **📺 Personalized Content**: A "TikTok-style" feed of cycling videos and articles curated by AI to match your specific interests and goals.

---

## Application Guide

Here is a tour of the main features you'll use in TrainingSmart AI:

### 📊 Dashboard
The mission control for your training.
*   **Hero Overview**: A new split-view header showing your Primary Training Focus and top status alerts.
*   **Bio-Aware Recovery**: Weighted recovery score combining **Sleep**, **HRV**, and **Resting Heart Rate**, plus a new **Respiratory Rate** tracker.
*   **Training Trends**: An 8-week lookback at your volume and intensity to prevent overtraining.
*   **Recent Activities**: Quick access to your latest Strava rides with detailed performance metrics.

### 🤖 AI Coach Chat
Talk to a coach who actually knows you.
*   **Context-Aware**: The chatbot automatically receives your recent activity stats and recovery data. You don't have to explain that you did a "hard interval session yesterday" – it already knows.
*   **Session Management**: Create different chat threads for different topics (e.g., "Nutrition", "Race Prep", "Gear Talk").
*   **Create Plans from Chat**: If you discuss a goal with the coach (like "I want to ride 100 miles"), it can detect that intent and offer to build a structured plan for you immediately.

### 📅 Training Plans
Structured paths to hit your goals.
*   **AI Plan Generator**: Tell the app your goal (e.g., "Gran Fondo next month"), your available time (e.g., "6 hours/week"), and your focus areas. It will build a full schedule for you.
*   **Drag-and-Drop Management**: Need to move a workout? Just drag it to a new day. The plan automatically updates.
*   **Strava Reconciliation**: The app links your *actual* rides to your *planned* workouts to track adherence.
*   **Google Calendar Sync**: One-click export of your workouts to your personal Google Calendar so you never miss a session.
*   **Modify Weeks**: Sick or busy? Ask the AI to "rewrite this week" to accommodate your schedule change.

### ⚙️ Settings
Customize your experience.
*   **Integrations**: Connect or disconnect your **Strava**, **Oura Ring**, and **Google Calendar** accounts.
*   **Apple Watch Sync**: Sync your Sleep and HRV data directly from Apple Health using our iOS Shortcut helper.
*   **AI Personality**: You can customize the "System Prompt" of your coach. Want a drill sergeant? A supportive cheerleader? A science-nerd physiologist? You can change the AI's personality to match your motivational style.

---

## How it Works (Under the Hood)

You don't need to be a tech expert to understand how TrainingSmart AI works. Here are the three main parts of the system:

### 1. The Database
We use a secure database (Supabase) to keep your information safe and organized. Think of it like a very smart filing cabinet:
*   **User Profiles**: Stores your preferences and settings.
*   **Training Plans**: Keeps the schedules the AI builds for you.
*   **Workouts**: Breaks down your plan into individual daily sessions (e.g., "Tuesday: 45min Recovery Ride").
*   **Daily Metrics**: Tracks your daily health stats like sleep and heart rate to make sure you aren't overtraining.

### 2. The AI Brain
We use OpenAI (the makers of ChatGPT) to analyze your data. When you ask for advice, the app securely sends your *anonymized* recent stats to the AI, which then acts like a professional coach to give you the best answer.

### 3. Your Data Privacy
Your privacy is our priority.
*   **Strava Compliance**: We only use your Strava data to give you advice right now. We do *not* use it to train the AI models.
*   **Secure Storage**: Your API keys and personal data are stored securely.

---

## How to Run the App

If you want to run this application on your own computer, follow these steps.

### Prerequisites
*   **Node.js**: You need to have Node.js installed. If you don't have it, download it from [nodejs.org](https://nodejs.org/).

### Step-by-Step Guide

1.  **Download the Code**
    Open your terminal (Command Prompt on Windows, Terminal on Mac) and "clone" the repository:
    ```bash
    git clone <repository-url>
    cd TrainingSmart
    ```

2.  **Install Dependencies**
    This installs all the software libraries the app needs to run:
    ```bash
    npm install
    ```

3.  **Configure Keys**
    You need to set up your "keys" for the services we use (Strava, OpenAI).
    *   Duplicate the `.env.example` file and rename it to `.env`.
    *   Open `.env` in a text editor.
    *   Fill in your API keys (you will need to get these from Strava and OpenAI).

4.  **Start the App**
    Run this command to turn on the "Dev Server":
    ```bash
    npm run dev
    ```

5.  **Open in Browser**
    Look at the terminal output. It will usually say something like `Local: http://localhost:5173/`. Copy that address and paste it into your web browser.

That's it! You should now see the TrainingSmart AI login screen.