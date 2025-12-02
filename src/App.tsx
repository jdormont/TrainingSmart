import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Header } from './components/layout/Header';
import { HomePage } from './pages/HomePage';
import { DashboardPage } from './pages/DashboardPage';
import { ChatPage } from './pages/ChatPage';
import { SettingsPage } from './pages/SettingsPage';
import { PlansPage } from './pages/PlansPage';
import { AuthCallback } from './components/auth/AuthCallback';
import { ManualAuth } from './components/auth/ManualAuth';
import { DirectAuth } from './components/auth/DirectAuth';
import { OuraCallback } from './components/auth/OuraCallback';
import { DirectOuraAuth } from './components/auth/DirectOuraAuth';
import { DirectStravaAuth } from './components/auth/DirectStravaAuth';
import { stravaApi } from './services/stravaApi';
import { ROUTES } from './utils/constants';

function App() {
  const isAuthenticated = stravaApi.isAuthenticated();
  
  console.log('App render - isAuthenticated:', isAuthenticated);

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Header />
        <Routes>
          {/* Public routes */}
          <Route path={ROUTES.HOME} element={<HomePage />} />
          <Route path={ROUTES.AUTH_CALLBACK} element={<AuthCallback />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/auth/manual" element={<ManualAuth />} />
          <Route path="/auth/direct" element={<DirectAuth />} />
          <Route path="/auth/strava/direct" element={<DirectStravaAuth />} />
          <Route path="/auth/oura/callback" element={<OuraCallback />} />
          <Route path="/auth/oura/direct" element={<DirectOuraAuth />} />
          
          {/* Protected routes - redirect to home if not authenticated */}
          <Route 
            path={ROUTES.DASHBOARD} 
            element={
              isAuthenticated ? (
                <DashboardPage />
              ) : (
                <Navigate to={ROUTES.HOME} replace />
              )
            } 
          />
          <Route 
            path={ROUTES.CHAT} 
            element={
              isAuthenticated ? (
                <ChatPage />
              ) : (
                <Navigate to={ROUTES.HOME} replace />
              )
            } 
          />
          <Route 
            path={ROUTES.PLANS} 
            element={
              isAuthenticated ? (
                <PlansPage />
              ) : (
                <Navigate to={ROUTES.HOME} replace />
              )
            } 
          />
          <Route 
            path={ROUTES.SETTINGS} 
            element={
              isAuthenticated ? (
                <SettingsPage />
              ) : (
                <Navigate to={ROUTES.HOME} replace />
              )
            } 
          />
          
          {/* Catch all - redirect to appropriate page */}
          <Route 
            path="*" 
            element={<Navigate to={isAuthenticated ? ROUTES.DASHBOARD : ROUTES.HOME} replace />} 
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
