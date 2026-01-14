import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from 'jsr:@supabase/supabase-js@2';

/**
 * generate-report-comment Edge Function
 * 
 * Generates AI-powered report card comments for students with:
 * - Quality controls (banned phrases, positivity check)
 * - Data aggregation from grades, attendance, trends
 * - Parent-safe language enforcement
 * 
 * Request body:
 * {
 *   studentId: string,
 *   classInstanceId: string,
 *   schoolCode: string,
 *   tone: 'professional' | 'friendly' | 'encouraging',
 *   focus: 'academic' | 'behavioral' | 'holistic',
 *   language: 'english' | 'hindi' | 'bilingual',
 *   teacherNotes?: string
 * }
 */

interface GenerateCommentRequest {
    studentId: string;
    classInstanceId: string;
    schoolCode: string;
    tone?: 'professional' | 'friendly' | 'encouraging';
    focus?: 'academic' | 'behavioral' | 'holistic';
    language?: 'english' | 'hindi' | 'bilingual';
    teacherNotes?: string;
}

interface StudentData {
    student_id: string;
    student_name: string;
    student_code: string;
    subjects: Array<{ subject_name: string; average_percentage: number }>;
    attendance: { present: number; absent: number; total: number; percentage: number };
    trend: string;
}

// Banned phrases that should never appear in parent-facing comments
const BANNED_PHRASES = [
    // Absolute negatives
    'worst', 'terrible', 'awful', 'hopeless', 'useless',
    'failing', 'failure', 'cannot', 'never will',
    // Comparisons
    'compared to', 'unlike other', 'behind other', 'lowest in',
    'worst in class', 'better than', 'worse than',
    // Predictions
    'will fail', 'will not pass', 'won\'t succeed',
    'unlikely to', 'doubtful', 'no chance',
    // Blame
    'lazy', 'doesn\'t care', 'refuses to', 'disobedient',
    'problematic', 'troublemaker',
    // Parent triggers
    'concerned about', 'worried about', 'disappointed',
    'not meeting expectations', 'below standard'
];

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Build the system prompt for report card generation
 */
function buildSystemPrompt(tone: string, focus: string, language: string): string {
    const toneDescriptions = {
        professional: 'formal and objective',
        friendly: 'warm and personable',
        encouraging: 'supportive and motivating'
    };

    const focusDescriptions = {
        academic: 'primarily on academic performance and subject-specific achievements',
        behavioral: 'on classroom behavior, participation, and social skills',
        holistic: 'on overall development including academics, attendance, and personal growth'
    };

    return `You are an experienced, empathetic school teacher writing a report card comment for a parent to read.

ABSOLUTE RULES (violations will cause rejection):
- Never compare the student to other students
- Never use absolute negative words: "worst", "failing", "hopeless", "never"
- Never make predictions: "will fail", "won't pass", "cannot improve"
- Never blame the student personally
- Always include at least one specific strength
- Always frame areas for growth constructively
- Use encouraging language even for struggling students

TONE: ${toneDescriptions[tone as keyof typeof toneDescriptions] || 'warm and personable'}
FOCUS: ${focusDescriptions[focus as keyof typeof focusDescriptions] || 'overall development'}
LENGTH: 60-100 words exactly
LANGUAGE: ${language === 'hindi' ? 'Hindi' : language === 'bilingual' ? 'Mix of English and Hindi' : 'English'}

STRUCTURE:
1. Open with a positive observation (specific subject or behavior)
2. Mention academic performance with specific subjects and percentages
3. Note attendance if relevant
4. Suggest one area for growth (framed as opportunity)
5. Close with encouragement`;
}

/**
 * Build the user prompt with student data
 */
function buildUserPrompt(data: StudentData, teacherNotes?: string): string {
    const subjectsTable = data.subjects
        .map(s => `${s.subject_name}: ${s.average_percentage}%`)
        .join(' | ');

    const overallAvg = data.subjects.length > 0
        ? (data.subjects.reduce((sum, s) => sum + s.average_percentage, 0) / data.subjects.length).toFixed(1)
        : 'N/A';

    const attendanceStatus = data.attendance.percentage >= 90 ? 'Excellent'
        : data.attendance.percentage >= 75 ? 'Good'
            : data.attendance.percentage >= 60 ? 'Needs improvement'
                : 'Concerning';

    return `Generate a report card comment for:

Student: ${data.student_name}

Academic Performance:
${subjectsTable || 'No assessment data available'}
Overall Average: ${overallAvg}%

Attendance: ${data.attendance.percentage}% (${attendanceStatus})
Present: ${data.attendance.present} | Absent: ${data.attendance.absent} | Total: ${data.attendance.total}

Performance Trend: ${data.trend}

${teacherNotes ? `Teacher Notes: ${teacherNotes}` : ''}

Write a personalized, parent-appropriate comment following all rules.`;
}

/**
 * Check comment for banned phrases
 */
function checkBannedPhrases(comment: string): string[] {
    const lowerComment = comment.toLowerCase();
    return BANNED_PHRASES.filter(phrase => lowerComment.includes(phrase.toLowerCase()));
}

/**
 * Calculate word count
 */
function countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Simple positivity score (0-1) based on positive/negative word ratio
 */
function calculatePositivityScore(comment: string): number {
    const positiveWords = ['excellent', 'great', 'wonderful', 'impressive', 'outstanding',
        'dedicated', 'improvement', 'progress', 'growth', 'strength', 'enthusiastic',
        'consistent', 'motivated', 'hardworking', 'potential', 'commendable', 'bright'];
    const negativeWords = ['needs', 'improve', 'focus', 'attention', 'challenge',
        'difficult', 'struggle', 'weakness', 'concern', 'below'];

    const lowerComment = comment.toLowerCase();
    const words = lowerComment.split(/\s+/);

    const positiveCount = positiveWords.reduce((count, word) =>
        count + (lowerComment.includes(word) ? 1 : 0), 0);
    const negativeCount = negativeWords.reduce((count, word) =>
        count + (lowerComment.includes(word) ? 1 : 0), 0);

    const total = positiveCount + negativeCount;
    if (total === 0) return 0.5;

    return Math.min(1, Math.max(0, positiveCount / total));
}

Deno.serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    // Create admin client
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

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_ANON_KEY')!,
            { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return new Response(
                JSON.stringify({ error: 'Invalid or expired token' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // 2. Parse request
        const body: GenerateCommentRequest = await req.json();
        const {
            studentId,
            classInstanceId,
            schoolCode,
            tone = 'friendly',
            focus = 'holistic',
            language = 'english',
            teacherNotes
        } = body;

        if (!studentId || !classInstanceId || !schoolCode) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields: studentId, classInstanceId, schoolCode' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // 3. Get student data
        const { data: studentData, error: dataError } = await supabaseAdmin
            .rpc('get_student_report_data', {
                p_student_id: studentId,
                p_class_instance_id: classInstanceId
            });

        if (dataError || !studentData) {
            console.error('Failed to get student data:', dataError);
            return new Response(
                JSON.stringify({ error: 'Failed to fetch student data' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // 4. Check rate limit (reuse existing system)
        const { data: rateLimit } = await supabaseAdmin.rpc('check_ai_rate_limit', {
            p_user_id: user.id,
        });

        const limitResult = rateLimit?.[0];
        if (limitResult && !limitResult.allowed) {
            return new Response(
                JSON.stringify({ error: limitResult.reason }),
                { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // 5. Get OpenAI API key
        const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
        if (!OPENAI_API_KEY) {
            return new Response(
                JSON.stringify({ error: 'AI service not configured' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // 6. Build prompts
        const systemPrompt = buildSystemPrompt(tone, focus, language);
        const userPrompt = buildUserPrompt(studentData, teacherNotes);

        // 7. Call OpenAI
        console.log(`Generating comment for student ${studentId}`);
        const startTime = Date.now();

        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                max_tokens: 300,
                temperature: 0.7,
            }),
        });

        const duration = Date.now() - startTime;
        console.log(`OpenAI responded in ${duration}ms`);

        if (!openaiResponse.ok) {
            const errorText = await openaiResponse.text();
            console.error('OpenAI error:', errorText);
            return new Response(
                JSON.stringify({ error: 'AI service temporarily unavailable' }),
                { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // 8. Parse response
        const openaiData = await openaiResponse.json();
        const generatedComment = openaiData.choices?.[0]?.message?.content?.trim() || '';

        if (!generatedComment) {
            return new Response(
                JSON.stringify({ error: 'No comment generated' }),
                { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // 9. Validate comment
        const bannedFound = checkBannedPhrases(generatedComment);
        if (bannedFound.length > 0) {
            console.warn('Comment contains banned phrases:', bannedFound);
            // Could regenerate here, but for now we'll flag it
        }

        const wordCount = countWords(generatedComment);
        const positivityScore = calculatePositivityScore(generatedComment);

        // 10. Save to database
        const { data: savedId, error: saveError } = await supabaseAdmin.rpc('save_report_comment', {
            p_student_id: studentId,
            p_class_instance_id: classInstanceId,
            p_school_code: schoolCode,
            p_generated_comment: generatedComment,
            p_input_data: studentData,
            p_tone: tone,
            p_focus: focus,
            p_language: language,
            p_word_count: wordCount,
            p_positivity_score: positivityScore
        });

        if (saveError) {
            console.error('Failed to save comment:', saveError);
        }

        // 11. Increment usage
        await supabaseAdmin.rpc('increment_ai_usage', {
            p_user_id: user.id,
            p_school_code: schoolCode,
        });

        // 12. Return result
        return new Response(
            JSON.stringify({
                success: true,
                comment: {
                    id: savedId,
                    studentId,
                    studentName: studentData.student_name,
                    generatedComment,
                    inputData: studentData,
                    wordCount,
                    positivityScore,
                    tone,
                    focus,
                    language,
                    status: 'draft',
                    warnings: bannedFound.length > 0 ? ['Contains potentially problematic phrases'] : []
                }
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('Unexpected error:', error);
        return new Response(
            JSON.stringify({ error: (error as Error).message || 'An unexpected error occurred' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
