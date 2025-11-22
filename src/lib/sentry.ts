// src/lib/sentry.ts
// Sentry error tracking configuration

import * as Sentry from '@sentry/react-native';

export function initSentry() {
  // Only initialize in production or if DSN is provided
  const sentryDSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

  if (!sentryDSN) {
    console.log('Sentry DSN not configured - error tracking disabled');
    return;
  }

  Sentry.init({
    dsn: sentryDSN,

    // Set environment
    environment: __DEV__ ? 'development' : 'production',

    // Enable native crash reporting
    enableNative: true,

    // Enable in-app tracing for performance monitoring
    tracesSampleRate: __DEV__ ? 1.0 : 0.2, // 100% in dev, 20% in production

    // Capture 100% of errors
    sampleRate: 1.0,

    // Attach stack traces to messages
    attachStacktrace: true,

    // Only send events in production (or if specifically enabled)
    enabled: !__DEV__ || !!sentryDSN,

    // Set app version from package.json
    release: 'classbridge@1.0.0',
    dist: '1',

    // Filter out sensitive data
    beforeSend(event, hint) {
      // Don't send console.logs as events
      if (event.level === 'log') {
        return null;
      }

      // Scrub sensitive data from breadcrumbs
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map(breadcrumb => {
          if (breadcrumb.data) {
            // Remove potential passwords, tokens, etc.
            const sanitized = { ...breadcrumb.data };
            Object.keys(sanitized).forEach(key => {
              if (/password|token|secret|key|auth/i.test(key)) {
                sanitized[key] = '[Filtered]';
              }
            });
            breadcrumb.data = sanitized;
          }
          return breadcrumb;
        });
      }

      return event;
    },

    // Ignore certain errors
    ignoreErrors: [
      // Network errors that are not actionable
      'Network request failed',
      'Failed to fetch',

      // Auth token refresh errors (handled gracefully)
      'Invalid Refresh Token',
      'Refresh Token Not Found',

      // Expo development warnings
      'Warning: Cannot update a component',
    ],
  });
}

// Helper function to capture errors with context
export function captureError(error: Error, context?: Record<string, any>) {
  if (!__DEV__) {
    Sentry.captureException(error, {
      extra: context,
    });
  } else {
    console.error('Error captured:', error, context);
  }
}

// Helper function to capture messages
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info') {
  if (!__DEV__) {
    Sentry.captureMessage(message, level);
  } else {
    console.log(`[${level}]`, message);
  }
}

// Helper to set user context
export function setUserContext(user: { id: string; email?: string; role?: string }) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.role,
  });
}

// Helper to clear user context (on logout)
export function clearUserContext() {
  Sentry.setUser(null);
}

// Export Sentry for advanced usage
export { Sentry };
