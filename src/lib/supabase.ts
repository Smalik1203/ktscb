// src/lib/supabase.ts
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';
import { log } from './logger';

// Get Supabase configuration from environment variables
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

log.info('Supabase configuration:', {
  hasUrl: !!SUPABASE_URL,
  hasKey: !!SUPABASE_ANON_KEY,
  urlLength: SUPABASE_URL?.length || 0,
  keyLength: SUPABASE_ANON_KEY?.length || 0
});

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  const errorMsg = `Missing Supabase configuration. 
URL: ${SUPABASE_URL ? 'SET' : 'MISSING'}
KEY: ${SUPABASE_ANON_KEY ? 'SET' : 'MISSING'}
Please check your .env file or EAS build configuration.`;
  log.error(errorMsg);
  log.error('Required variables: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY');
  throw new Error('API KEY INVALID: Supabase configuration is missing. Please rebuild the app with environment variables configured.');
}

// One-time migration to clear any existing SecureStore sessions
const migrateFromSecureStore = async () => {
  try {
    const { getItemAsync, deleteItemAsync } = await import('expo-secure-store');
    
    // Check for any existing session keys and clear them
    const possibleKeys = [
      'supabase.auth.token',
      'sb-mvvzqouqxrtyzuzqbeud-auth-token',
      'cb-session-v1',
      'supabase-session'
    ];
    
    for (const key of possibleKeys) {
      try {
        const existingValue = await getItemAsync(key);
        if (existingValue) {
          log.info(`Found existing SecureStore session for ${key}, clearing it`);
          await deleteItemAsync(key);
        }
      } catch (_error) {
        // Ignore errors - key might not exist
      }
    }
    
    log.info('SecureStore migration completed');
  } catch (error) {
    log.warn('SecureStore migration failed (this is OK if SecureStore is not available):', error);
  }
};

// Run migration once at startup
migrateFromSecureStore();

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false, // RN has no URL callbacks
    storage: AsyncStorage,
    storageKey: 'cb-session-v1',
    flowType: 'pkce', // Use PKCE flow for better security
  },
  db: {
    schema: 'public',
  },
  global: {
    headers: {
      'x-client-info': 'classbridge-mobile',
    },
    fetch: async (url, options = {}) => {
      try {
        const response = await fetch(url, options);
        
        // Check if response is actually JSON before parsing
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const text = await response.text();
          if (!text || text.trim() === '') {
            log.warn('Empty response from Supabase API');
            return new Response(JSON.stringify({ error: 'Empty response' }), {
              status: response.status,
              statusText: response.statusText,
              headers: response.headers,
            });
          }
          
          try {
            JSON.parse(text);
          } catch (parseError) {
            log.error('JSON parse error in Supabase response:', {
              url,
              status: response.status,
              contentType,
              responsePreview: text.substring(0, 200),
            });
            throw new Error(`Invalid JSON response from Supabase: ${text.substring(0, 100)}`);
          }
          
          return new Response(text, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
          });
        }
        
        return response;
      } catch (error: any) {
        log.error('Supabase fetch error:', {
          url,
          error: error.message,
          stack: error.stack,
        });
        throw error;
      }
    },
  },
  // Realtime performance optimizations
  realtime: {
    params: {
      eventsPerSecond: 10, // Throttle realtime events
    },
  },
});

log.info('Supabase client created successfully with AsyncStorage');

// Suppress non-critical refresh token errors in console (app handles them gracefully)
// This error occurs when Supabase tries to refresh an expired/invalid token - it's expected behavior
if (__DEV__) {
  const originalError = console.error;
  console.error = (...args: any[]) => {
    // Only filter Supabase auth refresh token errors - these are non-critical
    const firstArg = args[0];
    const isRefreshTokenError = 
      (typeof firstArg === 'string' && (
        firstArg.includes('Invalid Refresh Token') ||
        firstArg.includes('Refresh Token Not Found') ||
        firstArg.includes('AuthApiError')
      )) ||
      (firstArg?.message && (
        firstArg.message.includes('Invalid Refresh Token') ||
        firstArg.message.includes('Refresh Token Not Found')
      )) ||
      (typeof args[1] === 'string' && args[1].includes('Invalid Refresh Token'));
    
    if (isRefreshTokenError) {
      // Suppress this specific error - it's expected when tokens expire and is handled by AuthContext
      return;
    }
    // Log all other errors normally
    originalError.apply(console, args);
  };
}

// Test Supabase connection (non-blocking, for diagnostics only)
// Note: This should NOT block auth flow - auth can work even if this fails
export const testSupabaseConnection = async () => {
  try {
    // Add timeout to prevent hanging
    const queryPromise = supabase
      .from('schools')
      .select('count')
      .limit(1);
    
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Connection test timeout after 5s')), 5000)
    );

    const { error } = await Promise.race([queryPromise, timeoutPromise]);
    
    if (error) {
      log.warn('Supabase connection test failed (non-critical):', error.message);
      return false;
    }
    
    log.info('Supabase connection test successful');
    return true;
  } catch (error: any) {
    // Handle JSON parse errors
    if (error?.message?.includes('JSON Parse error') || error?.message?.includes('Unexpected character')) {
      log.warn('Supabase returned malformed JSON - check URL and network:', error.message);
    } else if (error?.message?.includes('timeout')) {
      log.warn('Supabase connection test timed out - network issue (non-critical)');
    } else {
      log.warn('Supabase connection test error (non-critical):', error?.message || error);
    }
    return false;
  }
};
