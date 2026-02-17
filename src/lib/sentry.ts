import Constants from 'expo-constants';

let Sentry: typeof import('@sentry/react-native') | null = null;
let devSkippedLogged = false;

try {
  Sentry = require('@sentry/react-native');
} catch (e) {
  if (__DEV__) {
    console.warn('[Sentry] Failed to load native module:', e);
  }
}

function getRelease(): string {
  const slug = Constants.expoConfig?.slug ?? 'classbridge';
  const version = Constants.expoConfig?.version ?? '1.0.0';
  return `${slug}@${version}`;
}

export function initSentry() {
  try {
    const sentryDSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

    if (!sentryDSN || !Sentry) {
      if (__DEV__ && !devSkippedLogged) {
        devSkippedLogged = true;
        console.log('Sentry DSN not configured or module unavailable – error tracking disabled');
      }
      return;
    }

    Sentry.init({
      dsn: sentryDSN,
      environment: __DEV__ ? 'development' : 'production',
      enableNative: true,
      tracesSampleRate: __DEV__ ? 1.0 : 0.2,
      sampleRate: 1.0,
      attachStacktrace: true,
      enabled: !__DEV__ || !!sentryDSN,
      release: getRelease(),
      dist: Constants.expoConfig?.version ?? '1',

      beforeSend(event) {
        if (event.level === 'log' || event.level === 'info' || event.level === 'warning') {
          return null;
        }

        const messages: string[] = [event.message ?? ''];
        const exceptionValues = event.exception?.values ?? [];
        for (const ex of exceptionValues) {
          if (ex.value) messages.push(ex.value);
          if (ex.type) messages.push(ex.type);
        }

        const combined = messages.join(' ');
        const IGNORE_PATTERNS = [
          /Network request failed/i,
          /Failed to fetch/i,
          /fetch (aborted|failed)/i,
          /JWT expired|Invalid Refresh Token|Refresh Token Not found/i,
          /permission denied|row-level security|RLS/i,
          /AuthApiError|AuthSessionMissingError/i,
          /Warning: Cannot update a component/i,
          /AbortError|Request aborted/i,
          /timeout|ETIMEDOUT|ENOTFOUND|ECONNRESET|network error/i,
        ];

        if (IGNORE_PATTERNS.some((re) => re.test(combined))) {
          return null;
        }

        const scrub = (obj: Record<string, unknown> | undefined) => {
          if (!obj) return;
          for (const k of Object.keys(obj)) {
            if (/token|password|secret|auth|key/i.test(k)) {
              obj[k] = '[REDACTED]';
            }
          }
        };

        scrub(event.extra as Record<string, unknown>);
        event.breadcrumbs?.forEach((b) => scrub(b.data as Record<string, unknown>));

        return event;
      },
      ignoreErrors: [
        'Network request failed',
        'Failed to fetch',
        'Invalid Refresh Token',
        'Refresh Token Not Found',
        'Warning: Cannot update a component',
        'AbortError',
        /^Network (request )?failed$/i,
        /^Failed to fetch$/i,
      ],
    });
  } catch (e) {
    if (__DEV__) {
      console.warn('[Sentry] initSentry() failed – error tracking disabled:', e);
    }
  }
}

export function captureError(error: Error, context?: Record<string, any>) {
  try {
    if (!__DEV__ && Sentry) {
      Sentry.captureException(error, { extra: context });
    } else if (__DEV__) {
      console.error('Error captured:', error, context);
    }
  } catch {}
}

export function captureMessage(message: string, level: 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug' = 'info') {
  try {
    if (!__DEV__ && Sentry) {
      Sentry.captureMessage(message, level);
    } else if (__DEV__) {
      console.log(`[${level}]`, message);
    }
  } catch {}
}

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
  } catch {}
}

export function clearUserContext() {
  try {
    if (!Sentry) return;
    Sentry.setUser(null);
  } catch {}
}

export { Sentry };
