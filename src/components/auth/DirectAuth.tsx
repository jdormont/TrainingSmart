import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { stravaApi } from '../../services/stravaApi';
import { Button } from '../common/Button';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ROUTES } from '../../utils/constants';

export const DirectAuth: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [code, setCode] = useState('');
  const navigate = useNavigate();

  const handleAuthenticate = async () => {
    if (!code.trim()) {
      setError('Please enter an authorization code');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('Attempting authentication with code:', code);
      await stravaApi.exchangeCodeForTokens(code.trim());
      
      console.log('Authentication successful, checking tokens...');
      
      if (stravaApi.isAuthenticated()) {
        console.log('User is authenticated, setting success state');
        setSuccess(true);
        setTimeout(() => {
          navigate(ROUTES.DASHBOARD);
        }, 2000);
      } else {
        throw new Error('Authentication failed - no valid tokens stored');
      }
    } catch (err) {
      console.error('Direct auth error:', err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-green-500 text-6xl mb-4">✅</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Successfully Connected to Strava!
          </h2>
          <p className="text-gray-600 mb-4">
            Redirecting to your dashboard...
          </p>
          <LoadingSpinner size="md" className="text-green-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Enter Strava Authorization Code
          </h2>
          <p className="text-gray-600">
            Paste the authorization code from your Strava OAuth redirect URL below.
          </p>
        </div>

        <div className="mb-4">
          <label htmlFor="authCode" className="block text-sm font-medium text-gray-700 mb-2">
            Authorization Code
          </label>
          <textarea
            id="authCode"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Paste your Strava authorization code here..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500 font-mono text-sm"
            rows={3}
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
            <p className="text-red-600 text-sm font-semibold mb-2">{error}</p>
            {error.includes('invalid') && (
              <div className="text-xs text-gray-600 space-y-1">
                <p>Common causes:</p>
                <ul className="list-disc list-inside ml-2">
                  <li>Authorization code already used (get a fresh one)</li>
                  <li>Code expired (codes expire after ~10 minutes)</li>
                  <li>Wrong redirect URI in Strava app settings</li>
                </ul>
                <p className="mt-2 font-medium">Solution: Get a new authorization code from Strava</p>
              </div>
            )}
          </div>
        )}

        <Button
          onClick={handleAuthenticate}
          loading={loading}
          className="w-full mb-4"
        >
          {loading ? 'Connecting...' : 'Connect to Strava'}
        </Button>

        <div className="text-center">
          <button
            onClick={() => navigate(ROUTES.HOME)}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};