import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ouraApi } from '../../services/ouraApi';
import { Button } from '../common/Button';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ROUTES } from '../../utils/constants';

export const DirectOuraAuth: React.FC = () => {
  const [accessToken, setAccessToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleAuthenticate = async () => {
    if (!accessToken.trim()) {
      setError('Please enter your Oura access token');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('Attempting direct Oura authentication with token...');
      
      // Store the token directly
      const tokens = {
        access_token: accessToken.trim(),
        token_type: 'Bearer',
        expires_at: Date.now() + (365 * 24 * 60 * 60 * 1000), // 1 year from now
        refresh_token: '', // Personal access tokens don't have refresh tokens
      };
      
      localStorage.setItem('oura_tokens', JSON.stringify(tokens));
      
      console.log('Oura token stored successfully');
      setSuccess(true);
      
      setTimeout(() => {
        navigate(ROUTES.SETTINGS);
      }, 2000);
      
    } catch (err) {
      console.error('Direct Oura auth error:', err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-purple-500 text-6xl mb-4">🌙</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Oura Ring Connected!
          </h2>
          <p className="text-gray-600 mb-4">
            Redirecting to settings...
          </p>
          <LoadingSpinner size="md" className="text-purple-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
        <div className="text-center mb-6">
          <div className="text-purple-500 text-4xl mb-4">🌙</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Connect Oura Ring Directly
          </h2>
          <p className="text-gray-600">
            Enter your Oura personal access token to connect your ring
          </p>
        </div>

        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-2">
              How to get your Oura access token:
            </h3>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>Go to <a href="https://cloud.ouraring.com/personal-access-tokens" target="_blank" rel="noopener noreferrer" className="underline">Oura Personal Access Tokens</a></li>
              <li>Click "Create New Personal Access Token"</li>
              <li>Give it a name (e.g., "TrainingSmart AI")</li>
              <li>Select scopes: "Personal" and "Daily"</li>
              <li>Copy the generated token and paste it below</li>
            </ol>
          </div>

          <div>
            <label htmlFor="accessToken" className="block text-sm font-medium text-gray-700 mb-2">
              Personal Access Token
            </label>
            <textarea
              id="accessToken"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="Paste your Oura personal access token here..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              rows={3}
            />
            <p className="text-xs text-gray-500 mt-1">
              This token will be stored locally and used to sync your Oura data.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <Button
            onClick={handleAuthenticate}
            loading={loading}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            Connect Oura Ring
          </Button>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <button
            onClick={() => navigate(ROUTES.SETTINGS)}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← Back to Settings
          </button>
        </div>
      </div>
    </div>
  );
};