import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { Header } from './components/layout/Header';
import { HomePage } from './pages/HomePage';
import { DashboardPage } from './pages/DashboardPage';
import { ChatPage } from './pages/ChatPage';
import { SettingsPage } from './pages/SettingsPage';
import { PlansPage } from './pages/PlansPage';
import { LearnPage } from './pages/LearnPage';
import { AuthPage } from './components/auth/AuthPage';
import { AuthCallback } from './components/auth/AuthCallback';
import { ManualAuth } from './components/auth/ManualAuth';
import { DirectAuth } from './components/auth/DirectAuth';
import { OuraCallback } from './components/auth/OuraCallback';
import { DirectOuraAuth } from './components/auth/DirectOuraAuth';
import { DirectStravaAuth } from './components/auth/DirectStravaAuth';
import PrivacyPage from './pages/PrivacyPage';
import { ROUTES } from './utils/constants';
import { PostHogPageView } from './components/common/PostHogPageView';

function App() {
  return (
    <Router>
      <PostHogPageView />
      <AuthProvider>
        <div className="min-h-screen bg-slate-950 text-slate-50">
          <Header />
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

            {/* Protected routes */}
            <Route
              path={ROUTES.DASHBOARD}
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path={ROUTES.CHAT}
              element={
                <ProtectedRoute>
                  <ChatPage />
                </ProtectedRoute>
              }
            />
            <Route
              path={ROUTES.PLANS}
              element={
                <ProtectedRoute>
                  <PlansPage />
                </ProtectedRoute>
              }
            />
            <Route
              path={ROUTES.LEARN}
              element={
                <ProtectedRoute>
                  <LearnPage />
                </ProtectedRoute>
              }
            />
            <Route
              path={ROUTES.SETTINGS}
              element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />

            {/* Catch all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;
