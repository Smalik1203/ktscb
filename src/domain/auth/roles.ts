/**
 * Domain-level Role Definitions
 * 
 * This file defines the allowed roles in the system.
 * These are the single source of truth for role types.
 * 
 * NO React imports allowed - this is pure domain logic.
 */

/**
 * System roles - exhaustive list of all valid roles
 */
export const ROLES = {
  SUPERADMIN: 'superadmin',
  CB_ADMIN: 'cb_admin',
  ADMIN: 'admin',
  TEACHER: 'teacher',
  DRIVER: 'driver',
  STUDENT: 'student',
  UNKNOWN: 'unknown',
} as const;

/**
 * Role type union derived from ROLES constant
 */
export type Role = typeof ROLES[keyof typeof ROLES];

/**
 * Type guard to check if a string is a valid Role
 */
export function isValidRole(role: unknown): role is Role {
  if (typeof role !== 'string') return false;
  return Object.values(ROLES).includes(role as Role);
}

/**
 * Safely parse a role from unknown input
 * Returns 'unknown' if the input is not a valid role
 */
export function parseRole(role: unknown): Role {
  if (isValidRole(role)) return role;
  return ROLES.UNKNOWN;
}

/**
 * Role hierarchy for comparison purposes
 * Higher number = more privileges (for ordering, not authorization)
 */
export const ROLE_HIERARCHY: Record<Role, number> = {
  [ROLES.SUPERADMIN]: 100,
  [ROLES.CB_ADMIN]: 80,
  [ROLES.ADMIN]: 60,
  [ROLES.TEACHER]: 40,
  [ROLES.DRIVER]: 30,
  [ROLES.STUDENT]: 20,
  [ROLES.UNKNOWN]: 0,
};

/**
 * Check if a role is an administrative role
 */
export function isAdminRole(role: Role): boolean {
  return role === ROLES.SUPERADMIN || role === ROLES.CB_ADMIN || role === ROLES.ADMIN;
}

/**
 * Check if a role is a staff role (admin or teacher)
 */
export function isStaffRole(role: Role): boolean {
  return isAdminRole(role) || role === ROLES.TEACHER;
}

