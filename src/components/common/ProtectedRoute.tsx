import React from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { LoadingSpinner } from './LoadingSpinner';
import { AccountStatus } from '../auth/AccountStatus';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, userProfile, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const isDemo = searchParams.get('demo') === 'true';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" className="text-orange-500" />
      </div>
    );
  }

  // Allow access if user is authenticated OR if it's demo mode
  if (!user && !isDemo) {
    return <Navigate to="/login" replace />;
  }

  // If validated user (not demo), check account status
  if (user && userProfile?.status !== 'APPROVED') {
    return <AccountStatus />;
  }

  // Gate approved users who haven't completed conversational onboarding.
  // Allow through if already on /onboarding to avoid a redirect loop.
  if (user && userProfile?.status === 'APPROVED' && !userProfile.conversational_onboarding_completed && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
};
