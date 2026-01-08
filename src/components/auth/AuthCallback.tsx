import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { stravaApi } from '../../services/stravaApi';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ROUTES } from '../../utils/constants';
import { analytics } from '../../lib/analytics';

export const AuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [processing, setProcessing] = useState(true);
  const [isAuth, setIsAuth] = useState(false);

  useEffect(() => {
    let hasRun = false;

    const handleCallback = async () => {
      if (hasRun) {
        console.log('Auth callback already processed, skipping duplicate call');
        return;
      }
      hasRun = true;

      const authenticated = await stravaApi.isAuthenticated();
      if (authenticated) {
        console.log('Already authenticated, redirecting to dashboard');
        setIsAuth(true);
        navigate(ROUTES.DASHBOARD, { replace: true });
        return;
      }

      try {
        setProcessing(true);
        setDebugInfo('Processing authorization...');

        const code = searchParams.get('code');
        const error = searchParams.get('error');
        const scope = searchParams.get('scope');

        console.log('Auth callback received:', {
          code: code ? 'present' : 'missing',
          error,
          scope,
          url: window.location.href
        });

        if (error) {
          throw new Error(`OAuth error: ${error}`);
        }

        if (!code) {
          throw new Error('No authorization code received from Strava');
        }

        setDebugInfo('Exchanging code for access tokens...');
        await stravaApi.exchangeCodeForTokens(code);

        // Track successful connection
        analytics.track('provider_connected', { provider: 'strava' });

        setIsAuth(true);
        setDebugInfo('Success! Redirecting to dashboard...');
        setTimeout(() => {
          navigate(ROUTES.DASHBOARD, { replace: true });
        }, 1000);

      } catch (err) {
        console.error('Auth callback error:', err);
        const errorMsg = (err as Error).message;

        if (errorMsg.includes('code: invalid') && await stravaApi.isAuthenticated()) {
          console.log('Code already used but user is authenticated, redirecting');
          navigate(ROUTES.DASHBOARD, { replace: true });
        } else {
          setError(errorMsg);
          setDebugInfo(`Error details: ${errorMsg}`);
        }
      } finally {
        setProcessing(false);
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  // Show success message if we have tokens but haven't redirected yet
  if (!processing && !error && isAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-green-500 text-6xl mb-4">✅</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Successfully Connected!
          </h2>
          <p className="text-gray-600 mb-4">
            Your Strava account has been connected. Redirecting to dashboard...
          </p>
          <button
            onClick={() => navigate(ROUTES.DASHBOARD)}
            className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-md transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
          <div className="text-center">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Authentication Failed
            </h2>
            <p className="text-gray-600 mb-4">{error}</p>
            {debugInfo && (
              <div className="text-xs text-gray-500 mb-4 p-2 bg-gray-100 rounded">
                {debugInfo}
              </div>
            )}
            <button
              onClick={() => navigate(ROUTES.HOME)}
              className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-md transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <LoadingSpinner size="lg" className="text-orange-500 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Completing Authentication
        </h2>
        <p className="text-gray-600">
          Please wait while we connect your Strava account...
        </p>
        {debugInfo && (
          <p className="text-sm text-gray-500 mt-2">
            {debugInfo}
          </p>
        )}
      </div>
    </div>
  );
};