import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ouraApi } from '../../services/ouraApi';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ROUTES } from '../../utils/constants';

export const OuraCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        setProcessing(true);
        setDebugInfo('Processing Oura authorization...');
      
        // For client-side flow, the access token comes in the URL fragment, not query params
        const urlFragment = window.location.hash.substring(1);
        const fragmentParams = new URLSearchParams(urlFragment);
        const accessToken = fragmentParams.get('access_token');
        const error = searchParams.get('error');
        const state = searchParams.get('state');
      
        console.log('Oura auth callback received:', {
          accessToken: accessToken ? 'present' : 'missing',
          error,
          state,
          url: window.location.href,
          fragment: urlFragment
        });
      
        if (error) {
          throw new Error(`Oura OAuth error: ${error}`);
        }

        if (!accessToken) {
          throw new Error('No access token received from Oura');
        }

        setDebugInfo('Processing access token...');
        // For client-side flow, we get the token directly
        const tokens = {
          access_token: accessToken,
          token_type: fragmentParams.get('token_type') || 'Bearer',
          expires_at: Date.now() + (parseInt(fragmentParams.get('expires_in') || '3600') * 1000),
          refresh_token: '', // Client-side flow doesn't provide refresh tokens
        };
        
        // Store the tokens directly
        localStorage.setItem('oura_tokens', JSON.stringify(tokens));
        
        setDebugInfo('Success! Redirecting to settings...');
        setTimeout(() => {
          navigate(ROUTES.SETTINGS, { replace: true });
        }, 1000);
        
      } catch (err) {
        console.error('Oura auth callback error:', err);
        setError((err as Error).message);
        setDebugInfo(`Error details: ${(err as Error).message}`);
      } finally {
        setProcessing(false);
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  // Show success message if we have tokens but haven't redirected yet
  if (!processing && !error && ouraApi.isAuthenticated()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-purple-500 text-6xl mb-4">🌙</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Oura Ring Connected!
          </h2>
          <p className="text-gray-600 mb-4">
            Your sleep and recovery data is now synced. Redirecting to settings...
          </p>
          <button
            onClick={() => navigate(ROUTES.SETTINGS)}
            className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-md transition-colors"
          >
            Go to Settings
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
              Oura Authentication Failed
            </h2>
            <p className="text-gray-600 mb-4">{error}</p>
            {debugInfo && (
              <div className="text-xs text-gray-500 mb-4 p-2 bg-gray-100 rounded">
                {debugInfo}
              </div>
            )}
            <button
              onClick={() => navigate(ROUTES.SETTINGS)}
              className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-md transition-colors"
            >
              Back to Settings
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <LoadingSpinner size="lg" className="text-purple-500 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Connecting to Oura Ring
        </h2>
        <p className="text-gray-600">
          Please wait while we connect your Oura account...
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