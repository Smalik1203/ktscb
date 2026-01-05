/**
 * Tasks Service
 * 
 * All task-related mutations must go through this service.
 * Every write operation requires capability assertion.
 * 
 * NO direct Supabase access from components/features allowed.
 */

import { supabase } from '../lib/supabase';
import { assertCapability, type AuthorizableUser } from '../domain/auth/assert';
import type { Capability } from '../domain/auth/capabilities';

// =============================================================================
// Types
// =============================================================================

export interface TaskAttachment {
  name: string;
  url: string;
  type: string;
  size?: number;
}

export interface TaskInput {
  school_code: string;
  academic_year_id?: string;
  class_instance_id?: string;
  subject_id?: string;
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  assigned_date: string;
  due_date: string;
  max_marks?: number;
  instructions?: string;
  attachments?: TaskAttachment[];
  created_by: string;
}

// =============================================================================
// Auth Helper
// =============================================================================

/**
 * Get the current authenticated user context for service-level authorization.
 */
async function getCurrentAuthUser(): Promise<AuthorizableUser | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: userData } = await supabase
    .from('users')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle();

  if (!userData) return null;

  return {
    id: userData.id,
    role: userData.role,
  };
}

/**
 * Assert that the current authenticated user has the required capability.
 */
async function assertCurrentUserCapability(capability: Capability): Promise<AuthorizableUser> {
  const user = await getCurrentAuthUser();
  assertCapability(user, capability);
  return user;
}

// =============================================================================
// Tasks Service
// =============================================================================

export const tasksService = {
  /**
   * Create a new task.
   * Requires: tasks.create capability
   */
  async create(input: TaskInput): Promise<{ id: string }> {
    await assertCurrentUserCapability('tasks.create');

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        school_code: input.school_code,
        academic_year_id: input.academic_year_id,
        class_instance_id: input.class_instance_id,
        subject_id: input.subject_id,
        title: input.title,
        description: input.description,
        priority: input.priority || 'medium',
        assigned_date: input.assigned_date,
        due_date: input.due_date,
        max_marks: input.max_marks || 0,
        instructions: input.instructions,
        attachments: input.attachments ? JSON.stringify(input.attachments) : '[]',
        created_by: input.created_by,
      })
      .select('id')
      .single();

    if (error) throw error;
    return { id: data.id };
  },

  /**
   * Update a task.
   * Requires: tasks.manage capability
   */
  async update(taskId: string, updates: Partial<Omit<TaskInput, 'school_code' | 'created_by'>>): Promise<void> {
    await assertCurrentUserCapability('tasks.manage');

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.priority !== undefined) updateData.priority = updates.priority;
    if (updates.assigned_date !== undefined) updateData.assigned_date = updates.assigned_date;
    if (updates.due_date !== undefined) updateData.due_date = updates.due_date;
    if (updates.max_marks !== undefined) updateData.max_marks = updates.max_marks;
    if (updates.instructions !== undefined) updateData.instructions = updates.instructions;
    if (updates.attachments !== undefined) updateData.attachments = updates.attachments;
    if (updates.class_instance_id !== undefined) updateData.class_instance_id = updates.class_instance_id;
    if (updates.subject_id !== undefined) updateData.subject_id = updates.subject_id;
    if (updates.academic_year_id !== undefined) updateData.academic_year_id = updates.academic_year_id;

    const { error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', taskId);

    if (error) throw error;
  },

  /**
   * Update task attachments only.
   * Requires: tasks.manage capability
   */
  async updateAttachments(taskId: string, attachments: TaskAttachment[]): Promise<void> {
    await assertCurrentUserCapability('tasks.manage');

    const { error } = await supabase
      .from('tasks')
      .update({
        attachments: attachments as unknown as import('../types/database.types').Json,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId);

    if (error) throw error;
  },

  /**
   * Delete a task.
   * Requires: tasks.manage capability
   */
  async delete(taskId: string): Promise<void> {
    await assertCurrentUserCapability('tasks.manage');

    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId);

    if (error) throw error;
  },
};

export default tasksService;

