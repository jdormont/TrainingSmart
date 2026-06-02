import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { Header } from './components/layout/Header';
const HomePage = React.lazy(() => import('./pages/HomePage').then(m => ({ default: m.HomePage })));
const DashboardPage = React.lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const ChatPage = React.lazy(() => import('./pages/ChatPage').then(m => ({ default: m.ChatPage })));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const PlansPage = React.lazy(() => import('./pages/PlansPage').then(m => ({ default: m.PlansPage })));
const LearnPage = React.lazy(() => import('./pages/LearnPage').then(m => ({ default: m.LearnPage })));
const PrivacyPage = React.lazy(() => import('./pages/PrivacyPage'));
import { AuthPage } from './components/auth/AuthPage';
import { AuthCallback } from './components/auth/AuthCallback';
import { ManualAuth } from './components/auth/ManualAuth';
import { DirectAuth } from './components/auth/DirectAuth';
import { OuraCallback } from './components/auth/OuraCallback';
import { DirectOuraAuth } from './components/auth/DirectOuraAuth';
import { DirectStravaAuth } from './components/auth/DirectStravaAuth';
import { ConversationalOnboarding } from './components/onboarding/ConversationalOnboarding';
import { ROUTES } from './utils/constants';
import { PostHogPageView } from './components/common/PostHogPageView';
import { useBackgroundSync } from './hooks/useBackgroundSync';

function App() {
  useBackgroundSync();
  return (
    <Router>
      <PostHogPageView />
      <AuthProvider>
        <div className="min-h-screen bg-slate-950 text-slate-50">
          <Header />
          <Suspense fallback={<div className="min-h-screen bg-slate-900 flex items-center justify-center"><div className="text-slate-400 text-sm">Loading...</div></div>}>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<AuthPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path={ROUTES.AUTH_CALLBACK} element={<AuthCallback />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/auth/manual" element={<ManualAuth />} />
              <Route path="/auth/direct" element={<DirectAuth />} />
              <Route path="/auth/strava/direct" element={<DirectStravaAuth />} />
              <Route path="/auth/oura/callback" element={<OuraCallback />} />
              <Route path="/auth/oura/direct" element={<DirectOuraAuth />} />

              {/* Onboarding */}
              <Route
                path="/onboarding"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary>
                      <ConversationalOnboarding />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />

              {/* Protected routes */}
              <Route
                path={ROUTES.DASHBOARD}
                element={
                  <ProtectedRoute>
                    <ErrorBoundary>
                      <DashboardPage />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path={ROUTES.CHAT}
                element={
                  <ProtectedRoute>
                    <ErrorBoundary>
                      <ChatPage />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path={ROUTES.PLANS}
                element={
                  <ProtectedRoute>
                    <ErrorBoundary>
                      <PlansPage />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path={ROUTES.LEARN}
                element={
                  <ProtectedRoute>
                    <ErrorBoundary>
                      <LearnPage />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path={ROUTES.SETTINGS}
                element={
                  <ProtectedRoute>
                    <ErrorBoundary>
                      <SettingsPage />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />

              {/* Catch all */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;
