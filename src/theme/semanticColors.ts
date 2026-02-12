/**
 * Semantic Color Mappings
 * 
 * Centralized color assignments for domain concepts like status, priority,
 * and event types. Maps domain values to theme color scale names so screens
 * never hardcode hex values.
 * 
 * Usage:
 *   const { resolve } = useSemanticColor();
 *   const bg = resolve('status', 'completed', 50);   // colors.success[50]
 *   const fg = resolve('status', 'completed', 600);   // colors.success[600]
 */

import { useCallback } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import type { ThemeColors, ColorScale } from './types';

// ---------------------------------------------------------------------------
// Scale name type — keys on ThemeColors that are ColorScale
// ---------------------------------------------------------------------------

type ColorScaleName = 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error' | 'info' | 'neutral';

// ---------------------------------------------------------------------------
// Domain → scale mappings
// ---------------------------------------------------------------------------

/** Status colors (fees, tasks, tests, invoices) */
export const STATUS_COLORS: Record<string, ColorScaleName> = {
  published: 'success',
  active: 'success',
  completed: 'success',
  paid: 'success',
  submitted: 'success',
  approved: 'success',
  draft: 'warning',
  pending: 'warning',
  partial: 'warning',
  in_progress: 'info',
  overdue: 'error',
  failed: 'error',
  rejected: 'error',
  unpaid: 'error',
  cancelled: 'neutral',
  archived: 'neutral',
} as const;

/** Priority colors (announcements, tasks) */
export const PRIORITY_COLORS: Record<string, ColorScaleName> = {
  urgent: 'error',
  high: 'warning',
  medium: 'primary',
  normal: 'primary',
  low: 'info',
} as const;

/** Calendar event type colors */
export const EVENT_TYPE_COLORS: Record<string, ColorScaleName> = {
  exam: 'error',
  test: 'error',
  holiday: 'success',
  meeting: 'primary',
  deadline: 'warning',
  activity: 'accent',
  event: 'info',
  reminder: 'secondary',
} as const;

/** Attendance status colors */
export const ATTENDANCE_COLORS: Record<string, ColorScaleName> = {
  present: 'success',
  absent: 'error',
  late: 'warning',
  excused: 'info',
} as const;

// Combine all maps under named keys
const SEMANTIC_MAPS = {
  status: STATUS_COLORS,
  priority: PRIORITY_COLORS,
  eventType: EVENT_TYPE_COLORS,
  attendance: ATTENDANCE_COLORS,
} as const;

export type SemanticDomain = keyof typeof SEMANTIC_MAPS;

// ---------------------------------------------------------------------------
// Hook: useSemanticColor
// ---------------------------------------------------------------------------

type ColorLevel = keyof ColorScale;  // 50 | 100 | ... | 950 | 'main'

export function useSemanticColor() {
  const { colors } = useTheme();

  /**
   * Resolve a semantic value to a concrete color string.
   * 
   * @param domain  — 'status' | 'priority' | 'eventType' | 'attendance'
   * @param value   — The domain value, e.g. 'completed', 'urgent', 'exam'
   * @param level   — Color scale level (50 for backgrounds, 600 for text/icons, 'main' for default)
   * @returns A color string, or the neutral fallback if value is unknown
   */
  const resolve = useCallback(
    (domain: SemanticDomain, value: string, level: ColorLevel = 'main'): string => {
      const map = SEMANTIC_MAPS[domain];
      const scaleName: ColorScaleName = map[value.toLowerCase()] ?? 'neutral';
      const scale = colors[scaleName] as ColorScale;
      return scale[level];
    },
    [colors],
  );

  /**
   * Get both background (light) and foreground (dark) colors for a value.
   * Convenient for badges, chips, and status indicators.
   */
  const resolvePair = useCallback(
    (domain: SemanticDomain, value: string): { bg: string; fg: string } => {
      return {
        bg: resolve(domain, value, 50),
        fg: resolve(domain, value, 600),
      };
    },
    [resolve],
  );

  /**
   * Get the color scale name for a domain value (useful when you need 
   * the full scale, e.g. for gradients).
   */
  const getScaleName = useCallback(
    (domain: SemanticDomain, value: string): ColorScaleName => {
      const map = SEMANTIC_MAPS[domain];
      return map[value.toLowerCase()] ?? 'neutral';
    },
    [],
  );

  return { resolve, resolvePair, getScaleName };
}
