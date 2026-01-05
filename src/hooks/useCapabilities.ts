/**
 * useCapabilities Hook
 * 
 * This is the ONLY authorized way for UI components to check permissions.
 * It reads the user from AuthContext and maps role → capabilities via the domain layer.
 * 
 * Usage:
 * ```tsx
 * const { can, require, capabilities, isLoading } = useCapabilities();
 * 
 * // Check capability
 * if (can('fees.write')) {
 *   // show write UI
 * }
 * 
 * // Require capability (logs warning if missing)
 * require('fees.read');
 * ```
 */

import { useMemo, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  Capability, 
  getCapabilitiesForRole, 
  roleHasCapability,
} from '../domain/auth/capabilities';
import { Role, parseRole } from '../domain/auth/roles';
import { log } from '../lib/logger';

/**
 * Capability check result with loading state
 */
export interface UseCapabilitiesResult {
  /**
   * Check if the current user has a specific capability.
   * Returns false if auth is loading or user is not authenticated.
   */
  can: (capability: Capability) => boolean;
  
  /**
   * Check if the user has any of the specified capabilities.
   */
  canAny: (capabilities: Capability[]) => boolean;
  
  /**
   * Check if the user has all of the specified capabilities.
   */
  canAll: (capabilities: Capability[]) => boolean;
  
  /**
   * Require a capability - logs a warning if missing.
   * Use this for debugging/development to catch permission issues early.
   * Returns true if capability is present, false otherwise.
   */
  require: (capability: Capability, context?: string) => boolean;
  
  /**
   * All capabilities for the current user's role
   */
  capabilities: readonly Capability[];
  
  /**
   * The current user's role (parsed and validated)
   */
  role: Role;
  
  /**
   * True if auth is still loading/bootstrapping
   */
  isLoading: boolean;
  
  /**
   * True if user is authenticated and has a valid profile
   */
  isAuthenticated: boolean;
}

/**
 * Hook to access capability-based authorization.
 * 
 * This is the ONLY way UI components should check permissions.
 * Never check role directly in UI - always use capabilities.
 */
export function useCapabilities(): UseCapabilitiesResult {
  const { profile, loading, bootstrapping, status } = useAuth();
  
  // Parse the role safely
  const role = useMemo(() => {
    return parseRole(profile?.role);
  }, [profile?.role]);
  
  // Get all capabilities for this role
  const capabilities = useMemo(() => {
    return getCapabilitiesForRole(role);
  }, [role]);
  
  // Is auth still loading?
  const isLoading = loading || bootstrapping || status === 'checking';
  
  // Is user authenticated?
  const isAuthenticated = status === 'signedIn' && profile !== null;
  
  // Check single capability
  const can = useCallback((capability: Capability): boolean => {
    if (isLoading) return false;
    if (!isAuthenticated) return false;
    return roleHasCapability(role, capability);
  }, [role, isLoading, isAuthenticated]);
  
  // Check if user has any of the capabilities
  const canAny = useCallback((caps: Capability[]): boolean => {
    if (isLoading) return false;
    if (!isAuthenticated) return false;
    return caps.some(cap => roleHasCapability(role, cap));
  }, [role, isLoading, isAuthenticated]);
  
  // Check if user has all of the capabilities
  const canAll = useCallback((caps: Capability[]): boolean => {
    if (isLoading) return false;
    if (!isAuthenticated) return false;
    return caps.every(cap => roleHasCapability(role, cap));
  }, [role, isLoading, isAuthenticated]);
  
  // Require capability (logs warning if missing)
  const require = useCallback((capability: Capability, context?: string): boolean => {
    if (isLoading) {
      // Don't log during loading
      return false;
    }
    
    if (!isAuthenticated) {
      log.warn(`[useCapabilities.require] Unauthenticated user attempted to access: ${capability}${context ? ` (${context})` : ''}`);
      return false;
    }
    
    const hasCapability = roleHasCapability(role, capability);
    
    if (!hasCapability) {
      log.warn(
        `[useCapabilities.require] Missing capability: ${capability}`,
        {
          role,
          capability,
          context,
          availableCapabilities: capabilities,
        }
      );
    }
    
    return hasCapability;
  }, [role, capabilities, isLoading, isAuthenticated]);
  
  return {
    can,
    canAny,
    canAll,
    require,
    capabilities,
    role,
    isLoading,
    isAuthenticated,
  };
}

/**
 * Type helper for capability-gated components
 */
export interface WithCapabilityProps {
  /** Required capability to render children */
  capability: Capability;
  /** Fallback to render if capability is missing */
  fallback?: React.ReactNode;
  /** Children to render if capability is present */
  children: React.ReactNode;
}

export default useCapabilities;

