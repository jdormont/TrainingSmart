import { analytics } from '../lib/analytics';

export const useAnalytics = () => {
    return {
        track: analytics.track,
        identify: analytics.identify,
        reset: analytics.reset
    };
};
