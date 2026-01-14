import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { log } from '../lib/logger';

/** Auth state machine */
type AuthStatus = 'checking' | 'signedIn' | 'signedOut' | 'accessDenied';

type Profile = {
  auth_id: string;
  role: string;
  school_code: string | null;
  school_name: string | null;
  class_instance_id: string | null;
  full_name: string | null;
  email: string | null;
} | null;

type AuthState = {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  profile: Profile;
  /** true while fetching user profile / app context after auth */
  bootstrapping: boolean;
  /** changes on each sign-in / token change to invalidate stale async work */
  sessionVersion: string;
  accessDeniedReason?: string;
  accessDeniedEmail?: string;
};

type AuthContextValue = AuthState & {
  /** Force-refresh the session + bootstrap (keeps signed-in state on errors) */
  refresh: () => Promise<void>;
  /** Sign out the user */
  signOut: () => Promise<void>;
  /** UI helper: true if we should show a blocking loader */
  loading: boolean;
};

const AuthContext = createContext<AuthContextValue>({
  status: 'checking',
  session: null,
  user: null,
  profile: null,
  bootstrapping: false,
  sessionVersion: 'init',
  refresh: async () => { },
  signOut: async () => { },
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    status: 'checking',
    session: null,
    user: null,
    profile: null,
    bootstrapping: false,
    sessionVersion: 'init',
  });

  // Prevent duplicate bootstrap for same session version
  const lastBootstrappedVersion = React.useRef<string>('');

  /** Guard against duplicate bootstrap for same session version */
  const maybeBootstrap = (session: Session, version: string) => {
    if (lastBootstrappedVersion.current === version) {
      log.warn('Bootstrap skipped – already bootstrapped this version');
      return;
    }
    lastBootstrappedVersion.current = version;
    setState((prev) => ({ ...prev, bootstrapping: true }));
    bootstrapUser(session, version);
  };

  // Removed verbose debug logging - only log errors and warnings

  /** Bootstrap user profile; never flips auth to signedOut on errors. */
  const bootstrapUser = async (session: Session, version: string) => {
    // mark bootstrapping true immediately
    setState((prev) => ({ ...prev, bootstrapping: true }));

    const user = session.user;

    // Timeout/abort protection
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      log.warn('DB bootstrap timeout (15s) – aborting');
      controller.abort();
    }, 15_000);

    try {
      // Removed verbose bootstrap logging

      // Fetch profile
      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('id, role, school_code, class_instance_id, full_name, email')
        .eq('id', user.id)
        .abortSignal(controller.signal)
        .maybeSingle();

      // Fetch school name if school_code exists
      let schoolName: string | null = null;
      if (userProfile?.school_code && !profileError) {
        const { data: schoolData } = await supabase
          .from('schools')
          .select('school_name')
          .eq('school_code', userProfile.school_code)
          .abortSignal(controller.signal)
          .maybeSingle();

        schoolName = schoolData?.school_name || null;
      }

      clearTimeout(timeout);

      // Discard stale results from a previous session by checking if version changed
      let stillCurrent = true;
      setState((prev) => {
        stillCurrent = prev.sessionVersion === version;
        return prev;
      });

      if (!stillCurrent) {
        log.warn('Bootstrap result ignored – sessionVersion changed');
        return;
      }

      if (profileError) {
        log.error('Profile fetch error during bootstrap', {
          error: profileError,
          authId: user.id,
          email: user.email,
        });
        // Sign out user if profile fetch fails - they need to log in again
        setState((prev) => ({
          ...prev,
          status: 'accessDenied',
          accessDeniedReason: 'Profile fetch failed. Please try logging in again.',
          accessDeniedEmail: user.email ?? undefined,
          bootstrapping: false,
          profile: null,
        }));
        // Sign out from Supabase as well
        setTimeout(() => {
          supabase.auth.signOut().catch((e) => {
            log.warn('Failed to sign out after profile error', e);
          });
        }, 100);
        return;
      }

      if (!userProfile) {
        log.error('User profile not found – access denied', { authId: user.id, email: user.email });
        setState((prev) => ({
          ...prev,
          status: 'accessDenied',
          accessDeniedReason: 'No profile found in system. Please contact administrator.',
          accessDeniedEmail: user.email ?? undefined,
          bootstrapping: false,
          profile: null,
        }));
        return;
      }

      if (userProfile.role === 'unknown') {
        log.error('User has unknown role – access denied', { authId: user.id, email: user.email });
        setState((prev) => ({
          ...prev,
          status: 'accessDenied',
          accessDeniedReason: 'Account not properly configured. Please contact administrator.',
          accessDeniedEmail: user.email ?? undefined,
          bootstrapping: false,
          profile: null,
        }));
        return;
      }

      // Success - only set signedIn if we have a valid profile
      const profile: Profile = {
        auth_id: user.id,
        role: userProfile.role,
        school_code: userProfile.school_code,
        school_name: schoolName,
        class_instance_id: userProfile.class_instance_id,
        full_name: userProfile.full_name,
        email: userProfile.email,
      };

      setState((prev) => ({
        ...prev,
        status: 'signedIn',
        session,
        user,
        profile,
        bootstrapping: false,
      }));

      // Removed verbose session persistence logging
    } catch (e: any) {
      clearTimeout(timeout);
      if (e?.name === 'AbortError') {
        log.warn('Bootstrap aborted due to timeout');
      } else {
        log.error('Unexpected error during bootstrap', {
          name: e?.name,
          message: e?.message,
        });
      }
      // Stay signed-in, just mark bootstrap done so UI can show retry affordances.
      setState((prev) => ({ ...prev, bootstrapping: false }));
    }
  };

  /** Initial session + subscription */
  useEffect(() => {
    let alive = true;

    // According to Supabase best practices, we should primarily rely on onAuthStateChange
    // for initial session. getSession() is called as a fallback but shouldn't block.
    const prime = async () => {
      try {
        // Try to get session with timeout (non-blocking - onAuthStateChange will handle it)
        // This is just to get initial state faster
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((resolve) =>
          setTimeout(() => resolve({ data: { session: null } }), 5000)
        );

        const result = await Promise.race([sessionPromise, timeoutPromise]);
        const session = (result as { data: { session: Session | null } })?.data?.session ?? null;

        if (!alive) return;

        // Only update if we got a session (onAuthStateChange will handle the rest)
        if (session) {
          const version = `${session.user.id}:${session.expires_at || Date.now()}`;
          setState((prev) => ({
            ...prev,
            status: 'signedIn',
            session,
            user: session.user,
            sessionVersion: version,
          }));
          maybeBootstrap(session, version);
        } else {
          // No session found - onAuthStateChange will confirm this
          setState((prev) => ({
            ...prev,
            status: 'signedOut',
            session: null,
            user: null,
          }));
        }
      } catch (e: any) {
        // Handle JSON parse errors (malformed Supabase response)
        if (e?.message?.includes('JSON Parse error') || e?.message?.includes('Unexpected character')) {
          log.error('JSON parse error in auth - clearing corrupted session', {
            error: e?.message,
            name: e?.name,
          });
          // Clear potentially corrupted session data
          try {
            await AsyncStorage.removeItem('cb-session-v1');
            await AsyncStorage.removeItem('supabase.auth.token');
            await supabase.auth.signOut();
          } catch (cleanupError) {
            log.warn('Failed to cleanup corrupted session', cleanupError);
          }
        }
        // Handle invalid refresh token error
        else if (e?.message?.includes('Invalid Refresh Token') || e?.message?.includes('Refresh Token Not Found')) {
          log.warn('Invalid refresh token - clearing session');
          supabase.auth.signOut().catch(() => { });
        }
        else {
          log.warn('Initial session check failed (non-critical - onAuthStateChange will handle)', {
            error: e?.message,
            name: e?.name,
          });
        }
        // Don't set signedOut here - let onAuthStateChange handle it
      }
    };

    prime();

    // Primary auth state handler - Supabase best practice
    // This is the authoritative source for auth state changes
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!alive) return;

      // Handle SIGNED_OUT or no session
      if (event === 'SIGNED_OUT' || !session) {
        setState((prev) => ({
          ...prev,
          status: 'signedOut',
          session: null,
          user: null,
          profile: null,
          bootstrapping: false,
          sessionVersion: `${Date.now()}:${Math.random().toString(36).slice(2)}`,
        }));
        return;
      }

      // Handle SIGNED_IN or INITIAL_SESSION (Supabase fires INITIAL_SESSION on startup)
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
        const version = `${session.user.id}:${session.expires_at || Date.now()}`;
        setState((prev) => ({
          ...prev,
          status: 'signedIn',
          session,
          user: session.user,
          sessionVersion: version,
          // bootstrapping true gets set inside maybeBootstrap
        }));
        maybeBootstrap(session, version);
        return;
      }

      // Handle TOKEN_REFRESHED - update session but don't restart bootstrap
      if (event === 'TOKEN_REFRESHED' && session) {
        const version = `${session.user.id}:${session.expires_at || Date.now()}`;
        setState((prev) => ({
          ...prev,
          session,
          user: session.user,
          sessionVersion: version,
        }));
      }
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // subscribe once

  const api = useMemo<AuthContextValue>(() => {
    const loading = state.status === 'checking' || state.bootstrapping;

    async function refresh() {
      try {
        // Use timeout but make it non-blocking
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((resolve) =>
          setTimeout(() => resolve({ data: { session: null } }), 8000)
        );

        const result = await Promise.race([sessionPromise, timeoutPromise]);
        const session = (result as { data: { session: Session | null } })?.data?.session ?? null;

        if (session) {
          const version = `${session.user.id}:${session.expires_at || Date.now()}`;
          setState((prev) => ({
            ...prev,
            status: 'signedIn',
            session,
            user: session.user,
            sessionVersion: version,
            bootstrapping: true,
          }));
          await bootstrapUser(session, version);
        } else {
          setState((prev) => ({ ...prev, status: 'signedOut', profile: null }));
        }
      } catch (e: any) {
        // Handle JSON parse errors
        if (e?.message?.includes('JSON Parse error') || e?.message?.includes('Unexpected character')) {
          log.error('JSON parse error during refresh - clearing session', e);
          // Clear corrupted session
          try {
            await AsyncStorage.removeItem('cb-session-v1');
            await supabase.auth.signOut();
          } catch (cleanupError) {
            log.warn('Failed to cleanup session during refresh', cleanupError);
          }
        }
        log.error('Auth refresh error', e);
        setState((prev) => ({ ...prev, status: 'signedOut', profile: null }));
      }
    }

    async function signOut() {
      try {
        // Get current push token before signing out
        const pushToken = await AsyncStorage.getItem('pushToken');

        // Sign out from Supabase
        await supabase.auth.signOut();

        // Remove push token from database (token hygiene)
        if (pushToken) {
          const { removePushToken } = await import('../services/notifications');
          await removePushToken(pushToken);
          await AsyncStorage.removeItem('pushToken');
        }
      } finally {
        setState((prev) => ({
          ...prev,
          status: 'signedOut',
          session: null,
          user: null,
          profile: null,
          bootstrapping: false,
          sessionVersion: `${Date.now()}:${Math.random().toString(36).slice(2)}`,
        }));
      }
    }

    return { ...state, refresh, signOut, loading };
  }, [state]);

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

/** Optional: screens can call this to assert auth */
export function useRequireAuth() {
  const auth = useAuth();
  // If needed, screens can redirect when auth.status === 'signedOut'
  return auth;
}
