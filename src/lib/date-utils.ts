/**
 * Date Utilities for React Native/Expo
 * 
 * Centralized date formatting and manipulation using date-fns
 * Following React Native best practices for consistent date handling
 */

import { format, formatDistanceToNow, isToday, isYesterday, parseISO } from 'date-fns';

/**
 * Format date for display in a user-friendly way
 * Shows relative time for recent dates, absolute for older dates
 */
export function formatDateDisplay(date: Date | string): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  
  if (isToday(dateObj)) {
    return 'Today';
  }
  
  if (isYesterday(dateObj)) {
    return 'Yesterday';
  }
  
  const daysDiff = Math.floor((Date.now() - dateObj.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysDiff < 7) {
    return `${daysDiff}d ago`;
  }
  
  if (daysDiff < 30) {
    return `${Math.floor(daysDiff / 7)}w ago`;
  }
  
  return format(dateObj, 'MMM d, yyyy');
}

/**
 * Format date with full date string
 */
export function formatDateFull(date: Date | string, formatStr: string = 'MMM d, yyyy'): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return format(dateObj, formatStr);
}

/**
 * Format date for API (ISO string)
 */
export function formatDateForAPI(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * Format date with time
 */
export function formatDateTime(date: Date | string, formatStr: string = 'MMM d, yyyy h:mm a'): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return format(dateObj, formatStr);
}

/**
 * Get relative time string (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return formatDistanceToNow(dateObj, { addSuffix: true });
}


