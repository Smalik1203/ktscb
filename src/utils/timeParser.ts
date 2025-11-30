/**
 * Natural Language Time Parser
 * 
 * Parses various time input formats and converts to HH:MM:SS
 * Supports: "530 pm", "5.30pm", "17 45", "8", "845a", "2pm", "05:00", "noon", etc.
 */

export interface ParsedTime {
  hour: number; // 0-23
  minute: number; // 0-59
  second: number; // 0-59
  formatted: string; // HH:MM:SS
  isValid: boolean;
  error?: string;
}

/**
 * Parse natural language time input to HH:MM:SS format
 */
export function parseTimeInput(input: string, referenceHour?: number): ParsedTime {
  if (!input || typeof input !== 'string') {
    return {
      hour: 0,
      minute: 0,
      second: 0,
      formatted: '00:00:00',
      isValid: false,
      error: 'Invalid input',
    };
  }

  const normalized = input.trim().toLowerCase();
  
  // Handle special cases
  if (normalized === 'noon' || normalized === '12pm' || normalized === '12:00pm') {
    return {
      hour: 12,
      minute: 0,
      second: 0,
      formatted: '12:00:00',
      isValid: true,
    };
  }
  
  if (normalized === 'midnight' || normalized === '12am' || normalized === '12:00am' || normalized === '00:00') {
    return {
      hour: 0,
      minute: 0,
      second: 0,
      formatted: '00:00:00',
      isValid: true,
    };
  }

  // Extract AM/PM indicator
  let isPM = false;
  let isAM = false;
  let cleaned = normalized;
  
  if (normalized.includes('pm') || normalized.includes('p.m.')) {
    isPM = true;
    cleaned = normalized.replace(/p\.?m\.?/g, '').trim();
  } else if (normalized.includes('am') || normalized.includes('a.m.')) {
    isAM = true;
    cleaned = normalized.replace(/a\.?m\.?/g, '').trim();
  }

  // Remove common separators and spaces
  cleaned = cleaned.replace(/[:\s\.]/g, '');

  // Try to parse as HHMM or HMM or HH
  let hour = 0;
  let minute = 0;

  if (cleaned.length === 0) {
    return {
      hour: 0,
      minute: 0,
      second: 0,
      formatted: '00:00:00',
      isValid: false,
      error: 'Empty time input',
    };
  }

  // Parse different formats
  if (cleaned.length === 1 || cleaned.length === 2) {
    // Single or double digit hour (e.g., "8", "12")
    hour = parseInt(cleaned, 10);
    minute = 0;
  } else if (cleaned.length === 3) {
    // HMM format (e.g., "530" = 5:30)
    hour = parseInt(cleaned[0], 10);
    minute = parseInt(cleaned.slice(1), 10);
  } else if (cleaned.length === 4) {
    // HHMM format (e.g., "1730" = 17:30 or "530" = 5:30)
    const firstTwo = parseInt(cleaned.slice(0, 2), 10);
    const lastTwo = parseInt(cleaned.slice(2), 10);
    
    // If first two digits > 12, treat as 24-hour format
    if (firstTwo > 12 && firstTwo <= 23) {
      hour = firstTwo;
      minute = lastTwo;
    } else {
      // Could be HMMM or HHMM
      if (firstTwo <= 12) {
        hour = firstTwo;
        minute = lastTwo;
      } else {
        hour = parseInt(cleaned[0], 10);
        minute = parseInt(cleaned.slice(1), 10);
      }
    }
  } else if (cleaned.length >= 5) {
    // HHMMSS or longer - take first 4 digits
    hour = parseInt(cleaned.slice(0, 2), 10);
    minute = parseInt(cleaned.slice(2, 4), 10);
  } else {
    return {
      hour: 0,
      minute: 0,
      second: 0,
      formatted: '00:00:00',
      isValid: false,
      error: 'Invalid time format',
    };
  }

  // Validate parsed values
  if (isNaN(hour) || isNaN(minute)) {
    return {
      hour: 0,
      minute: 0,
      second: 0,
      formatted: '00:00:00',
      isValid: false,
      error: 'Could not parse time',
    };
  }

  // Handle AM/PM conversion
  if (isPM && hour !== 12) {
    hour += 12;
  } else if (isAM && hour === 12) {
    hour = 0;
  }

  // If no AM/PM specified and hour is ambiguous (1-12), use context
  if (!isAM && !isPM && hour >= 1 && hour <= 12) {
    // If reference hour provided, use it to determine AM/PM
    if (referenceHour !== undefined) {
      // If reference is afternoon (>= 12), assume PM for ambiguous times
      if (referenceHour >= 12 && hour < 12) {
        hour += 12;
      }
    } else {
      // Default: assume PM for ambiguous times (more common in school schedules)
      // But this can be overridden by user
      // For now, keep as-is and let user specify AM/PM
    }
  }

  // Validate ranges
  if (hour < 0 || hour > 23) {
    return {
      hour: 0,
      minute: 0,
      second: 0,
      formatted: '00:00:00',
      isValid: false,
      error: `Invalid hour: ${hour}. Must be 0-23.`,
    };
  }

  if (minute < 0 || minute > 59) {
    return {
      hour: 0,
      minute: 0,
      second: 0,
      formatted: '00:00:00',
      isValid: false,
      error: `Invalid minute: ${minute}. Must be 0-59.`,
    };
  }

  // Format as HH:MM:SS
  const formatted = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;

  return {
    hour,
    minute,
    second: 0,
    formatted,
    isValid: true,
  };
}

/**
 * Format time for display
 */
export function formatTimeForDisplay(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const hour12 = hours % 12 || 12;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  return `${hour12}:${String(minutes).padStart(2, '0')} ${ampm}`;
}

/**
 * Convert HH:MM:SS to minutes since midnight
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Convert minutes since midnight to HH:MM:SS
 */
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`;
}

/**
 * Check if two time ranges overlap
 */
export function timeRangesOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  const start1Min = timeToMinutes(start1);
  const end1Min = timeToMinutes(end1);
  const start2Min = timeToMinutes(start2);
  const end2Min = timeToMinutes(end2);

  return start1Min < end2Min && start2Min < end1Min;
}

