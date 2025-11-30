/**
 * Pure utility functions for analytics
 * No dependencies on React or UI components
 */

export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Formats a date range into a human-readable string
 */
export function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const formatOptions: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };

  if (start.getFullYear() !== end.getFullYear()) {
    return `${start.toLocaleDateString('en-US', { ...formatOptions, year: 'numeric' })} - ${end.toLocaleDateString('en-US', { ...formatOptions, year: 'numeric' })}`;
  }

  return `${start.toLocaleDateString('en-US', formatOptions)} - ${end.toLocaleDateString('en-US', formatOptions)}`;
}

/**
 * Gets attendance color based on rate
 */
export function getAttendanceColor(rate: number): string {
  // This will be imported from design system in the component
  // Returning a string identifier for now
  if (rate >= 90) return 'success';
  if (rate >= 80) return 'warning';
  return 'error';
}

/**
 * Formats currency amount (in paise) to rupees
 */
export function formatCurrency(amountInPaise: number): string {
  return `₹${((amountInPaise || 0) / 100).toLocaleString()}`;
}

