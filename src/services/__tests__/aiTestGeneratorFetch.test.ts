/**
 * Unit Tests for AI Test Generator Service
 * 
 * These tests verify the AI question generation service functionality.
 * To run these tests, add the following to package.json:
 * 
 * devDependencies:
 *   "@testing-library/react-native": "^12.0.0",
 *   "jest": "^29.0.0",
 *   "jest-expo": "~52.0.0"
 * 
 * scripts:
 *   "test": "jest"
 * 
 * And create jest.config.js with:
 *   module.exports = { preset: 'jest-expo' };
 */

import {
    generateQuestionsFromImage,
    generateQuestionsFromMultipleImages,
    clearAICache,
    GeneratedQuestion,
} from '../aiTestGeneratorFetch';

// Mock dependencies
jest.mock('../../lib/supabase', () => ({
    supabase: {
        auth: {
            getSession: jest.fn(),
        },
    },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    getAllKeys: jest.fn(() => Promise.resolve([])),
    multiRemove: jest.fn(),
}));

// Get mocked modules
const { supabase } = require('../../lib/supabase');
const AsyncStorage = require('@react-native-async-storage/async-storage');

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock FileReader
class MockFileReader {
    result: string | null = null;
    onloadend: (() => void) | null = null;
    onerror: ((error: Error) => void) | null = null;

    readAsDataURL(blob: Blob) {
        this.result = 'data:image/jpeg;base64,mockbase64content';
        setTimeout(() => this.onloadend?.(), 0);
    }
}
global.FileReader = MockFileReader as any;

// Sample valid question
const validQuestion: GeneratedQuestion = {
    question_text: 'What is 2+2?',
    question_type: 'mcq',
    options: ['1', '2', '3', '4'],
    correct_index: 3,
    explanation: 'Basic math: 2+2=4',
};

// Sample API response
const successResponse = {
    questions: [validQuestion],
    totalGenerated: 1,
    usage: { dailyRemaining: 9, monthlyRemaining: 99 },
};

describe('aiTestGeneratorFetch', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Default successful session
        supabase.auth.getSession.mockResolvedValue({
            data: {
                session: {
                    access_token: 'mock-token-12345',
                },
            },
            error: null,
        });

        // Default empty cache
        AsyncStorage.getItem.mockResolvedValue(null);
        AsyncStorage.getAllKeys.mockResolvedValue([]);
    });

    describe('generateQuestionsFromImage', () => {
        it('should return questions on successful generation', async () => {
            // Mock image fetch
            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    blob: () => Promise.resolve(new Blob(['image'], { type: 'image/jpeg' })),
                })
                // Mock Edge Function response
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve(successResponse),
                });

            const result = await generateQuestionsFromImage(
                'file:///test/image.jpg',
                1,
                undefined,
                undefined,
                false // Disable cache for test
            );

            expect(result.questions).toHaveLength(1);
            expect(result.questions[0].question_text).toBe('What is 2+2?');
            expect(result.totalGenerated).toBe(1);
            expect(result.error).toBeUndefined();
            expect(result.usage).toEqual({ dailyRemaining: 9, monthlyRemaining: 99 });
        });

        it('should return cached result when available', async () => {
            const cachedData = {
                questions: [validQuestion, { ...validQuestion, question_text: 'Cached Q2' }],
                timestamp: Date.now(),
                questionCount: 5,
            };

            AsyncStorage.getItem.mockResolvedValue(JSON.stringify(cachedData));

            const result = await generateQuestionsFromImage(
                'file:///test/image.jpg',
                2,
                undefined,
                undefined,
                true // Enable cache
            );

            expect(result.questions).toHaveLength(2);
            expect(result.fromCache).toBe(true);
            expect(mockFetch).not.toHaveBeenCalled(); // Should not call API
        });

        it('should bypass expired cache', async () => {
            const expiredCachedData = {
                questions: [validQuestion],
                timestamp: Date.now() - (25 * 60 * 60 * 1000), // 25 hours ago (expired)
                questionCount: 5,
            };

            AsyncStorage.getItem.mockResolvedValue(JSON.stringify(expiredCachedData));

            // Mock API calls
            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    blob: () => Promise.resolve(new Blob(['image'], { type: 'image/jpeg' })),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve(successResponse),
                });

            const result = await generateQuestionsFromImage(
                'file:///test/image.jpg',
                1,
                undefined,
                undefined,
                true
            );

            expect(result.fromCache).toBeFalsy();
            expect(AsyncStorage.removeItem).toHaveBeenCalled(); // Should remove expired cache
        });

        it('should handle authentication errors', async () => {
            supabase.auth.getSession.mockResolvedValue({
                data: { session: null },
                error: null,
            });

            const result = await generateQuestionsFromImage(
                'file:///test/image.jpg',
                1,
                undefined,
                undefined,
                false
            );

            expect(result.error).toContain('sign in');
            expect(result.questions).toHaveLength(0);
        });

        it('should handle 401 response from Edge Function', async () => {
            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    blob: () => Promise.resolve(new Blob(['image'], { type: 'image/jpeg' })),
                })
                .mockResolvedValueOnce({
                    ok: false,
                    status: 401,
                    json: () => Promise.resolve({ error: 'Invalid token' }),
                });

            const result = await generateQuestionsFromImage(
                'file:///test/image.jpg',
                1,
                undefined,
                undefined,
                false
            );

            expect(result.error).toContain('Session expired');
            expect(result.questions).toHaveLength(0);
        });

        it('should handle 429 rate limit response', async () => {
            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    blob: () => Promise.resolve(new Blob(['image'], { type: 'image/jpeg' })),
                })
                .mockResolvedValueOnce({
                    ok: false,
                    status: 429,
                    json: () => Promise.resolve({
                        error: 'Daily limit reached',
                        usage: { dailyRemaining: 0, monthlyRemaining: 50 },
                    }),
                });

            const result = await generateQuestionsFromImage(
                'file:///test/image.jpg',
                1,
                undefined,
                undefined,
                false
            );

            expect(result.error).toContain('Daily limit');
            expect(result.questions).toHaveLength(0);
        });

        it('should handle network errors gracefully', async () => {
            mockFetch.mockRejectedValueOnce(new TypeError('Network error'));

            const result = await generateQuestionsFromImage(
                'file:///test/image.jpg',
                1,
                undefined,
                undefined,
                false
            );

            expect(result.error).toContain('Network error');
            expect(result.questions).toHaveLength(0);
        });

        it('should handle timeout errors', async () => {
            const abortError = new Error('timeout');
            abortError.name = 'AbortError';

            mockFetch.mockRejectedValueOnce(abortError);

            const result = await generateQuestionsFromImage(
                'file:///test/image.jpg',
                1,
                undefined,
                undefined,
                false
            );

            expect(result.error).toContain('timeout');
            expect(result.questions).toHaveLength(0);
        });

        it('should call onProgress callback at each stage', async () => {
            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    blob: () => Promise.resolve(new Blob(['image'], { type: 'image/jpeg' })),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve(successResponse),
                });

            const progressUpdates: string[] = [];
            const onProgress = (text: string) => progressUpdates.push(text);

            await generateQuestionsFromImage(
                'file:///test/image.jpg',
                1,
                undefined,
                onProgress,
                false
            );

            expect(progressUpdates.length).toBeGreaterThanOrEqual(3);
            expect(progressUpdates[0]).toContain('Processing');
            expect(progressUpdates[progressUpdates.length - 1]).toContain('Generated');
        });

        it('should cache successful results', async () => {
            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    blob: () => Promise.resolve(new Blob(['image'], { type: 'image/jpeg' })),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve(successResponse),
                });

            await generateQuestionsFromImage(
                'file:///test/image.jpg',
                1,
                undefined,
                undefined,
                true // Enable cache
            );

            expect(AsyncStorage.setItem).toHaveBeenCalled();
        });

        it('should not cache failed results', async () => {
            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    blob: () => Promise.resolve(new Blob(['image'], { type: 'image/jpeg' })),
                })
                .mockResolvedValueOnce({
                    ok: false,
                    status: 500,
                    json: () => Promise.resolve({ error: 'Server error' }),
                });

            await generateQuestionsFromImage(
                'file:///test/image.jpg',
                1,
                undefined,
                undefined,
                true
            );

            expect(AsyncStorage.setItem).not.toHaveBeenCalled();
        });
    });

    describe('generateQuestionsFromMultipleImages', () => {
        it('should combine questions from multiple images', async () => {
            const responseWithQ2 = {
                questions: [{ ...validQuestion, question_text: 'Question from image 2' }],
                totalGenerated: 1,
            };

            // Set up responses for 2 images
            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    blob: () => Promise.resolve(new Blob(['img1'])),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve(successResponse),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    blob: () => Promise.resolve(new Blob(['img2'])),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve(responseWithQ2),
                });

            const result = await generateQuestionsFromMultipleImages(
                ['file:///img1.jpg', 'file:///img2.jpg'],
                1
            );

            expect(result.questions).toHaveLength(2);
            expect(result.totalGenerated).toBe(2);
        });

        it('should skip failed images and continue', async () => {
            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    blob: () => Promise.resolve(new Blob(['img1'])),
                })
                .mockResolvedValueOnce({
                    ok: false,
                    status: 500,
                    json: () => Promise.resolve({ error: 'Failed' }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    blob: () => Promise.resolve(new Blob(['img2'])),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve(successResponse),
                });

            const result = await generateQuestionsFromMultipleImages(
                ['file:///img1.jpg', 'file:///img2.jpg'],
                1
            );

            expect(result.questions).toHaveLength(1); // Only second image succeeded
            expect(result.error).toBeUndefined();
        });

        it('should return error if all images fail', async () => {
            mockFetch.mockResolvedValue({
                ok: false,
                status: 500,
                json: () => Promise.resolve({ error: 'Failed' }),
            });

            const result = await generateQuestionsFromMultipleImages(
                ['file:///img1.jpg', 'file:///img2.jpg'],
                1
            );

            expect(result.questions).toHaveLength(0);
            expect(result.error).toBeDefined();
        });
    });

    describe('clearAICache', () => {
        it('should remove all cache entries', async () => {
            AsyncStorage.getAllKeys.mockResolvedValue([
                'ai_questions_cache_abc123',
                'ai_questions_cache_def456',
                'other_key',
            ]);

            await clearAICache();

            expect(AsyncStorage.multiRemove).toHaveBeenCalledWith([
                'ai_questions_cache_abc123',
                'ai_questions_cache_def456',
            ]);
        });

        it('should handle empty cache gracefully', async () => {
            AsyncStorage.getAllKeys.mockResolvedValue([]);

            await expect(clearAICache()).resolves.not.toThrow();
        });
    });
});
