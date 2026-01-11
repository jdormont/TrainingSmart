import React from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { LoadingSpinner } from './LoadingSpinner';
import { AccountStatus } from '../auth/AccountStatus';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, userProfile, loading } = useAuth();
  const [searchParams] = useSearchParams();
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

  return <>{children}</>;
};
