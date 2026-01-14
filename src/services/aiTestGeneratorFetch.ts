/**
 * AI Test Generator Service
 * 
 * Generates MCQ questions from images using OpenAI Vision API.
 * The API call is made through a Supabase Edge Function to keep
 * the API key secure on the server side.
 * 
 * Features:
 * - Server-side API key (secure)
 * - Rate limiting (10/day, 100/month by default)
 * - Usage analytics logging
 * - Local caching for repeat requests
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

// Get Supabase URL from environment
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;

// Cache configuration
const CACHE_PREFIX = 'ai_questions_cache_';
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CACHE_ENTRIES = 20; // Maximum cached generations

export interface GeneratedQuestion {
  question_text: string;
  question_type: 'mcq';
  options: string[];
  correct_index: number;
  explanation: string;
}

export interface AITestGenerationResult {
  questions: GeneratedQuestion[];
  totalGenerated: number;
  fromCache?: boolean;
  usage?: {
    dailyRemaining: number;
    monthlyRemaining: number;
  };
  error?: string;
}

interface CachedResult {
  questions: GeneratedQuestion[];
  timestamp: number;
  questionCount: number;
  context?: string;
}

/**
 * Generate a simple hash code for a string
 * Used for cache key generation
 */
function hashCode(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Get cache key for an image
 */
function getCacheKey(imageUri: string, questionCount: number, context?: string): string {
  const hash = hashCode(`${imageUri}_${questionCount}_${context || ''}`);
  return `${CACHE_PREFIX}${hash}`;
}

/**
 * Get cached result if valid
 */
async function getCachedResult(
  imageUri: string,
  questionCount: number,
  context?: string
): Promise<CachedResult | null> {
  try {
    const key = getCacheKey(imageUri, questionCount, context);
    const cached = await AsyncStorage.getItem(key);

    if (!cached) return null;

    const data: CachedResult = JSON.parse(cached);

    // Check if cache is expired
    if (Date.now() - data.timestamp > CACHE_EXPIRY_MS) {
      await AsyncStorage.removeItem(key);
      return null;
    }

    // Check if question count matches (allow more questions, not fewer)
    if (data.questionCount < questionCount) {
      return null;
    }

    return data;
  } catch (error) {
    console.warn('Cache read error:', error);
    return null;
  }
}

/**
 * Save result to cache
 */
async function cacheResult(
  imageUri: string,
  questionCount: number,
  context: string | undefined,
  questions: GeneratedQuestion[]
): Promise<void> {
  try {
    const key = getCacheKey(imageUri, questionCount, context);
    const data: CachedResult = {
      questions,
      timestamp: Date.now(),
      questionCount,
      context,
    };

    await AsyncStorage.setItem(key, JSON.stringify(data));

    // Clean up old cache entries
    await cleanupOldCache();
  } catch (error) {
    console.warn('Cache write error:', error);
  }
}

/**
 * Clean up old cache entries to prevent storage bloat
 */
async function cleanupOldCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(k => k.startsWith(CACHE_PREFIX));

    if (cacheKeys.length <= MAX_CACHE_ENTRIES) return;

    // Get all cache entries with timestamps
    const entries: { key: string; timestamp: number }[] = [];

    for (const key of cacheKeys) {
      try {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          const parsed = JSON.parse(data);
          entries.push({ key, timestamp: parsed.timestamp || 0 });
        }
      } catch {
        // Remove corrupted entries
        await AsyncStorage.removeItem(key);
      }
    }

    // Sort by timestamp (oldest first) and remove excess
    entries.sort((a, b) => a.timestamp - b.timestamp);
    const toRemove = entries.slice(0, entries.length - MAX_CACHE_ENTRIES);

    for (const { key } of toRemove) {
      await AsyncStorage.removeItem(key);
    }
  } catch (error) {
    console.warn('Cache cleanup error:', error);
  }
}

/**
 * Clear all AI question cache
 */
export async function clearAICache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(k => k.startsWith(CACHE_PREFIX));
    await AsyncStorage.multiRemove(cacheKeys);
  } catch (error) {
    console.warn('Cache clear error:', error);
  }
}

/**
 * Convert image URI to base64 using fetch with timeout
 */
async function imageToBase64(imageUri: string): Promise<string> {
  try {
    // Add timeout to fetch
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const response = await fetch(imageUri, { signal: controller.signal });
    clearTimeout(timeoutId);

    const blob = await response.blob();

    // Convert blob to base64
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result as string;
        const base64 = base64data.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('Image loading timeout. Please try a smaller image.');
    }
    throw new Error('Failed to process image: ' + error.message);
  }
}

/**
 * Generate test questions from an image using the AI Edge Function
 * 
 * @param imageUri - Local URI to the image file
 * @param questionCount - Number of questions to generate (1-50)
 * @param context - Optional context/focus for question generation
 * @param onProgress - Optional callback for progress updates
 * @param useCache - Whether to use cached results (default: true)
 * @returns Promise with generated questions or error
 */
export async function generateQuestionsFromImage(
  imageUri: string,
  questionCount: number = 10,
  context?: string,
  onProgress?: (text: string) => void,
  useCache: boolean = true
): Promise<AITestGenerationResult> {
  try {
    // Check cache first (if enabled)
    if (useCache) {
      const cached = await getCachedResult(imageUri, questionCount, context);
      if (cached) {
        if (onProgress) {
          onProgress('✅ Found cached result!');
        }

        // Return cached questions (slice to requested count if we have more)
        const questions = cached.questions.slice(0, questionCount);
        return {
          questions,
          totalGenerated: questions.length,
          fromCache: true,
        };
      }
    }

    if (onProgress) {
      onProgress('🔄 Processing image...');
    }

    // Convert image to base64
    const base64Image = await imageToBase64(imageUri);
    const mimeType = imageUri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';

    if (onProgress) {
      onProgress('📤 Sending to Sage AI...');
    }

    // Get current session for auth token
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      throw new Error('Please sign in to use AI features.');
    }

    if (onProgress) {
      onProgress('✨ Sage is generating questions...\n\nPlease wait...');
    }

    // Call the Edge Function
    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-questions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        imageBase64: base64Image,
        mimeType,
        questionCount,
        context,
      }),
    });

    // Handle different response statuses
    if (response.status === 401) {
      throw new Error('Session expired. Please sign in again.');
    }

    if (response.status === 429) {
      const data = await response.json();
      let errorMsg = data.error || 'Rate limit reached. Please try again later.';

      // Add remaining usage info if available
      if (data.usage) {
        if (data.usage.dailyRemaining === 0) {
          errorMsg = `Daily limit reached (${data.usage.dailyRemaining} remaining). Try again tomorrow.`;
        } else if (data.usage.monthlyRemaining === 0) {
          errorMsg = `Monthly limit reached. Contact admin for more quota.`;
        }
      }

      throw new Error(errorMsg);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Request failed with status ${response.status}`);
    }

    // Parse successful response
    const result = await response.json();

    if (result.error) {
      throw new Error(result.error);
    }

    if (!result.questions || result.questions.length === 0) {
      throw new Error('No questions were generated. Try a clearer image.');
    }

    // Cache the result
    if (useCache) {
      await cacheResult(imageUri, questionCount, context, result.questions);
    }

    // Display final result
    if (onProgress) {
      const usageInfo = result.usage
        ? ` (${result.usage.dailyRemaining} left today)`
        : '';
      onProgress(`✅ Generated ${result.questions.length} questions!${usageInfo}`);
    }

    return {
      questions: result.questions,
      totalGenerated: result.totalGenerated,
      fromCache: false,
      usage: result.usage,
    };

  } catch (error: any) {
    let errorMessage = error.message || 'Failed to generate questions';

    // User-friendly error messages
    if (error.message?.includes('timeout') || error.message?.includes('Timeout')) {
      errorMessage = 'Request timeout. Please try with a smaller image or fewer questions.';
    } else if (error.message?.includes('network') || error.message?.includes('Network') || error.name === 'TypeError') {
      errorMessage = 'Network error. Please check your internet connection.';
    } else if (error.message?.includes('sign in') || error.message?.includes('Session')) {
      errorMessage = 'Please sign in to use AI features.';
    }

    return {
      questions: [],
      totalGenerated: 0,
      error: errorMessage,
    };
  }
}

/**
 * Generate questions from multiple images
 * 
 * @param imageUris - Array of local image URIs
 * @param questionCountPerImage - Questions to generate per image
 * @param context - Optional context/focus for questions
 * @returns Promise with combined questions from all images
 */
export async function generateQuestionsFromMultipleImages(
  imageUris: string[],
  questionCountPerImage: number = 5,
  context?: string
): Promise<AITestGenerationResult> {
  try {
    const allQuestions: GeneratedQuestion[] = [];
    let hasCache = false;

    for (const imageUri of imageUris) {
      const result = await generateQuestionsFromImage(imageUri, questionCountPerImage, context);

      if (result.error) {
        continue; // Skip failed images, continue with others
      }

      if (result.fromCache) hasCache = true;
      allQuestions.push(...result.questions);
    }

    if (allQuestions.length === 0) {
      return {
        questions: [],
        totalGenerated: 0,
        error: 'No valid questions generated from any images.',
      };
    }

    return {
      questions: allQuestions,
      totalGenerated: allQuestions.length,
      fromCache: hasCache,
    };
  } catch (error: any) {
    return {
      questions: [],
      totalGenerated: 0,
      error: error.message || 'Failed to generate questions from images',
    };
  }
}
