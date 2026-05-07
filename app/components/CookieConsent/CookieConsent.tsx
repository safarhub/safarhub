'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useCookieConsent, CookiePreferences } from './useCookieConsent';

export default function CookieConsent() {
  const {
    shouldShow,
    showPreferences,
    preferences,
    acceptAll,
    rejectAll,
    savePreferences,
    openPreferences,
    closePreferences,
  } = useCookieConsent();

  const [localPreferences, setLocalPreferences] = useState<CookiePreferences>(preferences);
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    setLocalPreferences(preferences);
  }, [preferences, showPreferences]);

  if (!shouldShow || !portalReady) return null;

  const handlePreferenceChange = (key: keyof CookiePreferences) => {
    if (key === 'functional') return; // functional cannot be toggled
    setLocalPreferences((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSavePreferences = () => {
    savePreferences(localPreferences);
  };

  return createPortal(
    <>
      {/* Main consent banner */}
      {!showPreferences && (
        <div className="fixed inset-x-2 bottom-2 z-2147483647 rounded-xl border border-gray-200 bg-white shadow-xl sm:inset-x-0 sm:bottom-0 sm:rounded-none sm:border-x-0 sm:border-b-0 sm:border-t">
          <div className="max-w-7xl mx-auto px-3 py-3 sm:px-6 sm:py-5 lg:px-8">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex-1">
                <h3 className="mb-1 text-sm font-semibold text-gray-900 sm:mb-2 sm:text-lg">
                  Cookie Settings
                </h3>
                <p className="text-xs leading-snug text-gray-600 sm:text-sm">
                  We use cookies to enhance your experience.
                  <span className="hidden sm:inline"> You can choose which types of cookies to accept.</span>{' '}
                  <button
                    onClick={openPreferences}
                    className="text-green-600 hover:text-green-700 font-medium underline"
                  >
                    Learn more
                  </button>
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:flex sm:shrink-0 sm:gap-3">
                <button
                  onClick={rejectAll}
                  className="rounded-lg bg-gray-100 px-2 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200 sm:px-4 sm:py-2 sm:text-sm"
                >
                  Reject All
                </button>
                <button
                  onClick={openPreferences}
                  className="rounded-lg bg-gray-100 px-2 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200 sm:px-4 sm:py-2 sm:text-sm"
                >
                  Manage
                </button>
                <button
                  onClick={acceptAll}
                  className="rounded-lg bg-green-600 px-2 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-700 sm:px-4 sm:py-2 sm:text-sm"
                >
                  Accept All
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preferences modal */}
      {showPreferences && (
        <div className="fixed inset-0 z-2147483647 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Cookie Preferences</h2>
              <button
                onClick={closePreferences}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Close"
              >
                <X size={20} className="text-gray-600" />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-4 space-y-4">
              {/* Functional Cookies */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">Functional Cookies</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Essential for the website to function properly. These cannot be disabled.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={true}
                    disabled
                    className="mt-1 ml-3 w-5 h-5 rounded cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Analytics Cookies */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">Analytics Cookies</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Help us understand how you use the site to improve your experience.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={localPreferences.analytics}
                    onChange={() => handlePreferenceChange('analytics')}
                    className="mt-1 ml-3 w-5 h-5 rounded cursor-pointer"
                  />
                </div>
              </div>

              {/* Marketing Cookies */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">Marketing Cookies</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Used for targeted advertising and marketing campaigns.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={localPreferences.marketing}
                    onChange={() => handlePreferenceChange('marketing')}
                    className="mt-1 ml-3 w-5 h-5 rounded cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Footer buttons */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex gap-3 justify-end">
              <button
                onClick={closePreferences}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePreferences}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
              >
                Save Preferences
              </button>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body
  );
}
