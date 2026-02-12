// src/lib/sentry.ts
// Sentry error tracking configuration
//
// IMPORTANT: Every public function is wrapped in try-catch so that a broken
// or misconfigured Sentry SDK can never crash the app.

let Sentry: typeof import('@sentry/react-native') | null = null;

try {
  Sentry = require('@sentry/react-native');
} catch (e) {
  // Native module failed to load – Sentry is disabled for this session.
  console.warn('[Sentry] Failed to load native module:', e);
}

export function initSentry() {
  try {
    // Only initialize in production or if DSN is provided
    const sentryDSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

    if (!sentryDSN || !Sentry) {
      if (__DEV__) {
        console.log('Sentry DSN not configured or module unavailable – error tracking disabled');
      }
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
      beforeSend(event) {
        // Don't send console.logs as events
        if (event.level === 'log') {
          return null;
        }

        // Scrub sensitive data from breadcrumbs
        if (event.breadcrumbs) {
          event.breadcrumbs = event.breadcrumbs.map(breadcrumb => {
            if (breadcrumb.data) {
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
        'Network request failed',
        'Failed to fetch',
        'Invalid Refresh Token',
        'Refresh Token Not Found',
        'Warning: Cannot update a component',
      ],
    });
  } catch (e) {
    console.warn('[Sentry] initSentry() failed – error tracking disabled:', e);
  }
}

// Helper function to capture errors with context
export function captureError(error: Error, context?: Record<string, any>) {
  try {
    if (!__DEV__ && Sentry) {
      Sentry.captureException(error, { extra: context });
    } else {
      console.error('Error captured:', error, context);
    }
  } catch {
    // Sentry itself failed – swallow silently
  }
}

// Helper function to capture messages
export function captureMessage(message: string, level: 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug' = 'info') {
  try {
    if (!__DEV__ && Sentry) {
      Sentry.captureMessage(message, level);
    } else {
      console.log(`[${level}]`, message);
    }
  } catch {
    // Sentry itself failed – swallow silently
  }
}

// Helper to set user context (called after successful login/bootstrap)
export function setUserContext(user: {
  id: string;
  email?: string;
  role?: string;
  school_code?: string | null;
}) {
  try {
    if (!Sentry) return;
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.role,
    });
    if (user.role) Sentry.setTag('user.role', user.role);
    if (user.school_code) Sentry.setTag('school_code', user.school_code);
  } catch {
    // Sentry itself failed – swallow silently
  }
}

// Helper to clear user context (on logout)
export function clearUserContext() {
  try {
    if (!Sentry) return;
    Sentry.setUser(null);
  } catch {
    // Sentry itself failed – swallow silently
  }
}

// Re-export Sentry for advanced usage (may be null if module failed to load)
export { Sentry };
