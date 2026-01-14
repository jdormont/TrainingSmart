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
        setDebugInfo('Processing Oura authorization code...');
      
        // For server-side flow, the code comes in query params
        const code = searchParams.get('code');
        const error = searchParams.get('error');
        const state = searchParams.get('state');
      
        console.log('Oura auth callback received:', {
          code: code ? 'present' : 'missing',
          error,
          state,
          url: window.location.href
        });
      
        if (error) {
          throw new Error(`Oura OAuth error: ${error}`);
        }

        if (!code) {
          // Fallback: Check for hash fragment just in case mixed flow or old cached code
          const urlFragment = window.location.hash.substring(1);
          const fragmentParams = new URLSearchParams(urlFragment);
          const accessToken = fragmentParams.get('access_token');
          
          if (accessToken) {
             console.log('Found legacy access token in hash fragment');
             // Handle legacy flow
             const tokens = {
               access_token: accessToken,
               token_type: fragmentParams.get('token_type') || 'Bearer',
               expires_at: Date.now() + (parseInt(fragmentParams.get('expires_in') || '3600') * 1000),
               refresh_token: '',
             };
             localStorage.setItem('oura_tokens', JSON.stringify(tokens));
             finishSuccess();
             return;
          }

          throw new Error('No authorization code received from Oura');
        }

        setDebugInfo('Exchanging authorization code for tokens...');
        
        // Exchange code for tokens
        await ouraApi.exchangeCodeForTokens(code);
        
        finishSuccess();
        
      } catch (err) {
        console.error('Oura auth callback error:', err);
        setError((err as Error).message);
        setDebugInfo(`Error details: ${(err as Error).message}`);
      } finally {
        setProcessing(false);
      }
    };

    const finishSuccess = () => {
        setDebugInfo('Success! Redirecting to settings...');
        setTimeout(() => {
          navigate(ROUTES.SETTINGS, { replace: true });
        }, 1000);
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