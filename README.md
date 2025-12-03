# TrainingSmart AI

A personal training assistant web app that integrates Strava activity data with AI-powered training advice and personalized content recommendations.

## 🔒 Security

This application uses Supabase Edge Functions to securely handle all OpenAI API calls on the backend. API keys are stored as Supabase secrets and never exposed to the frontend.

## Features

- 🔗 **Strava Integration**: OAuth authentication and activity data sync
- 🤖 **AI Training Coach**: Personalized advice based on your real training data
- 📊 **Advanced Analytics**: Training trends, weekly stats, and performance insights
- 📺 **Personalized Content Feed**: Curated cycling content based on your interests
- 💬 **Multiple Chat Sessions**: Organized conversations by topic (training, recovery, nutrition, etc.)
- 📋 **Training Plan Generation**: AI-created plans based on your goals and fitness level
- 📅 **Google Calendar Export**: One-way sync of workout plans to your Google Calendar

## Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd trainingsmart-ai
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your API credentials
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

## Environment Variables

Create a `.env` file based on `.env.example`:

```env
# Strava API (get from https://www.strava.com/settings/api)
VITE_STRAVA_CLIENT_ID=your_strava_client_id
VITE_STRAVA_CLIENT_SECRET=your_strava_client_secret  # MOVE TO BACKEND!
VITE_STRAVA_REDIRECT_URI=http://localhost:5173/auth/callback

# OpenAI API (get from https://platform.openai.com/api-keys)
VITE_OPENAI_API_KEY=your_openai_api_key  # MOVE TO BACKEND!

# YouTube API (get from Google Cloud Console)
VITE_YOUTUBE_API_KEY=your_youtube_api_key  # MOVE TO BACKEND!
```

**⚠️ NEVER commit your `.env` file to version control!**

## API Setup

### Strava API
1. Go to [Strava API Settings](https://www.strava.com/settings/api)
2. Create a new application
3. Set Authorization Callback Domain to your domain
4. Copy Client ID and Client Secret

### OpenAI API
1. Go to [OpenAI API Keys](https://platform.openai.com/api-keys)
2. Create a new API key
3. Copy the key (starts with `sk-`)

### YouTube API (Optional)
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable YouTube Data API v3
3. Create credentials (API Key)
4. Copy the API key

### Google Calendar API (Optional)
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable Google Calendar API
4. Go to Credentials → Create Credentials → OAuth 2.0 Client ID
5. Configure OAuth consent screen (add your app name and scopes)
6. Choose "Web application" as application type
7. Add authorized redirect URIs:
   - Development: `http://localhost:5173/settings`
   - Production: `https://yourdomain.com/settings`
8. Copy the Client ID and Client Secret
9. Add required OAuth scope: `https://www.googleapis.com/auth/calendar.events`

## Architecture

- **Frontend**: React + TypeScript + Tailwind CSS
- **State Management**: React hooks + localStorage
- **Charts**: Recharts
- **Icons**: Lucide React
- **Build Tool**: Vite

## Security Recommendations

### For Production Deployment:

1. **Backend API Server**
   ```
   Frontend → Your Backend → External APIs
   ```
   - Keep all API keys server-side
   - Implement user authentication
   - Rate limiting and request validation

2. **Serverless Functions**
   ```
   Frontend → Vercel/Netlify Functions → External APIs
   ```
   - Environment variables stay server-side
   - Automatic scaling
   - Cost-effective for small apps

3. **User-Provided Keys**
   ```
   User enters their own API keys → Stored locally
   ```
   - Users responsible for their own keys
   - No server costs for you
   - Requires user technical knowledge

## Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
1. Check the GitHub issues
2. Review the security guidelines above
3. Ensure proper API key configuration

---

**Remember: Implement proper security measures before deploying to production!**