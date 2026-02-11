/**
 * Domain-level Capability Definitions
 * 
 * This file defines all capabilities/permissions in the system and maps roles to capabilities.
 * This is the SINGLE SOURCE OF TRUTH for what each role can do.
 * 
 * NO React imports allowed - this is pure domain logic.
 */

import { Role, ROLES } from './roles';

/**
 * All system capabilities as a string literal union type.
 * Use dot notation: domain.action
 */
export type Capability =
  // Dashboard
  | 'dashboard.view'
  | 'dashboard.admin_stats'

  // Attendance
  | 'attendance.read'
  | 'attendance.read_own'
  | 'attendance.mark'
  | 'attendance.bulk_mark'

  // Fees
  | 'fees.read'
  | 'fees.read_own'
  | 'fees.write'
  | 'fees.manage_components'
  | 'fees.record_payments'

  // Timetable
  | 'timetable.read'
  | 'timetable.manage'

  // Calendar
  | 'calendar.read'
  | 'calendar.manage'

  // Resources
  | 'resources.read'
  | 'resources.manage'

  // Syllabus
  | 'syllabus.read'
  | 'syllabus.manage'
  | 'syllabus.track_progress'

  // Assessments / Tests
  | 'assessments.read'
  | 'assessments.read_own'
  | 'assessments.create'
  | 'assessments.manage'
  | 'assessments.take_test'
  | 'assessments.upload_marks'

  // Tasks / Homework
  | 'tasks.read'
  | 'tasks.read_own'
  | 'tasks.create'
  | 'tasks.manage'

  // Analytics
  | 'analytics.read'
  | 'analytics.read_own'
  | 'analytics.read_school'

  // Students
  | 'students.read'
  | 'students.create'
  | 'students.manage'

  // Classes
  | 'classes.read'
  | 'classes.create'
  | 'classes.manage'

  // Subjects
  | 'subjects.read'
  | 'subjects.create'
  | 'subjects.manage'

  // Admin Management
  | 'admins.read'
  | 'admins.create'
  | 'admins.manage'

  // School Management
  | 'management.view'
  | 'management.user_activity'

  // Inventory
  | 'inventory.read'
  | 'inventory.create'
  | 'inventory.manage'

  // Feedback
  | 'feedback.submit'        // Students: submit feedback to admin
  | 'feedback.read_own'      // Admins: view feedback received
  | 'feedback.view_all'      // Super Admins: view all school feedback
  | 'feedback.add_note'      // Super Admins: add management notes
  | 'feedback.acknowledge'   // Admins: acknowledge feedback
  | 'feedback.archive';      // Super Admins: archive feedback

/**
 * Explicit mapping of roles to their capabilities.
 * This is the single source of truth for authorization.
 * 
 * IMPORTANT: When adding new capabilities, explicitly add them to the appropriate roles.
 */
export const ROLE_CAPABILITIES: Record<Role, readonly Capability[]> = {
  // Superadmin has all capabilities
  [ROLES.SUPERADMIN]: [
    // Dashboard
    'dashboard.view',
    'dashboard.admin_stats',

    // Attendance
    'attendance.read',
    'attendance.mark',
    'attendance.bulk_mark',

    // Fees
    'fees.read',
    'fees.write',
    'fees.manage_components',
    'fees.record_payments',

    // Timetable
    'timetable.read',
    'timetable.manage',

    // Calendar
    'calendar.read',
    'calendar.manage',

    // Resources
    'resources.read',
    'resources.manage',

    // Syllabus
    'syllabus.read',
    'syllabus.manage',
    'syllabus.track_progress',

    // Assessments
    'assessments.read',
    'assessments.create',
    'assessments.manage',
    'assessments.upload_marks',

    // Tasks
    'tasks.read',
    'tasks.create',
    'tasks.manage',

    // Analytics
    'analytics.read',
    'analytics.read_school',

    // Students
    'students.read',
    'students.create',
    'students.manage',

    // Classes
    'classes.read',
    'classes.create',
    'classes.manage',

    // Subjects
    'subjects.read',
    'subjects.create',
    'subjects.manage',

    // Admin Management
    'admins.read',
    'admins.create',
    'admins.manage',

    // School Management
    'management.view',
    'management.user_activity',

    // Inventory
    'inventory.read',
    'inventory.create',
    'inventory.manage',

    // Feedback (all capabilities)
    'feedback.submit',
    'feedback.read_own',
    'feedback.view_all',
    'feedback.add_note',
    'feedback.acknowledge',
    'feedback.archive',
  ],

  // CB Admin (school board admin) - almost all capabilities except admin management
  [ROLES.CB_ADMIN]: [
    'dashboard.view',
    'dashboard.admin_stats',

    'attendance.read',
    'attendance.mark',
    'attendance.bulk_mark',

    'fees.read',
    'fees.write',
    'fees.manage_components',
    'fees.record_payments',

    'timetable.read',
    'timetable.manage',

    'calendar.read',
    'calendar.manage',

    'resources.read',
    'resources.manage',

    'syllabus.read',
    'syllabus.manage',
    'syllabus.track_progress',

    'assessments.read',
    'assessments.create',
    'assessments.manage',
    'assessments.upload_marks',

    'tasks.read',
    'tasks.create',
    'tasks.manage',

    'analytics.read',
    'analytics.read_school',

    'students.read',
    'students.create',
    'students.manage',

    'classes.read',
    'classes.manage',

    'subjects.read',
    'subjects.manage',

    'admins.read',

    'management.view',
    'management.user_activity',

    // Inventory
    'inventory.read',
    'inventory.create',
    'inventory.manage',

    // Feedback
    'feedback.read_own',
    'feedback.view_all',
    'feedback.add_note',
    'feedback.acknowledge',
    'feedback.archive',
  ],

  // Regular Admin - school-level administration
  [ROLES.ADMIN]: [
    'dashboard.view',
    'dashboard.admin_stats',

    'attendance.read',
    'attendance.mark',
    'attendance.bulk_mark',

    'fees.read',
    'fees.write',
    'fees.manage_components',
    'fees.record_payments',

    'timetable.read',
    'timetable.manage',

    'calendar.read',
    'calendar.manage',

    'resources.read',
    'resources.manage',

    'syllabus.read',
    'syllabus.manage',
    'syllabus.track_progress',

    'assessments.read',
    'assessments.create',
    'assessments.manage',
    'assessments.upload_marks',

    'tasks.read',
    'tasks.create',
    'tasks.manage',

    'analytics.read',
    'analytics.read_school',

    'students.read',
    'students.create',
    'students.manage',

    'classes.read',

    'subjects.read',

    'management.view',
    'management.user_activity',

    // Inventory
    'inventory.read',
    'inventory.create',
    'inventory.manage',

    // Feedback
    'feedback.read_own',
    'feedback.acknowledge',
  ],

  // Teacher - teaching-related capabilities
  [ROLES.TEACHER]: [
    'dashboard.view',

    'attendance.read',
    'attendance.mark',

    'timetable.read',

    'calendar.read',

    'resources.read',
    'resources.manage',

    'syllabus.read',
    'syllabus.manage',
    'syllabus.track_progress',

    'assessments.read',
    'assessments.create',
    'assessments.manage',
    'assessments.upload_marks',

    'tasks.read',
    'tasks.create',
    'tasks.manage',

    'analytics.read',

    'students.read',

    'classes.read',

    'subjects.read',

    // Feedback
    'feedback.read_own',
    'feedback.acknowledge',
  ],

  // Student - student-specific capabilities
  [ROLES.STUDENT]: [
    'dashboard.view',

    'attendance.read_own',

    'fees.read_own',

    'timetable.read',

    'calendar.read',

    'resources.read',

    'syllabus.read',

    'assessments.read_own',
    'assessments.take_test',

    'tasks.read_own',

    'analytics.read_own',

    // Feedback
    'feedback.submit',
  ],

  // Unknown role - no capabilities (must be explicitly handled)
  [ROLES.UNKNOWN]: [],
} as const;

/**
 * Get all capabilities for a given role
 */
export function getCapabilitiesForRole(role: Role): readonly Capability[] {
  return ROLE_CAPABILITIES[role] ?? [];
}

/**
 * Check if a role has a specific capability
 */
export function roleHasCapability(role: Role, capability: Capability): boolean {
  const capabilities = getCapabilitiesForRole(role);
  return capabilities.includes(capability);
}

/**
 * Get all capabilities (useful for documentation or admin interfaces)
 */
export function getAllCapabilities(): Capability[] {
  const allCaps = new Set<Capability>();
  Object.values(ROLE_CAPABILITIES).forEach(caps => {
    caps.forEach(cap => allCaps.add(cap));
  });
  return Array.from(allCaps).sort();
}

/**
 * Domain groupings for capabilities (for UI organization)
 */
export const CAPABILITY_DOMAINS = {
  dashboard: ['dashboard.view', 'dashboard.admin_stats'],
  attendance: ['attendance.read', 'attendance.read_own', 'attendance.mark', 'attendance.bulk_mark'],
  fees: ['fees.read', 'fees.read_own', 'fees.write', 'fees.manage_components', 'fees.record_payments'],
  timetable: ['timetable.read', 'timetable.manage'],
  calendar: ['calendar.read', 'calendar.manage'],
  resources: ['resources.read', 'resources.manage'],
  syllabus: ['syllabus.read', 'syllabus.manage', 'syllabus.track_progress'],
  assessments: ['assessments.read', 'assessments.read_own', 'assessments.create', 'assessments.manage', 'assessments.take_test', 'assessments.upload_marks'],
  tasks: ['tasks.read', 'tasks.read_own', 'tasks.create', 'tasks.manage'],
  analytics: ['analytics.read', 'analytics.read_own', 'analytics.read_school'],
  students: ['students.read', 'students.create', 'students.manage'],
  classes: ['classes.read', 'classes.create', 'classes.manage'],
  subjects: ['subjects.read', 'subjects.create', 'subjects.manage'],
  admins: ['admins.read', 'admins.create', 'admins.manage'],
  management: ['management.view', 'management.user_activity'],
  inventory: ['inventory.read', 'inventory.create', 'inventory.manage'],
  feedback: ['feedback.submit', 'feedback.read_own', 'feedback.view_all', 'feedback.add_note', 'feedback.acknowledge', 'feedback.archive'],
} as const;

