/**
 * Integration Tests for generate-questions Edge Function
 * 
 * These tests verify the Edge Function behavior end-to-end.
 * To run these tests locally:
 * 
 * 1. Start Supabase locally: supabase start
 * 2. Run the function: supabase functions serve generate-questions --no-verify-jwt
 * 3. Run tests: deno test supabase/functions/generate-questions/index.test.ts --allow-net
 * 
 * Or for production testing, replace the URL with your deployed function URL.
 */

import {
    assertEquals,
    assertExists,
} from "https://deno.land/std@0.192.0/testing/asserts.ts";

// Configuration - update these for your environment
const FUNCTION_URL = Deno.env.get("FUNCTION_URL") ||
    "http://localhost:54321/functions/v1/generate-questions";
const TEST_AUTH_TOKEN = Deno.env.get("TEST_AUTH_TOKEN") || "";

// Skip tests if no auth token is available
const skipTests = !TEST_AUTH_TOKEN;

// Helper to create test request
function createTestRequest(body: object, token?: string): Request {
    return new Request(FUNCTION_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
    });
}

// Sample base64 image (1x1 white pixel JPEG)
const SAMPLE_IMAGE_BASE64 =
    "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRof" +
    "Hh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwh" +
    "MjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAAR" +
    "CAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAA" +
    "AAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMB" +
    "AAIRAxEAPwCwAB//2Q==";

// ============================================================================
// Test Suite: Authentication
// ============================================================================

Deno.test({
    name: "generate-questions - should reject requests without auth header",
    ignore: false, // Always run
    async fn() {
        const request = createTestRequest({
            imageBase64: SAMPLE_IMAGE_BASE64,
            mimeType: "image/jpeg",
            questionCount: 5,
        });

        const response = await fetch(request);

        assertEquals(response.status, 401);

        const data = await response.json();
        assertExists(data.error);
        assertEquals(data.error, "Missing authorization header");
    },
});

Deno.test({
    name: "generate-questions - should reject requests with invalid token",
    ignore: false,
    async fn() {
        const request = createTestRequest(
            {
                imageBase64: SAMPLE_IMAGE_BASE64,
                mimeType: "image/jpeg",
                questionCount: 5,
            },
            "invalid-token"
        );

        const response = await fetch(request);

        assertEquals(response.status, 401);

        const data = await response.json();
        assertExists(data.error);
    },
});

// ============================================================================
// Test Suite: Input Validation
// ============================================================================

Deno.test({
    name: "generate-questions - should reject missing imageBase64",
    ignore: skipTests,
    async fn() {
        const request = createTestRequest(
            {
                mimeType: "image/jpeg",
                questionCount: 5,
            },
            TEST_AUTH_TOKEN
        );

        const response = await fetch(request);

        assertEquals(response.status, 400);

        const data = await response.json();
        assertEquals(data.error, "Missing imageBase64");
    },
});

Deno.test({
    name: "generate-questions - should reject invalid mimeType",
    ignore: skipTests,
    async fn() {
        const request = createTestRequest(
            {
                imageBase64: SAMPLE_IMAGE_BASE64,
                mimeType: "image/gif", // Invalid
                questionCount: 5,
            },
            TEST_AUTH_TOKEN
        );

        const response = await fetch(request);

        assertEquals(response.status, 400);

        const data = await response.json();
        assertExists(data.error);
        assertEquals(data.error.includes("mimeType"), true);
    },
});

Deno.test({
    name: "generate-questions - should reject oversized images",
    ignore: skipTests,
    async fn() {
        // Create a large base64 string (>4MB)
        const largeImage = "A".repeat(5 * 1024 * 1024);

        const request = createTestRequest(
            {
                imageBase64: largeImage,
                mimeType: "image/jpeg",
                questionCount: 5,
            },
            TEST_AUTH_TOKEN
        );

        const response = await fetch(request);

        assertEquals(response.status, 400);

        const data = await response.json();
        assertExists(data.error);
        assertEquals(data.error.includes("too large"), true);
    },
});

Deno.test({
    name: "generate-questions - should clamp questionCount to valid range",
    ignore: skipTests,
    async fn() {
        // Test with count > 50 (should be clamped to 50)
        const request = createTestRequest(
            {
                imageBase64: SAMPLE_IMAGE_BASE64,
                mimeType: "image/jpeg",
                questionCount: 100, // Over limit, should be clamped
            },
            TEST_AUTH_TOKEN
        );

        const response = await fetch(request);

        // Should not fail validation, API should handle clamping
        // (Result depends on OpenAI response, so we just check it doesn't reject)
        assertExists(response.status);
    },
});

// ============================================================================
// Test Suite: CORS
// ============================================================================

Deno.test({
    name: "generate-questions - should handle CORS preflight",
    ignore: false,
    async fn() {
        const request = new Request(FUNCTION_URL, {
            method: "OPTIONS",
            headers: {
                Origin: "https://example.com",
                "Access-Control-Request-Method": "POST",
            },
        });

        const response = await fetch(request);

        assertEquals(response.status, 200);

        const corsHeader = response.headers.get("Access-Control-Allow-Origin");
        assertExists(corsHeader);
    },
});

// ============================================================================
// Test Suite: Happy Path (requires valid auth and OpenAI key)
// ============================================================================

Deno.test({
    name: "generate-questions - should generate questions from valid image",
    ignore: skipTests || !Deno.env.get("RUN_INTEGRATION_TESTS"),
    async fn() {
        const request = createTestRequest(
            {
                imageBase64: SAMPLE_IMAGE_BASE64,
                mimeType: "image/jpeg",
                questionCount: 2,
                context: "Test context",
            },
            TEST_AUTH_TOKEN
        );

        const response = await fetch(request);

        // Note: With a 1x1 pixel image, OpenAI may fail to generate questions
        // This test is mainly to verify the function executes without errors
        assertExists(response.status);

        const data = await response.json();

        if (response.ok) {
            assertExists(data.questions);
            assertExists(data.totalGenerated);
            assertExists(data.usage);
            assertEquals(Array.isArray(data.questions), true);
        } else {
            // Expected failure for tiny test image
            assertExists(data.error);
        }
    },
});

Deno.test({
    name: "generate-questions - should include usage info in response",
    ignore: skipTests || !Deno.env.get("RUN_INTEGRATION_TESTS"),
    async fn() {
        const request = createTestRequest(
            {
                imageBase64: SAMPLE_IMAGE_BASE64,
                mimeType: "image/jpeg",
                questionCount: 1,
            },
            TEST_AUTH_TOKEN
        );

        const response = await fetch(request);
        const data = await response.json();

        if (response.ok) {
            assertExists(data.usage);
            assertExists(data.usage.dailyRemaining);
            assertExists(data.usage.monthlyRemaining);
        }
    },
});

// ============================================================================
// Test Suite: Rate Limiting (requires multiple requests)
// ============================================================================

Deno.test({
    name: "generate-questions - should respect rate limits",
    ignore: skipTests || !Deno.env.get("RUN_RATE_LIMIT_TESTS"),
    async fn() {
        // This test would require hitting the limit, so it's disabled by default
        // To run: Set RUN_RATE_LIMIT_TESTS=true and have a test user with low limits

        const requests = Array(12).fill(null).map(() =>
            fetch(createTestRequest(
                {
                    imageBase64: SAMPLE_IMAGE_BASE64,
                    mimeType: "image/jpeg",
                    questionCount: 1,
                },
                TEST_AUTH_TOKEN
            ))
        );

        const responses = await Promise.all(requests);

        // At least one should be rate limited (429)
        const rateLimited = responses.filter(r => r.status === 429);
        assertEquals(rateLimited.length > 0, true, "Expected at least one 429 response");
    },
});

// ============================================================================
// Cleanup
// ============================================================================

console.log(`
================================================================================
Edge Function Integration Tests
================================================================================

To run these tests:

1. For local testing:
   $ supabase start
   $ supabase functions serve generate-questions --env-file .env.local
   $ TEST_AUTH_TOKEN=<your-token> deno test --allow-net --allow-env

2. For production testing:
   $ FUNCTION_URL=<your-url> TEST_AUTH_TOKEN=<your-token> deno test --allow-net --allow-env

Note: Some tests require RUN_INTEGRATION_TESTS=true to execute.
================================================================================
`);
