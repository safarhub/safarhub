import { useState, useEffect } from 'react';

export type ConsentState = 'pending' | 'accepted' | 'rejected';

const COOKIE_CONSENT_KEY = 'cookie_consent';
const COOKIE_PREFERENCES_KEY = 'cookie_preferences';

export interface CookiePreferences {
  analytics: boolean;
  marketing: boolean;
  functional: boolean;
}

export const useCookieConsent = () => {
  const [consent, setConsent] = useState<ConsentState>('pending');
  const [preferences, setPreferences] = useState<CookiePreferences>({
    analytics: false,
    marketing: false,
    functional: true, // functional is always on
  });
  const [showPreferences, setShowPreferences] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Load consent state from localStorage on mount
  useEffect(() => {
    const savedConsent = localStorage.getItem(COOKIE_CONSENT_KEY) as ConsentState | null;
    const savedPreferences = localStorage.getItem(COOKIE_PREFERENCES_KEY);

    if (savedConsent) {
      setConsent(savedConsent);
    }

    if (savedPreferences) {
      try {
        setPreferences(JSON.parse(savedPreferences));
      } catch {
        // Ignore parse errors
      }
    }

    setMounted(true);
  }, []);

  const acceptAll = () => {
    const allPreferences: CookiePreferences = {
      analytics: true,
      marketing: true,
      functional: true,
    };
    setPreferences(allPreferences);
    setConsent('accepted');
    localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted');
    localStorage.setItem(COOKIE_PREFERENCES_KEY, JSON.stringify(allPreferences));
  };

  const rejectAll = () => {
    const rejectedPreferences: CookiePreferences = {
      analytics: false,
      marketing: false,
      functional: true,
    };
    setPreferences(rejectedPreferences);
    setConsent('rejected');
    localStorage.setItem(COOKIE_CONSENT_KEY, 'rejected');
    localStorage.setItem(COOKIE_PREFERENCES_KEY, JSON.stringify(rejectedPreferences));
  };

  const savePreferences = (newPreferences: CookiePreferences) => {
    const preferences: CookiePreferences = {
      ...newPreferences,
      functional: true, // always keep functional
    };
    setPreferences(preferences);
    setConsent('accepted');
    setShowPreferences(false);
    localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted');
    localStorage.setItem(COOKIE_PREFERENCES_KEY, JSON.stringify(preferences));
  };

  const openPreferences = () => {
    setShowPreferences(true);
  };

  const closePreferences = () => {
    setShowPreferences(false);
  };

  return {
    consent,
    preferences,
    shouldShow: mounted && consent === 'pending',
    showPreferences,
    acceptAll,
    rejectAll,
    savePreferences,
    openPreferences,
    closePreferences,
  };
};
