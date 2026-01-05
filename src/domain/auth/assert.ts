/**
 * Domain-level Authorization Assertions
 * 
 * Pure functions for checking and asserting capabilities.
 * These should be used at the service layer to enforce authorization.
 * 
 * NO React imports allowed - this is pure domain logic.
 */

import { Role, parseRole } from './roles';
import { Capability, roleHasCapability } from './capabilities';

/**
 * User context for authorization checks.
 * This is a minimal type that can be satisfied by various user objects.
 */
export interface AuthorizableUser {
  id?: string;
  role?: string | null;
}

/**
 * Error thrown when authorization fails
 */
export class AuthorizationError extends Error {
  public readonly capability: Capability;
  public readonly userRole: Role;
  
  constructor(capability: Capability, userRole: Role, message?: string) {
    super(message ?? `Access denied: requires capability '${capability}', user role '${userRole}' does not have it`);
    this.name = 'AuthorizationError';
    this.capability = capability;
    this.userRole = userRole;
    
    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AuthorizationError);
    }
  }
}

/**
 * Check if a user has a specific capability.
 * This is a pure function with no side effects.
 * 
 * @param user - The user to check (must have a role property)
 * @param capability - The capability to check for
 * @returns true if user has the capability, false otherwise
 */
export function can(user: AuthorizableUser | null | undefined, capability: Capability): boolean {
  if (!user) return false;
  
  const role = parseRole(user.role);
  return roleHasCapability(role, capability);
}

/**
 * Check if a user has any of the specified capabilities.
 * 
 * @param user - The user to check
 * @param capabilities - Array of capabilities to check
 * @returns true if user has at least one of the capabilities
 */
export function canAny(user: AuthorizableUser | null | undefined, capabilities: Capability[]): boolean {
  return capabilities.some(cap => can(user, cap));
}

/**
 * Check if a user has all of the specified capabilities.
 * 
 * @param user - The user to check
 * @param capabilities - Array of capabilities to check
 * @returns true if user has all of the capabilities
 */
export function canAll(user: AuthorizableUser | null | undefined, capabilities: Capability[]): boolean {
  return capabilities.every(cap => can(user, cap));
}

/**
 * Assert that a user has a specific capability.
 * Throws AuthorizationError if the user does not have the capability.
 * 
 * Use this at the service layer BEFORE performing any mutations.
 * 
 * @param user - The user to check
 * @param capability - The required capability
 * @throws AuthorizationError if user lacks the capability
 * 
 * @example
 * ```ts
 * export async function createFeePlan(user: AuthorizableUser, input: FeePlanInput) {
 *   assertCapability(user, 'fees.write');
 *   // proceed with creation...
 * }
 * ```
 */
export function assertCapability(
  user: AuthorizableUser | null | undefined,
  capability: Capability
): asserts user is AuthorizableUser {
  if (!user) {
    throw new AuthorizationError(
      capability,
      parseRole(null),
      'Access denied: user is not authenticated'
    );
  }
  
  const role = parseRole(user.role);
  
  if (!roleHasCapability(role, capability)) {
    throw new AuthorizationError(capability, role);
  }
}

/**
 * Assert that a user has any of the specified capabilities.
 * 
 * @param user - The user to check
 * @param capabilities - Array of acceptable capabilities
 * @throws AuthorizationError if user lacks all of the capabilities
 */
export function assertAnyCapability(
  user: AuthorizableUser | null | undefined,
  capabilities: Capability[]
): asserts user is AuthorizableUser {
  if (!user) {
    throw new AuthorizationError(
      capabilities[0],
      parseRole(null),
      'Access denied: user is not authenticated'
    );
  }
  
  if (!canAny(user, capabilities)) {
    const role = parseRole(user.role);
    throw new AuthorizationError(
      capabilities[0],
      role,
      `Access denied: requires one of [${capabilities.join(', ')}], user role '${role}' has none`
    );
  }
}

/**
 * Assert that a user has all of the specified capabilities.
 * 
 * @param user - The user to check
 * @param capabilities - Array of required capabilities
 * @throws AuthorizationError if user lacks any of the capabilities
 */
export function assertAllCapabilities(
  user: AuthorizableUser | null | undefined,
  capabilities: Capability[]
): asserts user is AuthorizableUser {
  if (!user) {
    throw new AuthorizationError(
      capabilities[0],
      parseRole(null),
      'Access denied: user is not authenticated'
    );
  }
  
  const role = parseRole(user.role);
  const missing = capabilities.filter(cap => !roleHasCapability(role, cap));
  
  if (missing.length > 0) {
    throw new AuthorizationError(
      missing[0],
      role,
      `Access denied: missing capabilities [${missing.join(', ')}]`
    );
  }
}

/**
 * Helper to safely extract role from various user object shapes
 */
export function getUserRole(user: AuthorizableUser | null | undefined): Role {
  if (!user) return parseRole(null);
  return parseRole(user.role);
}

