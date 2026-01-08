import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { analytics } from '../../lib/analytics';

export const PostHogPageView = () => {
    const location = useLocation();

    useEffect(() => {
        analytics.pageView();
    }, [location]);

    return null;
};
