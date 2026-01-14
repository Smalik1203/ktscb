import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from 'jsr:@supabase/supabase-js@2';

/**
 * generate-questions Edge Function
 * 
 * Securely generates MCQ questions from an image using OpenAI Vision API.
 * Features:
 * - Server-side API key storage (secure)
 * - User authentication validation
 * - Rate limiting (daily/monthly quotas)
 * - Usage logging for analytics
 * 
 * Request body:
 * {
 *   imageBase64: string,    // Base64 encoded image
 *   mimeType: string,       // 'image/jpeg' or 'image/png'
 *   questionCount: number,  // 1-50
 *   context?: string        // Optional focus/context for questions
 * }
 * 
 * Response:
 * {
 *   questions: GeneratedQuestion[],
 *   totalGenerated: number,
 *   usage?: { dailyRemaining: number, monthlyRemaining: number },
 *   error?: string
 * }
 */

interface GenerateQuestionsRequest {
    imageBase64: string;
    mimeType: string;
    questionCount: number;
    context?: string;
}

interface GeneratedQuestion {
    question_text: string;
    question_type: 'mcq';
    options: string[];
    correct_index: number;
    explanation: string;
}

interface GenerationResult {
    questions: GeneratedQuestion[];
    totalGenerated: number;
    usage?: {
        dailyRemaining: number;
        monthlyRemaining: number;
    };
    error?: string;
}

interface RateLimitResult {
    allowed: boolean;
    daily_remaining: number;
    monthly_remaining: number;
    reason: string;
}

// CORS headers for browser requests
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Check rate limits for a user
 */
async function checkRateLimit(
    supabaseAdmin: SupabaseClient,
    userId: string
): Promise<RateLimitResult> {
    const { data, error } = await supabaseAdmin.rpc('check_ai_rate_limit', {
        p_user_id: userId,
    });

    if (error) {
        console.error('Rate limit check error:', error);
        // On error, allow the request but log it
        return { allowed: true, daily_remaining: -1, monthly_remaining: -1, reason: 'OK' };
    }

    // RPC returns an array, get first row
    const result = data?.[0];
    if (!result) {
        return { allowed: true, daily_remaining: 10, monthly_remaining: 100, reason: 'OK' };
    }

    return result;
}

/**
 * Increment usage counters after successful generation
 */
async function incrementUsage(
    supabaseAdmin: SupabaseClient,
    userId: string,
    schoolCode: string
): Promise<void> {
    const { error } = await supabaseAdmin.rpc('increment_ai_usage', {
        p_user_id: userId,
        p_school_code: schoolCode,
    });

    if (error) {
        console.error('Failed to increment usage:', error);
    }
}

/**
 * Log the generation attempt for analytics
 */
async function logGeneration(
    supabaseAdmin: SupabaseClient,
    params: {
        userId: string;
        schoolCode: string;
        questionCountRequested: number;
        hasContext: boolean;
        imageSizeBytes: number;
        questionsGenerated: number;
        success: boolean;
        errorMessage: string | null;
        durationMs: number;
    }
): Promise<void> {
    const { error } = await supabaseAdmin.rpc('log_ai_generation', {
        p_user_id: params.userId,
        p_school_code: params.schoolCode,
        p_question_count_requested: params.questionCountRequested,
        p_has_context: params.hasContext,
        p_image_size_bytes: params.imageSizeBytes,
        p_questions_generated: params.questionsGenerated,
        p_success: params.success,
        p_error_message: params.errorMessage,
        p_duration_ms: params.durationMs,
    });

    if (error) {
        console.error('Failed to log generation:', error);
    }
}

Deno.serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    const startTime = Date.now();
    let userId = '';
    let schoolCode = '';
    let questionCountRequested = 0;
    let hasContext = false;
    let imageSizeBytes = 0;

    // Create admin client for rate limiting and logging (bypasses RLS)
    const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    try {
        // 1. Validate authentication
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: 'Missing authorization header' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Create authenticated Supabase client
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_ANON_KEY')!,
            { global: { headers: { Authorization: authHeader } } }
        );

        // Verify user is authenticated
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            console.error('Auth error:', authError?.message);
            return new Response(
                JSON.stringify({ error: 'Invalid or expired token' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        userId = user.id;
        console.log(`User ${userId} requesting AI question generation`);

        // 2. Get user's school code for logging
        const { data: userProfile } = await supabaseAdmin
            .from('users')
            .select('school_code')
            .eq('id', userId)
            .single();

        schoolCode = userProfile?.school_code || 'unknown';

        // 3. Check rate limits
        const rateLimit = await checkRateLimit(supabaseAdmin, userId);

        if (!rateLimit.allowed) {
            console.log(`Rate limit exceeded for user ${userId}: ${rateLimit.reason}`);

            // Log the failed attempt
            await logGeneration(supabaseAdmin, {
                userId,
                schoolCode,
                questionCountRequested: 0,
                hasContext: false,
                imageSizeBytes: 0,
                questionsGenerated: 0,
                success: false,
                errorMessage: rateLimit.reason,
                durationMs: Date.now() - startTime,
            });

            return new Response(
                JSON.stringify({
                    error: rateLimit.reason,
                    usage: {
                        dailyRemaining: rateLimit.daily_remaining,
                        monthlyRemaining: rateLimit.monthly_remaining,
                    }
                }),
                { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // 4. Parse and validate request
        const body: GenerateQuestionsRequest = await req.json();
        const { imageBase64, mimeType, questionCount, context } = body;

        questionCountRequested = questionCount || 10;
        hasContext = !!context;
        imageSizeBytes = imageBase64?.length || 0;

        // Validate required fields
        if (!imageBase64) {
            return new Response(
                JSON.stringify({ error: 'Missing imageBase64' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        if (!mimeType || !['image/jpeg', 'image/png'].includes(mimeType)) {
            return new Response(
                JSON.stringify({ error: 'Invalid mimeType. Must be image/jpeg or image/png' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Validate question count (1-50)
        const count = Math.max(1, Math.min(50, questionCountRequested));

        // Check image size (max ~4MB base64 = ~3MB actual)
        if (imageBase64.length > 4 * 1024 * 1024) {
            return new Response(
                JSON.stringify({ error: 'Image too large. Please use a smaller image (max 3MB)' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // 5. Get OpenAI API key from Supabase secrets
        const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
        if (!OPENAI_API_KEY) {
            console.error('OPENAI_API_KEY not configured in Supabase secrets');

            await logGeneration(supabaseAdmin, {
                userId,
                schoolCode,
                questionCountRequested: count,
                hasContext,
                imageSizeBytes,
                questionsGenerated: 0,
                success: false,
                errorMessage: 'AI service not configured',
                durationMs: Date.now() - startTime,
            });

            return new Response(
                JSON.stringify({ error: 'AI service not configured. Please contact support.' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // 6. Build OpenAI prompt
        const prompt = `Analyze this educational image and create ${count} MCQ questions.

${context ? `Focus: ${context}` : ''}

Return JSON only:
{
  "questions": [
    {
      "question_text": "Question?",
      "options": ["A", "B", "C", "D"],
      "correct_index": 0,
      "explanation": "Why answer is correct"
    }
  ]
}

Rules:
- Exactly ${count} questions
- Accurate, clear questions
- 4 options per question
- Brief explanations
- Valid JSON only`;

        // 7. Call OpenAI Vision API
        console.log(`Calling OpenAI with ${count} questions requested`);
        const apiStartTime = Date.now();

        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: prompt,
                            },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: `data:${mimeType};base64,${imageBase64}`,
                                    detail: 'low',
                                },
                            },
                        ],
                    },
                ],
                max_tokens: 2500,
                temperature: 0.3,
            }),
        });

        const apiDuration = Date.now() - apiStartTime;
        console.log(`OpenAI responded in ${apiDuration}ms`);

        // 8. Handle OpenAI errors
        if (!openaiResponse.ok) {
            const errorText = await openaiResponse.text();
            console.error('OpenAI API error:', openaiResponse.status, errorText);

            let userMessage = 'AI service temporarily unavailable. Please try again.';

            if (openaiResponse.status === 429) {
                userMessage = 'AI service is busy. Please wait a moment and try again.';
            } else if (openaiResponse.status === 401) {
                userMessage = 'AI service authentication error. Please contact support.';
            }

            await logGeneration(supabaseAdmin, {
                userId,
                schoolCode,
                questionCountRequested: count,
                hasContext,
                imageSizeBytes,
                questionsGenerated: 0,
                success: false,
                errorMessage: `OpenAI ${openaiResponse.status}: ${errorText.substring(0, 200)}`,
                durationMs: Date.now() - startTime,
            });

            return new Response(
                JSON.stringify({ error: userMessage }),
                { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // 9. Parse OpenAI response
        const openaiData = await openaiResponse.json();
        const content = openaiData.choices?.[0]?.message?.content || '';

        if (!content) {
            console.error('Empty response from OpenAI');

            await logGeneration(supabaseAdmin, {
                userId,
                schoolCode,
                questionCountRequested: count,
                hasContext,
                imageSizeBytes,
                questionsGenerated: 0,
                success: false,
                errorMessage: 'Empty response from OpenAI',
                durationMs: Date.now() - startTime,
            });

            return new Response(
                JSON.stringify({ error: 'No response from AI. Please try again.' }),
                { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // 10. Parse JSON from AI response
        let parsedData;
        try {
            const cleanedContent = content
                .replace(/```json\n?/g, '')
                .replace(/```\n?/g, '')
                .trim();

            parsedData = JSON.parse(cleanedContent);
        } catch (parseError) {
            console.error('Failed to parse AI response:', content.substring(0, 500));

            await logGeneration(supabaseAdmin, {
                userId,
                schoolCode,
                questionCountRequested: count,
                hasContext,
                imageSizeBytes,
                questionsGenerated: 0,
                success: false,
                errorMessage: 'Failed to parse AI response',
                durationMs: Date.now() - startTime,
            });

            return new Response(
                JSON.stringify({ error: 'Failed to parse AI response. Please try again.' }),
                { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // 11. Validate and filter questions
        if (!parsedData.questions || !Array.isArray(parsedData.questions)) {
            console.error('Invalid response format:', parsedData);

            await logGeneration(supabaseAdmin, {
                userId,
                schoolCode,
                questionCountRequested: count,
                hasContext,
                imageSizeBytes,
                questionsGenerated: 0,
                success: false,
                errorMessage: 'Invalid response format from AI',
                durationMs: Date.now() - startTime,
            });

            return new Response(
                JSON.stringify({ error: 'Invalid response format from AI' }),
                { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const validQuestions: GeneratedQuestion[] = parsedData.questions
            .filter((q: any) => {
                return (
                    q.question_text &&
                    Array.isArray(q.options) &&
                    q.options.length === 4 &&
                    typeof q.correct_index === 'number' &&
                    q.correct_index >= 0 &&
                    q.correct_index <= 3 &&
                    q.explanation
                );
            })
            .map((q: any) => ({
                question_text: q.question_text,
                question_type: 'mcq' as const,
                options: q.options,
                correct_index: q.correct_index,
                explanation: q.explanation || 'No explanation provided',
            }));

        if (validQuestions.length === 0) {
            console.error('No valid questions after filtering');

            await logGeneration(supabaseAdmin, {
                userId,
                schoolCode,
                questionCountRequested: count,
                hasContext,
                imageSizeBytes,
                questionsGenerated: 0,
                success: false,
                errorMessage: 'No valid questions generated',
                durationMs: Date.now() - startTime,
            });

            return new Response(
                JSON.stringify({ error: 'No valid questions generated. Try a clearer image.' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // 12. Log successful generation and increment usage
        const totalDuration = Date.now() - startTime;
        console.log(`Generated ${validQuestions.length} valid questions for user ${userId} in ${totalDuration}ms`);

        await logGeneration(supabaseAdmin, {
            userId,
            schoolCode,
            questionCountRequested: count,
            hasContext,
            imageSizeBytes,
            questionsGenerated: validQuestions.length,
            success: true,
            errorMessage: null,
            durationMs: totalDuration,
        });

        await incrementUsage(supabaseAdmin, userId, schoolCode);

        // 13. Return success response with usage info
        const result: GenerationResult = {
            questions: validQuestions,
            totalGenerated: validQuestions.length,
            usage: {
                dailyRemaining: rateLimit.daily_remaining - 1,
                monthlyRemaining: rateLimit.monthly_remaining - 1,
            },
        };

        return new Response(
            JSON.stringify(result),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('Unexpected error:', error);

        // Log the error
        if (userId) {
            await logGeneration(supabaseAdmin, {
                userId,
                schoolCode,
                questionCountRequested,
                hasContext,
                imageSizeBytes,
                questionsGenerated: 0,
                success: false,
                errorMessage: (error as Error).message,
                durationMs: Date.now() - startTime,
            });
        }

        return new Response(
            JSON.stringify({ error: (error as Error).message || 'An unexpected error occurred' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
