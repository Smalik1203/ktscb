/**
 * Rate Limiter for preventing brute force attacks
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

const DEFAULT_LIMITS = {
  login: { maxAttempts: 5, windowMs: 15 * 60 * 1000 }, // 5 attempts per 15 minutes
  passwordReset: { maxAttempts: 3, windowMs: 60 * 60 * 1000 }, // 3 attempts per hour
  apiCall: { maxAttempts: 100, windowMs: 60 * 1000 }, // 100 calls per minute
};

/**
 * Check if an action is rate limited
 * @param key - Unique identifier (e.g., email, IP, user ID)
 * @param action - Type of action being rate limited
 * @returns true if rate limited, false otherwise
 */
export function isRateLimited(key: string, action: keyof typeof DEFAULT_LIMITS = 'login'): boolean {
  const limits = DEFAULT_LIMITS[action];
  const now = Date.now();
  
  const entry = rateLimitStore.get(key);
  
  // No entry or window expired - reset
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + limits.windowMs,
    });
    return false;
  }
  
  // Increment count
  entry.count++;
  
  // Check if limit exceeded
  if (entry.count > limits.maxAttempts) {
    return true;
  }
  
  return false;
}

/**
 * Get remaining attempts before rate limit
 * @param key - Unique identifier
 * @param action - Type of action
 * @returns Number of remaining attempts
 */
export function getRemainingAttempts(key: string, action: keyof typeof DEFAULT_LIMITS = 'login'): number {
  const limits = DEFAULT_LIMITS[action];
  const entry = rateLimitStore.get(key);
  const now = Date.now();
  
  if (!entry || now > entry.resetAt) {
    return limits.maxAttempts;
  }
  
  return Math.max(0, limits.maxAttempts - entry.count);
}

/**
 * Get time until rate limit resets (in seconds)
 * @param key - Unique identifier
 * @param action - Type of action
 * @returns Seconds until reset, or 0 if not rate limited
 */
export function getResetTime(key: string, action: keyof typeof DEFAULT_LIMITS = 'login'): number {
  const entry = rateLimitStore.get(key);
  const now = Date.now();
  
  if (!entry || now > entry.resetAt) {
    return 0;
  }
  
  return Math.ceil((entry.resetAt - now) / 1000);
}

/**
 * Clear rate limit for a specific key (useful for successful operations)
 */
export function clearRateLimit(key: string): void {
  rateLimitStore.delete(key);
}

/**
 * Clear all rate limits (use with caution - mainly for testing)
 */
export function clearAllRateLimits(): void {
  rateLimitStore.clear();
}

/**
 * Clean up expired entries (call periodically)
 */
export function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}

// Cleanup is lazy: expired entries are skipped in isRateLimited().
// No global setInterval — avoids leaked timers and background CPU.

