import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Zap, Heart, Battery, Snowflake } from 'lucide-react';
import { Button } from '../components/common/Button';
import { useAuth } from '../contexts/AuthContext';
import { stravaApi } from '../services/stravaApi';
import { ROUTES } from '../utils/constants';
import { SmartWorkoutPreview } from '../components/dashboard/SmartWorkoutPreview';
import { Workout, DailyMetric } from '../types';

export const HomePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isStravaAuthenticated, setIsStravaAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const authenticated = await stravaApi.isAuthenticated();
      setIsStravaAuthenticated(authenticated);
    };
    checkAuth();
  }, []);

  // Redirect to dashboard if already authenticated
  useEffect(() => {
      if (user && isStravaAuthenticated) {
          navigate(ROUTES.DASHBOARD);
      }
  }, [user, isStravaAuthenticated, navigate]);

  // Mock data for the SmartWorkoutPreview
  const mockWorkout: Workout = {
    id: 'mock-1',
    name: 'Active Recovery Spin',
    description: 'Light spin to flush out legs',
    scheduledDate: new Date(),
    completed: false,
    type: 'bike',
    intensity: 'recovery',
    duration: 45,
    status: 'planned'
  };

  const mockMetrics: DailyMetric = {
    id: 'mock-metrics-1',
    user_id: 'mock-user',
    date: new Date().toISOString().split('T')[0],
    recovery_score: 35,
    resting_hr: 55,
    hrv: 40,
    sleep_minutes: 420
  };

  return (
    <div className="min-h-screen flex flex-col font-sans text-gray-900">
      
      {/* Hero Section */}
      <div className="relative bg-[#0f1115] text-white overflow-hidden">
        {/* Background Mesh Gradient Effect */}
         <div className="absolute inset-0 z-0 opacity-40">
            <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-orange-600/20 blur-[100px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-blue-600/20 blur-[100px]" />
         </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            
            {/* Left Column: Copy */}
            <div className="space-y-8">
               <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-sm border border-white/10 rounded-full px-3 py-1">
                  <span className="flex h-2 w-2 rounded-full bg-orange-500 animate-pulse"></span>
                  <span className="text-xs font-medium text-orange-200 uppercase tracking-wide">Now in Beta</span>
               </div>
              <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-tight">
                The Coach That <br className="hidden lg:block"/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500">
                  Knows When You're Tired.
                </span>
              </h1>
              <p className="text-xl text-gray-300 max-w-lg leading-relaxed">
                Don't let a static plan burn you out. TrainingSmart AI adapts your daily workout based on your Strava history and recovery metrics.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                 <Button 
                    size="lg" 
                    className="bg-orange-600 hover:bg-orange-700 text-white border-none shadow-lg shadow-orange-900/20 text-lg px-8 py-4 h-auto"
                    onClick={() => navigate('/login')}
                  >
                    Get Started Free
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    className="border-white/20 hover:bg-white/10 text-white text-lg px-8 py-4 h-auto"
                    onClick={() => navigate('/dashboard?demo=true')}
                  >
                    View Live Demo
                  </Button>
              </div>

               <div className="pt-4 flex items-center space-x-4 text-sm text-gray-400">
                  <span>Analyzes data from:</span>
                  <div className="flex space-x-3 opacity-60 grayscale hover:grayscale-0 transition-all duration-300">
                      <span className="font-bold tracking-tight">STRAVA</span>
                      <span className="font-medium">Apple Health</span>
                      <span className="font-serif italic font-bold">ŌURA</span>
                  </div>
               </div>
            </div>

            {/* Right Column: Visual */}
            <div className="relative hidden lg:block perspective-1000">
              <div className="relative transform rotate-y-[-5deg] rotate-x-[5deg] hover:rotate-0 transition-transform duration-500 ease-out">
                 {/* Floating Card Mockup */}
                 <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 to-blue-600 rounded-2xl blur opacity-30"></div>
                 <div className="relative bg-gray-900 rounded-2xl p-2 border border-white/10 shadow-2xl">
                    <SmartWorkoutPreview 
                        nextWorkout={mockWorkout}
                        dailyMetrics={mockMetrics}
                        onViewDetails={() => {}} 
                    />
                 </div>
                 
                 {/* Annotations */}
                 <div className="absolute -right-12 top-20 bg-white/10 backdrop-blur-md border border-white/20 p-3 rounded-xl shadow-xl animate-bounce-slow max-w-[160px]">
                    <div className="flex items-start space-x-2">
                        <Battery className="w-5 h-5 text-red-400 shrink-0" />
                        <div>
                             <p className="text-xs font-bold text-white">Low Readiness</p>
                             <p className="text-[10px] text-gray-300 leading-tight">Plan auto-adjusted to Recovery.</p>
                        </div>
                    </div>
                 </div>
              </div>
            </div>
            
          </div>
        </div>
      </div>

      {/* Feature Grid Section */}
      <div className="py-24 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-16">
                  <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Why Static Plans Fail</h2>
                  <p className="text-lg text-gray-600 max-w-2xl mx-auto">Most training plans assume you're a robot. We build plans for humans with real lives.</p>
              </div>

              <div className="grid md:grid-cols-3 gap-8">
                  {/* Card 1 */}
                  <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                      <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mb-6">
                          <Heart className="w-6 h-6 text-red-600" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-3">Respects Your Physiology</h3>
                      <p className="text-gray-600 leading-relaxed">
                          Had a bad night's sleep? We detect it via Apple Health & Oura and automatically downgrade your intensity for the day.
                      </p>
                  </div>

                  {/* Card 2 */}
                  <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-6">
                          <Snowflake className="w-6 h-6 text-blue-600" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-3">No-Guilt Consistency</h3>
                      <p className="text-gray-600 leading-relaxed">
                          Life happens. Earn "Streak Freezes" so a missed day doesn't kill your momentum. Focus on the long game.
                      </p>
                  </div>

                  {/* Card 3 */}
                  <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                       <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mb-6">
                          <Zap className="w-6 h-6 text-orange-600" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-3">Zero Decision Fatigue</h3>
                      <p className="text-gray-600 leading-relaxed">
                          Don't know what to ride? Generate the perfect session for your current energy level in one click.
                      </p>
                  </div>
              </div>
          </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center">
              <div className="flex items-center space-x-2 mb-4 md:mb-0">
                  <Activity className="w-6 h-6 text-orange-600" />
                  <span className="text-lg font-bold text-gray-900">TrainingSmart AI</span>
              </div>
              <div className="flex space-x-8 text-sm text-gray-500">
                  <a href="#" className="hover:text-orange-600 transition-colors">Privacy Policy</a>
                  <a href="#" className="hover:text-orange-600 transition-colors">Contact Support</a>
                  <a href="#" className="hover:text-orange-600 transition-colors">Terms of Service</a>
              </div>
              <div className="mt-4 md:mt-0 text-sm text-gray-400">
                  © {new Date().getFullYear()} TrainingSmart AI.
              </div>
          </div>
      </footer>

    </div>
  );
};