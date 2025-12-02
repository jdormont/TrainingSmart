import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { stravaApi } from '../../services/stravaApi';
import { Button } from '../common/Button';
import { ROUTES } from '../../utils/constants';

export const ManualAuth: React.FC = () => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('Please enter the authorization code');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await stravaApi.exchangeCodeForTokens(code.trim());
      console.log('Authentication successful, checking tokens...');
      
      // Verify authentication worked
      if (stravaApi.isAuthenticated()) {
        console.log('User is authenticated, redirecting to dashboard');
        navigate(ROUTES.DASHBOARD);
      } else {
        throw new Error('Authentication failed - no valid tokens stored');
      }
    } catch (err) {
      console.error('Manual auth error:', err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Manual Authentication
          </h2>
          <p className="text-gray-600">
            Copy the authorization code from the Strava callback URL
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-2">
              Authorization Code
            </label>
            <textarea
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Paste the FULL authorization code from the URL here (should be 40+ characters long)..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              rows={3}
            />
            <p className="text-xs text-gray-500 mt-1">
              Look for "code=" in the URL and copy everything after it until the next "&" or end of URL. The code should be 40+ characters long.
            </p>
            {code && (
              <p className="text-xs text-gray-600 mt-1">
                Current code length: {code.trim().length} characters
                {code.trim().length < 30 && (
                  <span className="text-red-500 ml-2">⚠️ Code seems too short</span>
                )}
              </p>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            loading={loading}
            className="w-full"
          >
            Complete Authentication
          </Button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-200">
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