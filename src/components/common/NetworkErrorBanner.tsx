import React, { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

export const NetworkErrorBanner: React.FC = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    if (isOnline) return null;

    return (
        <div className="bg-red-50 border-b border-red-200">
            <div className="max-w-7xl mx-auto py-3 px-3 sm:px-6 lg:px-8">
                <div className="flex items-center justify-center flex-wrap md:flex-nowrap">
                    <div className="w-0 flex-1 flex items-center justify-center">
                        <span className="flex p-2 rounded-lg bg-red-100">
                            <WifiOff className="h-6 w-6 text-red-600" aria-hidden="true" />
                        </span>
                        <p className="ml-3 font-medium text-red-700 truncate">
                            <span className="md:hidden">You are offline. Check connection.</span>
                            <span className="hidden md:inline">
                                You are currently offline. Some features may not work until connection is restored.
                            </span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
