import posthog from 'posthog-js';

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

const isProduction = !!POSTHOG_KEY;

if (isProduction) {
    posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        person_profiles: 'identified_only',
        capture_pageview: false // We'll handle this manually if needed, or rely on router transitions if we add page tracking later
    });
}

export const analytics = {
    isEnabled: isProduction,

    track: (eventName: string, properties?: Record<string, any>) => {
        if (isProduction) {
            posthog.capture(eventName, properties);
        } else {
            console.log(`[Analytics] Track: ${eventName}`, properties);
        }
    },

    identify: (userId: string, traits?: Record<string, any>) => {
        if (isProduction) {
            posthog.identify(userId, traits);
        } else {
            console.log(`[Analytics] Identify: ${userId}`, traits);
        }
    },

    reset: () => {
        if (isProduction) {
            posthog.reset();
        } else {
            console.log('[Analytics] Reset user');
        }
    }
};

export default analytics;
