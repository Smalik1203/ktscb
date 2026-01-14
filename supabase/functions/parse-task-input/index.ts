import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from 'jsr:@supabase/supabase-js@2';

/**
 * parse-task-input Edge Function
 * 
 * Parses natural language (voice or text) into structured task data with:
 * - Per-field confidence scores
 * - Class/subject matching within school + academic year
 * - IST date resolution for relative dates
 * - Audit logging for all attempts
 * 
 * Request body:
 * {
 *   input_type: 'voice' | 'text',
 *   audio_base64?: string,      // if voice
 *   text?: string,              // if text
 *   school_code: string,
 *   academic_year_id: string,
 *   available_classes: Array<{ id: string, label: string }>,
 *   available_subjects: Array<{ id: string, name: string }>
 * }
 */

// Types
interface ParseTaskRequest {
    input_type: 'voice' | 'text';
    audio_base64?: string;
    text?: string;
    school_code: string;
    academic_year_id: string;
    available_classes: Array<{ id: string; label: string; grade?: string; section?: string }>;
    available_subjects: Array<{ id: string; name: string }>;
}

interface FieldResult<T> {
    value: T | null;
    source: 'explicit' | 'inferred' | 'default' | 'unmatched';
    confidence: number;
    raw_input?: string;
    match_status?: 'single_match' | 'multiple_matches' | 'no_match';
    options?: Array<{ id: string; label: string; similarity: number }>;
}

interface ParsedTask {
    title: FieldResult<string>;
    description: FieldResult<string>;
    class: FieldResult<{ id: string; label: string }>;
    subject: FieldResult<{ id: string; name: string }>;
    due_date: FieldResult<string>;
    due_date_display: string;
    assigned_date: FieldResult<string>;
    priority: FieldResult<'low' | 'medium' | 'high' | 'urgent'>;
    instructions: FieldResult<string>;
}

interface ParseTaskResponse {
    success: boolean;
    transcription?: string;
    detected_language?: string;  // Auto-detected language from Whisper (e.g., 'en', 'hi', 'ta')
    parsed_task?: ParsedTask;
    overall_confidence?: number;
    requires_confirmation: boolean;
    fields_needing_review: string[];
    errors: Array<{ field: string; code: string; message: string }>;
    log_id?: string;
}

// Constants
const MAX_AUDIO_DURATION_SECONDS = 60;
const MAX_AUDIO_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const LOW_CONFIDENCE_THRESHOLD = 0.6;
const NEEDS_CONFIRMATION_THRESHOLD = 0.7;
const IST_TIMEZONE = 'Asia/Kolkata';

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Get current date in IST timezone
 */
function getCurrentDateIST(): Date {
    const now = new Date();
    // Create date string in IST
    const istString = now.toLocaleString('en-US', { timeZone: IST_TIMEZONE });
    return new Date(istString);
}

/**
 * Format date for display
 */
function formatDateDisplay(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: IST_TIMEZONE,
    });
}

/**
 * Transcribe audio using OpenAI Whisper
 */
async function transcribeAudio(audioBase64: string, apiKey: string): Promise<{ text: string; duration: number; language: string }> {
    // Decode base64 to get audio data
    const audioData = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));

    // Check size limit
    if (audioData.length > MAX_AUDIO_SIZE_BYTES) {
        throw new Error(`Audio file too large. Maximum size is ${MAX_AUDIO_SIZE_BYTES / (1024 * 1024)}MB`);
    }

    // Create FormData with audio file
    // Note: No 'language' parameter = Whisper auto-detects from 99+ supported languages
    const formData = new FormData();
    const audioBlob = new Blob([audioData], { type: 'audio/m4a' });
    formData.append('file', audioBlob, 'audio.m4a');
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
        },
        body: formData,
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Whisper API error:', errorText);
        throw new Error('Failed to transcribe audio');
    }

    const result = await response.json();
    console.log('Whisper detected language:', result.language);
    return {
        text: result.text || '',
        duration: result.duration || 0,
        language: result.language || 'unknown',
    };
}

/**
 * Build the GPT system prompt for structured parsing
 */
function buildSystemPrompt(currentDateIST: string): string {
    return `You are a task parser for a school management system. Extract structured task data from natural language input.

CURRENT DATE (IST): ${currentDateIST}

RULES:
1. Extract ONLY what is explicitly mentioned or can be confidently inferred
2. For relative dates ("next Monday", "tomorrow"), resolve to actual dates based on current IST date
3. Never fabricate information - if something is not mentioned, return null
4. For class matching, extract grade/section info for fuzzy matching
5. For subject matching, extract subject name for fuzzy matching
6. If title is not explicit, generate a concise 3-5 word title from the description

Return your response as a JSON object with this EXACT structure:
{
  "title": { "value": "string or null", "source": "explicit|inferred", "confidence": 0.0-1.0 },
  "description": { "value": "string or null", "source": "explicit|inferred", "confidence": 0.0-1.0 },
  "class_query": { "grade": "string or null", "section": "string or null", "raw": "original text", "confidence": 0.0-1.0 },
  "subject_query": { "name": "string or null", "raw": "original text", "confidence": 0.0-1.0 },
  "due_date": { "value": "YYYY-MM-DD or null", "raw": "original text like 'next Monday'", "source": "explicit|inferred", "confidence": 0.0-1.0 },
  "assigned_date": { "value": "YYYY-MM-DD or null", "source": "explicit|inferred|default", "confidence": 0.0-1.0 },
  "priority": { "value": "low|medium|high|urgent or null", "source": "explicit|inferred|default", "confidence": 0.0-1.0 },
  "instructions": { "value": "string or null", "source": "explicit", "confidence": 0.0-1.0 }
}

CONFIDENCE GUIDELINES:
- 1.0: Explicitly stated word-for-word
- 0.8-0.9: Clearly implied or paraphrased
- 0.6-0.7: Reasonably inferred but not certain
- Below 0.6: Guessing or defaulting`;
}

/**
 * Parse natural language using GPT
 */
async function parseWithGPT(text: string, currentDateIST: string, apiKey: string): Promise<any> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: buildSystemPrompt(currentDateIST) },
                { role: 'user', content: `Parse this task request:\n\n"${text}"` }
            ],
            max_tokens: 500,
            temperature: 0.1, // Low temperature for consistent parsing
            response_format: { type: 'json_object' },
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('GPT API error:', errorText);
        throw new Error('Failed to parse task input');
    }

    const result = await response.json();
    const parsed = JSON.parse(result.choices?.[0]?.message?.content || '{}');
    return parsed;
}

/**
 * Calculate string similarity (Levenshtein-based)
 */
function stringSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    if (s1 === s2) return 1;
    if (s1.length === 0 || s2.length === 0) return 0;

    // Simple contains check with bonus
    if (s1.includes(s2) || s2.includes(s1)) {
        const shorter = Math.min(s1.length, s2.length);
        const longer = Math.max(s1.length, s2.length);
        return shorter / longer + 0.3; // Boost for contains match
    }

    // Word overlap
    const words1 = s1.split(/\s+/);
    const words2 = s2.split(/\s+/);
    const commonWords = words1.filter(w => words2.some(w2 => w2.includes(w) || w.includes(w2)));

    return commonWords.length / Math.max(words1.length, words2.length);
}

/**
 * Normalize grade/class number to a standard format
 * Handles: "7", "seven", "VII", "7th", "grade 7", "class 7" -> "7"
 */
function normalizeGrade(input: string): string {
    const s = input.toLowerCase().trim();

    // Word to number mapping
    const wordToNum: Record<string, string> = {
        'one': '1', 'first': '1', 'i': '1',
        'two': '2', 'second': '2', 'ii': '2',
        'three': '3', 'third': '3', 'iii': '3',
        'four': '4', 'fourth': '4', 'iv': '4',
        'five': '5', 'fifth': '5', 'v': '5',
        'six': '6', 'sixth': '6', 'vi': '6',
        'seven': '7', 'seventh': '7', 'vii': '7',
        'eight': '8', 'eighth': '8', 'viii': '8',
        'nine': '9', 'ninth': '9', 'ix': '9',
        'ten': '10', 'tenth': '10', 'x': '10',
        'eleven': '11', 'eleventh': '11', 'xi': '11',
        'twelve': '12', 'twelfth': '12', 'xii': '12',
        // Kindergarten/Nursery
        'kg': 'kg', 'kindergarten': 'kg', 'lkg': 'lkg', 'ukg': 'ukg',
        'nursery': 'nursery', 'prep': 'prep', 'sr kg': 'ukg', 'jr kg': 'lkg',
    };

    // Check word mapping first
    if (wordToNum[s]) return wordToNum[s];

    // Remove common prefixes
    let cleaned = s
        .replace(/^(grade|class|std|standard)\s*/i, '')
        .replace(/\s*(th|st|nd|rd)$/i, '')  // Remove ordinal suffixes
        .trim();

    // Check word mapping again after cleaning
    if (wordToNum[cleaned]) return wordToNum[cleaned];

    // If it's a number, return it
    if (/^\d+$/.test(cleaned)) return cleaned;

    return s; // Return original if can't normalize
}

/**
 * Normalize section to a standard format
 * Handles: "A", "section A", "sec a", "Alpha", "division A" -> "a"
 */
function normalizeSection(input: string): string {
    const s = input.toLowerCase().trim();

    // Section name mappings (phonetic alphabet, etc.)
    const sectionMap: Record<string, string> = {
        'alpha': 'a', 'bravo': 'b', 'charlie': 'c', 'delta': 'd', 'echo': 'e',
        'foxtrot': 'f', 'golf': 'g', 'hotel': 'h', 'india': 'i', 'juliet': 'j',
        // Also common Indian section names
        'aster': 'a', 'begonia': 'b', 'carnation': 'c', 'dahlia': 'd',
        'rose': 'a', 'lotus': 'b', 'lily': 'c', 'jasmine': 'd',
    };

    // Remove prefixes
    let cleaned = s
        .replace(/^(section|sec|division|div)\s*/i, '')
        .trim();

    // Check section map
    if (sectionMap[cleaned]) return sectionMap[cleaned];

    // If single letter, return lowercase
    if (/^[a-z]$/i.test(cleaned)) return cleaned.toLowerCase();

    return cleaned;
}

/**
 * Extract grade number from a class label
 */
function extractGradeFromLabel(label: string): string | null {
    const patterns = [
        /(?:grade|class|std|standard)\s*(\d+)/i,
        /(\d+)\s*(?:th|st|nd|rd)?\s*(?:grade|class|std)?/i,
        /^(\d+)\s*[-]?\s*[a-z]$/i,  // "8A" or "8-A"
    ];

    for (const pattern of patterns) {
        const match = label.match(pattern);
        if (match) return match[1];
    }
    return null;
}

/**
 * Extract section from a class label
 */
function extractSectionFromLabel(label: string): string | null {
    const patterns = [
        /(?:section|sec)\s*([a-z])/i,
        /[-\s]([a-z])$/i,  // "8-A" or "8 A" or "Grade 8A"
        /(\d+)\s*([a-z])$/i,  // "8A"
    ];

    for (const pattern of patterns) {
        const match = label.match(pattern);
        if (match) {
            // Last capture group should be the section
            return match[match.length - 1].toLowerCase();
        }
    }
    return null;
}

/**
 * Match class from available options with smart fuzzy matching
 */
function matchClass(
    query: { grade?: string; section?: string; raw?: string },
    availableClasses: Array<{ id: string; label: string; grade?: string; section?: string }>
): FieldResult<{ id: string; label: string }> {
    if (!query.grade && !query.section && !query.raw) {
        return {
            value: null,
            source: 'unmatched',
            confidence: 0,
            match_status: 'no_match',
        };
    }

    // Normalize the query
    const normalizedQueryGrade = query.grade ? normalizeGrade(query.grade) : null;
    const normalizedQuerySection = query.section ? normalizeSection(query.section) : null;

    // Also try to extract from raw input if grade/section not explicitly found
    let rawGrade: string | null = null;
    let rawSection: string | null = null;
    if (query.raw) {
        rawGrade = extractGradeFromLabel(query.raw);
        rawSection = extractSectionFromLabel(query.raw);
    }

    const effectiveGrade = normalizedQueryGrade || (rawGrade ? normalizeGrade(rawGrade) : null);
    const effectiveSection = normalizedQuerySection || rawSection;

    console.log('Class matching:', {
        query,
        effectiveGrade,
        effectiveSection,
        availableCount: availableClasses.length
    });

    // Calculate similarity for each class
    const matches = availableClasses.map(cls => {
        let similarity = 0;

        // Extract and normalize from class label
        const clsGrade = cls.grade || extractGradeFromLabel(cls.label);
        const clsSection = cls.section || extractSectionFromLabel(cls.label);
        const normalizedClsGrade = clsGrade ? normalizeGrade(clsGrade) : null;
        const normalizedClsSection = clsSection ? normalizeSection(clsSection) : null;

        // Grade matching (most important - 60% weight)
        if (effectiveGrade && normalizedClsGrade) {
            if (effectiveGrade === normalizedClsGrade) {
                similarity += 0.6;
            }
        }

        // Section matching (40% weight when specified)
        if (effectiveSection && normalizedClsSection) {
            if (effectiveSection === normalizedClsSection) {
                similarity += 0.4;
            }
        } else if (!effectiveSection && normalizedClsGrade === effectiveGrade) {
            // No section specified but grade matches - still good
            similarity = Math.max(similarity, 0.5);
        }

        // Fallback: raw string similarity
        if (query.raw && similarity < 0.3) {
            const rawSim = stringSimilarity(query.raw, cls.label);
            similarity = Math.max(similarity, rawSim);
        }

        return { ...cls, similarity: Math.min(similarity, 1) };
    });

    // Filter and sort by similarity - lowered threshold to 0.25 to try harder
    const goodMatches = matches.filter(m => m.similarity > 0.25).sort((a, b) => b.similarity - a.similarity);

    console.log('Class matches found:', goodMatches.slice(0, 3).map(m => ({ label: m.label, sim: m.similarity })));

    if (goodMatches.length === 0) {
        return {
            value: null,
            source: 'unmatched',
            confidence: 0,
            match_status: 'no_match',
            raw_input: query.raw,
        };
    }

    // If top match is significantly better than second, use it
    if (goodMatches.length === 1 ||
        goodMatches[0].similarity > 0.7 ||
        (goodMatches.length > 1 && goodMatches[0].similarity - goodMatches[1].similarity > 0.2)) {
        return {
            value: { id: goodMatches[0].id, label: goodMatches[0].label },
            source: 'inferred',
            confidence: goodMatches[0].similarity,
            match_status: 'single_match',
            raw_input: query.raw,
        };
    }

    // Multiple good matches - need user selection
    return {
        value: null,
        source: 'unmatched',
        confidence: 0.5,
        match_status: 'multiple_matches',
        raw_input: query.raw,
        options: goodMatches.slice(0, 5).map(m => ({
            id: m.id,
            label: m.label,
            similarity: m.similarity,
        })),
    };
}

/**
 * Match subject from available options
 */
function matchSubject(
    query: { name?: string; raw?: string },
    availableSubjects: Array<{ id: string; name: string }>
): FieldResult<{ id: string; name: string }> {
    if (!query.name && !query.raw) {
        return {
            value: null,
            source: 'unmatched',
            confidence: 0,
            match_status: 'no_match',
        };
    }

    const searchTerm = query.name || query.raw || '';

    const matches = availableSubjects.map(subj => ({
        ...subj,
        similarity: stringSimilarity(searchTerm, subj.name),
    }));

    const goodMatches = matches.filter(m => m.similarity > 0.3).sort((a, b) => b.similarity - a.similarity);

    if (goodMatches.length === 0) {
        return {
            value: null,
            source: 'unmatched',
            confidence: 0,
            match_status: 'no_match',
            raw_input: query.raw,
        };
    }

    if (goodMatches.length === 1 || goodMatches[0].similarity > 0.7) {
        return {
            value: { id: goodMatches[0].id, name: goodMatches[0].name },
            source: 'inferred',
            confidence: goodMatches[0].similarity,
            match_status: 'single_match',
            raw_input: query.raw,
        };
    }

    return {
        value: null,
        source: 'unmatched',
        confidence: 0.5,
        match_status: 'multiple_matches',
        raw_input: query.raw,
        options: goodMatches.slice(0, 5).map(m => ({
            id: m.id,
            label: m.name,
            similarity: m.similarity,
        })),
    };
}

/**
 * Main handler
 */
Deno.serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // 1. Validate authentication
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(
                JSON.stringify({ success: false, errors: [{ field: 'auth', code: 'UNAUTHORIZED', message: 'Missing authorization header' }], requires_confirmation: true, fields_needing_review: [] }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Create clients
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
        const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } }
        });

        // Get authenticated user
        const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
        if (authError || !user) {
            return new Response(
                JSON.stringify({ success: false, errors: [{ field: 'auth', code: 'INVALID_TOKEN', message: 'Invalid or expired token' }], requires_confirmation: true, fields_needing_review: [] }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // 2. Parse and validate request
        const body: ParseTaskRequest = await req.json();
        const { input_type, audio_base64, text, school_code, academic_year_id, available_classes, available_subjects } = body;

        // Validate required fields
        if (!school_code || !academic_year_id) {
            return new Response(
                JSON.stringify({ success: false, errors: [{ field: 'request', code: 'MISSING_FIELDS', message: 'Missing school_code or academic_year_id' }], requires_confirmation: true, fields_needing_review: [] }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        if (input_type === 'voice' && !audio_base64) {
            return new Response(
                JSON.stringify({ success: false, errors: [{ field: 'audio', code: 'MISSING_AUDIO', message: 'Audio data required for voice input' }], requires_confirmation: true, fields_needing_review: [] }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        if (input_type === 'text' && !text) {
            return new Response(
                JSON.stringify({ success: false, errors: [{ field: 'text', code: 'MISSING_TEXT', message: 'Text required for text input' }], requires_confirmation: true, fields_needing_review: [] }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // 3. Get OpenAI API key
        const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
        if (!OPENAI_API_KEY) {
            return new Response(
                JSON.stringify({ success: false, errors: [{ field: 'service', code: 'AI_NOT_CONFIGURED', message: 'AI service not configured' }], requires_confirmation: true, fields_needing_review: [] }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // 4. Get current date in IST
        const currentDateIST = getCurrentDateIST();
        const currentDateStr = currentDateIST.toISOString().split('T')[0];

        // 5. Transcribe if voice input
        let inputText = text || '';
        let transcription: string | undefined;
        let audioDuration: number | undefined;
        let detectedLanguage: string | undefined;

        if (input_type === 'voice' && audio_base64) {
            console.log('Transcribing audio with auto language detection...');
            const transcriptionResult = await transcribeAudio(audio_base64, OPENAI_API_KEY);
            inputText = transcriptionResult.text;
            transcription = transcriptionResult.text;
            audioDuration = transcriptionResult.duration;
            detectedLanguage = transcriptionResult.language;

            if (audioDuration > MAX_AUDIO_DURATION_SECONDS) {
                return new Response(
                    JSON.stringify({ success: false, errors: [{ field: 'audio', code: 'AUDIO_TOO_LONG', message: `Audio too long. Maximum ${MAX_AUDIO_DURATION_SECONDS} seconds allowed.` }], requires_confirmation: true, fields_needing_review: [] }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            console.log('Transcription:', transcription, '| Language:', detectedLanguage);
        }

        // 6. Parse with GPT
        console.log('Parsing with GPT:', inputText);
        const gptResult = await parseWithGPT(inputText, currentDateStr, OPENAI_API_KEY);
        console.log('GPT result:', JSON.stringify(gptResult));

        // 7. Build parsed task with matching
        const parsedTask: ParsedTask = {
            title: {
                value: gptResult.title?.value || null,
                source: gptResult.title?.source || 'unmatched',
                confidence: gptResult.title?.confidence || 0,
            },
            description: {
                value: gptResult.description?.value || null,
                source: gptResult.description?.source || 'unmatched',
                confidence: gptResult.description?.confidence || 0,
            },
            class: matchClass(gptResult.class_query || {}, available_classes || []),
            subject: matchSubject(gptResult.subject_query || {}, available_subjects || []),
            due_date: {
                value: gptResult.due_date?.value || null,
                source: gptResult.due_date?.source || 'unmatched',
                confidence: gptResult.due_date?.confidence || 0,
                raw_input: gptResult.due_date?.raw,
            },
            due_date_display: gptResult.due_date?.value ? formatDateDisplay(gptResult.due_date.value) : '',
            assigned_date: {
                value: gptResult.assigned_date?.value || currentDateStr,
                source: gptResult.assigned_date?.source || 'default',
                confidence: gptResult.assigned_date?.confidence || 0.8,
            },
            priority: {
                value: gptResult.priority?.value || 'medium',
                source: gptResult.priority?.source || 'default',
                confidence: gptResult.priority?.confidence || 0.5,
            },
            instructions: {
                value: gptResult.instructions?.value || null,
                source: gptResult.instructions?.source || 'unmatched',
                confidence: gptResult.instructions?.confidence || 0,
            },
        };

        // 8. Identify fields needing review
        const fieldsNeedingReview: string[] = [];
        const requiredFields = ['title', 'class', 'subject', 'due_date'] as const;

        for (const field of requiredFields) {
            const fieldData = parsedTask[field];
            if (!fieldData.value || fieldData.confidence < NEEDS_CONFIRMATION_THRESHOLD) {
                fieldsNeedingReview.push(field);
            }
            if ((fieldData as any).match_status === 'multiple_matches') {
                fieldsNeedingReview.push(field);
            }
        }

        // Inferred dates always need confirmation
        if (parsedTask.due_date.source === 'inferred' && !fieldsNeedingReview.includes('due_date')) {
            fieldsNeedingReview.push('due_date');
        }

        // 9. Calculate overall confidence
        const fieldConfidences = {
            title: parsedTask.title.confidence,
            class: parsedTask.class.confidence,
            subject: parsedTask.subject.confidence,
            due_date: parsedTask.due_date.confidence,
            priority: parsedTask.priority.confidence,
        };

        const confidenceValues = Object.values(fieldConfidences);
        const overallConfidence = confidenceValues.length > 0
            ? confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length
            : 0;

        // 10. Log to database
        const { data: logData, error: logError } = await supabaseAdmin
            .from('smart_task_logs')
            .insert({
                school_code,
                created_by: user.id,
                input_type,
                raw_input: inputText,
                transcription,
                audio_duration_seconds: audioDuration,
                parsed_output: parsedTask,
                field_confidences: fieldConfidences,
                overall_confidence: overallConfidence,
                fields_needing_review: fieldsNeedingReview,
                status: 'pending',
            })
            .select('id')
            .single();

        if (logError) {
            console.error('Failed to create log:', logError);
        }

        // 11. Build response
        const response: ParseTaskResponse = {
            success: true,
            transcription,
            detected_language: detectedLanguage,
            parsed_task: parsedTask,
            overall_confidence: overallConfidence,
            requires_confirmation: fieldsNeedingReview.length > 0 || overallConfidence < NEEDS_CONFIRMATION_THRESHOLD,
            fields_needing_review: fieldsNeedingReview,
            errors: [],
            log_id: logData?.id,
        };

        return new Response(
            JSON.stringify(response),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('Unexpected error:', error);
        return new Response(
            JSON.stringify({
                success: false,
                errors: [{ field: 'server', code: 'INTERNAL_ERROR', message: (error as Error).message || 'An unexpected error occurred' }],
                requires_confirmation: true,
                fields_needing_review: [],
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
