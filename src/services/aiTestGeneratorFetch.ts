const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

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
  error?: string;
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
 * Generate test questions from an image using OpenAI Vision API (fetch version)
 */
export async function generateQuestionsFromImage(
  imageUri: string,
  questionCount: number = 10,
  context?: string,
  onProgress?: (text: string) => void
): Promise<AITestGenerationResult> {
  try {
    if (!OPENAI_API_KEY || OPENAI_API_KEY === 'your_openai_api_key_here') {
      throw new Error('OpenAI API key not configured. Please add your key to the .env file.');
    }

    if (onProgress) {
      onProgress('🔄 Processing image...');
    }

    const base64Image = await imageToBase64(imageUri);
    const mimeType = imageUri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';

    if (onProgress) {
      onProgress('📤 Sending to AI...');
    }

    const prompt = `Analyze this educational image and create ${questionCount} MCQ questions.

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
- Exactly ${questionCount} questions
- Accurate, clear questions
- 4 options per question
- Brief explanations
- Valid JSON only`;

    const USE_STREAMING = false;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
                  url: `data:${mimeType};base64,${base64Image}`,
                  detail: 'low',
                },
              },
            ],
          },
        ],
        max_tokens: 2500,
        temperature: 0.3,
        stream: USE_STREAMING,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `API request failed with status ${response.status}`;

      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error?.message || errorMessage;
      } catch {
        errorMessage = errorText.substring(0, 200);
      }

      throw new Error(`OpenAI Error: ${errorMessage}`);
    }

    let content = '';

    if (USE_STREAMING) {
      if (onProgress) {
        onProgress('✨ AI is generating questions...\n\n');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let displayText = '';

      if (!reader) {
        throw new Error('No response stream available');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') break;

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                content += delta;
                displayText += delta;
                if (onProgress) {
                  onProgress(displayText);
                }
              }
            } catch {
              // Skip invalid JSON chunks
            }
          }
        }
      }
    } else {
      if (onProgress) {
        onProgress('✨ AI is generating questions...\n\nPlease wait...');
      }

      const data = await response.json();
      content = data.choices?.[0]?.message?.content || '';

      if (onProgress && content) {
        onProgress(content);
      }
    }

    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Parse the JSON response
    let parsedData;
    try {
      const cleanedContent = content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      parsedData = JSON.parse(cleanedContent);
    } catch {
      throw new Error('Failed to parse AI response. Please try again.');
    }

    if (!parsedData.questions || !Array.isArray(parsedData.questions)) {
      throw new Error('Invalid response format from AI');
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
      throw new Error('No valid questions generated');
    }

    return {
      questions: validQuestions,
      totalGenerated: validQuestions.length,
    };
  } catch (error: any) {
    let errorMessage = error.message || 'Failed to generate questions';

    if (error.message?.includes('timeout')) {
      errorMessage = 'Request timeout. Please try with a smaller image or fewer questions.';
    } else if (error.message?.includes('network')) {
      errorMessage = 'Network error. Please check your internet connection.';
    } else if (error.message?.includes('API key')) {
      errorMessage = 'Invalid API key. Please check your OpenAI API key.';
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
 */
export async function generateQuestionsFromMultipleImages(
  imageUris: string[],
  questionCountPerImage: number = 5,
  context?: string
): Promise<AITestGenerationResult> {
  try {
    const allQuestions: GeneratedQuestion[] = [];

    for (const imageUri of imageUris) {
      const result = await generateQuestionsFromImage(imageUri, questionCountPerImage, context);

      if (result.error) {
        continue;
      }

      allQuestions.push(...result.questions);
    }

    return {
      questions: allQuestions,
      totalGenerated: allQuestions.length,
    };
  } catch (error: any) {
    return {
      questions: [],
      totalGenerated: 0,
      error: error.message || 'Failed to generate questions from images',
    };
  }
}
