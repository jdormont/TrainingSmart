import React from 'react';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Activity, Brain, Calendar, Shield } from 'lucide-react';
import { Button } from '../components/common/Button';
import { ContentFeed } from '../components/home/ContentFeed';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { stravaApi } from '../services/stravaApi';
import type { StravaActivity } from '../types';
import { ROUTES } from '../utils/constants';

export const HomePage: React.FC = () => {
  const isAuthenticated = stravaApi.isAuthenticated();
  const [activities, setActivities] = useState<StravaActivity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  
  console.log('HomePage render - isAuthenticated:', isAuthenticated);

  // Load activities for content feed when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const loadActivities = async () => {
        try {
          setLoadingActivities(true);
          const activitiesData = await stravaApi.getActivities(1, 30);
          setActivities(activitiesData);
        } catch (error) {
          console.error('Failed to load activities for content feed:', error);
        } finally {
          setLoadingActivities(false);
        }
      };
      loadActivities();
    }
  }, [isAuthenticated]);
  
  // If user is already authenticated, show different content
  if (isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Welcome Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-8">
              <Activity className="w-12 h-12 text-orange-500" />
            </div>
            
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Welcome to TrainingSmart AI
            </h1>
            
            <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
              Your personalized cycling training hub with AI coaching and curated content
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to={ROUTES.DASHBOARD}>
                <Button size="lg" className="text-lg px-8 py-4">
                  Go to Dashboard
                </Button>
              </Link>
              <Link to={ROUTES.CHAT}>
                <Button variant="outline" size="lg" className="text-lg px-8 py-4">
                  Chat with AI Coach
                </Button>
              </Link>
            </div>
          </div>

          {/* Content Feed */}
          {loadingActivities ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
              <div className="text-center">
                <LoadingSpinner size="lg" className="text-orange-500 mb-4" />
                <p className="text-gray-600">Loading your personalized content...</p>
              </div>
            </div>
          ) : (
            <ContentFeed activities={activities} />
          )}
        </div>
      </div>
    );
  }

  const handleConnectStrava = () => {
    try {
      const authUrl = stravaApi.generateAuthUrl();
      window.location.href = authUrl;
    } catch (error) {
      alert(`Configuration Error: ${(error as Error).message}\n\nPlease check your .env file and make sure you have valid Strava API credentials.`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white">
      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="text-center">
          <div className="flex justify-center mb-8">
            <Activity className="w-16 h-16 text-orange-500" />
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            TrainingSmart
            <span className="text-orange-500"> AI</span>
          </h1>
          
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Your personal training assistant that analyzes your real Strava data 
            to provide AI-powered coaching advice and intelligent training plans.
          </p>

          <Button
            onClick={handleConnectStrava}
            size="lg"
            className="text-lg px-8 py-4"
          >
            Connect with Strava
          </Button>
          
          <p className="text-sm text-gray-500 mt-4">
            Connect your Strava account to get started with personalized training insights
          </p>
          
          <div className="mt-4">
            <Link 
              to="/auth/direct"
              className="text-sm text-orange-600 hover:text-orange-700 underline"
            >
              Having trouble? Try direct authentication
            </Link>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="text-center">
            <div className="bg-orange-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Activity className="w-8 h-8 text-orange-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Real Data Analysis
            </h3>
            <p className="text-gray-600">
              Uses your actual Strava activities, not generic fitness advice
            </p>
          </div>

          <div className="text-center">
            <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Brain className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              AI-Powered Coaching
            </h3>
            <p className="text-gray-600">
              Chat with an AI coach that knows your training history intimately
            </p>
          </div>

          <div className="text-center">
            <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Smart Scheduling
            </h3>
            <p className="text-gray-600">
              Generate training plans that fit your schedule and goals
            </p>
          </div>

          <div className="text-center">
            <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Privacy First
            </h3>
            <p className="text-gray-600">
              Your data stays secure and is only used to improve your training
            </p>
          </div>
        </div>
      </div>

      {/* How It Works Section */}
      <div className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              How It Works
            </h2>
            <p className="text-lg text-gray-600">
              Get personalized training advice in three simple steps
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-orange-500 text-white w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                1
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Connect Strava
              </h3>
              <p className="text-gray-600">
                Securely link your Strava account to import your training history
              </p>
            </div>

            <div className="text-center">
              <div className="bg-orange-500 text-white w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                2
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Chat with AI
              </h3>
              <p className="text-gray-600">
                Ask questions about your training and get personalized advice
              </p>
            </div>

            <div className="text-center">
              <div className="bg-orange-500 text-white w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                3
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Follow Your Plan
              </h3>
              <p className="text-gray-600">
                Get structured training plans based on your goals and data
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};