import * as Sentry from "@sentry/react-native";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

/**
 * Initializes Sentry crash/error reporting. No-ops when no DSN is configured
 * (e.g. local dev) so the app never fails to start because of a missing key.
 */
export function initSentry(): void {
  if (!dsn) return;

  Sentry.init({
    dsn,
    tracesSampleRate: 0.2,
    enableAutoSessionTracking: true,
  });
}

export { Sentry };
