# Google Calendar Integration Setup Guide

## Overview

The Google Calendar integration allows users to export their workout plans from the app to their Google Calendar. This is a **one-way export** - workouts are added to Google Calendar but don't sync back.

## Features

- 🔐 Secure OAuth 2.0 authentication with Google
- 📅 Export entire weeks of workouts with one click
- 🏃 Export individual workouts from any view
- ✅ Visual indicators showing which workouts are already in calendar
- 🔄 Automatic token refresh for continued access
- 📝 Detailed workout information in calendar events including:
  - Workout type with emoji
  - Duration and distance
  - Intensity level
  - Full workout description
  - Link back to the app

## Setup Instructions

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note your project name for later

### 2. Enable Google Calendar API

1. In your Google Cloud project, go to **APIs & Services** → **Library**
2. Search for "Google Calendar API"
3. Click on it and press **Enable**

### 3. Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Choose **External** user type (unless you have a Google Workspace)
3. Fill in the required information:
   - **App name**: Your app name (e.g., "TrainingSmart AI")
   - **User support email**: Your email
   - **Developer contact information**: Your email
4. Click **Save and Continue**
5. On the **Scopes** page, click **Add or Remove Scopes**
6. Add the following scope:
   - `https://www.googleapis.com/auth/calendar.events`
7. Click **Save and Continue**
8. Add test users if in testing mode (your email and any testers)
9. Click **Save and Continue** and then **Back to Dashboard**

### 4. Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth 2.0 Client ID**
3. Choose **Web application** as the application type
4. Give it a name (e.g., "TrainingSmart Calendar Integration")
5. Add **Authorized redirect URIs**:
   - For development: `http://localhost:5173/settings`
   - For production: `https://yourdomain.com/settings`
6. Click **Create**
7. Copy the **Client ID** and **Client Secret** that appear

### 5. Update Environment Variables

Add the following to your `.env` file:

```env
VITE_GOOGLE_CLIENT_ID=your_client_id_here
VITE_GOOGLE_CLIENT_SECRET=your_client_secret_here
VITE_GOOGLE_REDIRECT_URI=http://localhost:5173/settings
```

**Important**: Never commit your `.env` file to version control!

**Note for WebContainer/Cloud IDEs**: If you're running this in a cloud IDE environment (like StackBlitz, CodeSandbox, or similar), the dynamic preview URLs won't work with Google OAuth. You'll need to either:
- Run the app locally on your machine at `http://localhost:5173`
- Deploy to a stable URL and configure that in Google Cloud Console

### 6. Test the Integration

1. Start your development server: `npm run dev`
2. Navigate to the Settings page
3. Click "Connect Google Calendar"
4. You'll be redirected to Google to authorize access
5. After authorization, you'll be redirected back to Settings
6. You should see "Google Calendar Connected" status

## Using the Integration

### Connecting Your Calendar

1. Go to **Settings** page
2. Find the **Google Calendar Integration** section
3. Click **Connect Google Calendar**
4. Authorize the app in Google's consent screen
5. You'll be redirected back with a success message

### Exporting Workouts

#### Export a Full Week

1. Go to **Plans** page
2. Expand a training plan
3. Switch to **Calendar view** (calendar icon)
4. Click **Export to Calendar** button on any week
5. Confirm the export
6. Workouts will be added to your Google Calendar

#### Export Individual Workouts

1. Go to **Plans** page
2. Find any workout card (in list or calendar view)
3. Click the **calendar icon** on the workout
4. The workout will be added to your calendar

### Visual Indicators

- ✅ Green calendar icon = Already exported to Google Calendar
- 📅 Gray calendar icon = Not yet exported
- Counter showing "X of Y workouts already in calendar"

### Disconnecting

1. Go to **Settings** page
2. In the Google Calendar section, click **Disconnect**
3. Your previously exported events will remain in Google Calendar
4. You can reconnect at any time

## Calendar Event Details

Each exported workout includes:

- **Title**: Workout type emoji + workout name (e.g., "🚴 Endurance Ride")
- **Time**: Scheduled date with default times:
  - Bike/Run/Swim: 6:00 AM
  - Strength: 5:00 PM
  - Rest: 12:00 AM (midnight)
- **Duration**: Based on workout duration
- **Description**: Contains:
  - Workout type
  - Intensity level
  - Duration
  - Distance (if applicable)
  - Full workout description
  - Link back to the app

## Troubleshooting

### "Configuration Error" when connecting

**Problem**: Missing or invalid environment variables

**Solution**:
1. Check your `.env` file has `VITE_GOOGLE_CLIENT_ID` and `VITE_GOOGLE_CLIENT_SECRET`
2. Make sure values match your Google Cloud Console credentials
3. Restart your development server after changing `.env`

### "Failed to exchange code for tokens" or "App doesn't comply with Google's OAuth policy"

**Problem**: Redirect URI mismatch

**Solution**:
1. Go to Google Cloud Console → Credentials
2. Edit your OAuth 2.0 Client ID
3. Make sure `http://localhost:5173/settings` is in Authorized redirect URIs
4. For production, add your production URL
5. **Important**: The redirect URI in your `.env` file must exactly match one registered in Google Cloud Console
6. **WebContainer Issue**: If using a cloud IDE with dynamic preview URLs (like `*.webcontainer-api.io`), Google OAuth won't work because you can't register wildcard domains. Run locally instead.

### "This workout has already been exported"

**Problem**: Trying to export a workout that's already in Google Calendar

**Solution**:
- This is expected behavior to prevent duplicates
- Look for the green calendar icon indicator
- Only workouts without a calendar icon can be exported

### "Google Calendar not connected"

**Problem**: Token expired or connection was disconnected

**Solution**:
1. Go to Settings
2. Click "Connect Google Calendar" again
3. Re-authorize the app

## Security Notes

⚠️ **Important for Production**:

1. The client secret is currently exposed in the frontend
2. Before production deployment, you should:
   - Move OAuth flow to a backend server
   - Store client secret server-side only
   - Proxy all Google Calendar API calls through your backend
3. Never commit your `.env` file to version control
4. Use environment variables in your production hosting platform

## Database Schema

The integration uses the following database table:

```sql
google_calendar_tokens (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)
```

Workouts table was extended with:
```sql
google_calendar_event_id text -- stores the Google Calendar event ID
```

## API Reference

### Google Calendar Service Methods

```typescript
// Check if user has connected their calendar
await googleCalendarService.isConnected(): Promise<boolean>

// Get connection status with timestamp
await googleCalendarService.getConnectionStatus(): Promise<{
  connected: boolean;
  connectedAt?: Date;
}>

// Initiate OAuth flow
googleCalendarService.initiateOAuthFlow(): void

// Handle OAuth callback
await googleCalendarService.handleOAuthCallback(code: string): Promise<void>

// Disconnect calendar
await googleCalendarService.disconnect(): Promise<void>

// Export single workout
await googleCalendarService.exportWorkoutToCalendar(workout: Workout): Promise<string>

// Export multiple workouts
await googleCalendarService.exportWorkoutsToCalendar(workouts: Workout[]): Promise<{
  success: number;
  failed: number;
  errors: string[];
}>
```

## Future Enhancements

Potential improvements for future versions:

- [ ] Two-way sync (update workouts when calendar events change)
- [ ] Custom default workout times
- [ ] Calendar color coding by workout type
- [ ] Bulk delete calendar events
- [ ] Export to specific calendar (not just primary)
- [ ] Recurring workout patterns
- [ ] Reminders and notifications configuration
- [ ] Calendar event templates

## Support

If you encounter issues:

1. Check the console for error messages
2. Verify your Google Cloud Console setup
3. Ensure redirect URIs match exactly
4. Check that the Calendar API is enabled
5. Verify your OAuth consent screen is configured

For more help, refer to:
- [Google Calendar API Documentation](https://developers.google.com/calendar/api/guides/overview)
- [OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server)
