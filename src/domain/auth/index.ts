/**
 * Domain Auth Module - Public API
 * 
 * This module exports all role, capability, and authorization utilities.
 * Import from this file for a clean API:
 * 
 * @example
 * ```ts
 * import { can, assertCapability, ROLES, Capability } from '@/domain/auth';
 * ```
 */

// Roles
export { ROLES, ROLE_HIERARCHY, isValidRole, parseRole, isAdminRole, isStaffRole } from './roles';
export type { Role } from './roles';

// Capabilities
export { 
  ROLE_CAPABILITIES, 
  CAPABILITY_DOMAINS,
  getCapabilitiesForRole, 
  roleHasCapability,
  getAllCapabilities,
} from './capabilities';
export type { Capability } from './capabilities';

// Authorization
export { 
  can, 
  canAny, 
  canAll, 
  assertCapability, 
  assertAnyCapability, 
  assertAllCapabilities,
  getUserRole,
  AuthorizationError,
} from './assert';
export type { AuthorizableUser } from './assert';

