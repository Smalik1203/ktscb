import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { QuestionType } from '../types/test.types';

export interface ParsedQuestion {
  question_text: string;
  question_type: QuestionType;
  points: number;
  options?: string[];
  correct_answer: string;
  order_index: number;
}

export interface ParseResult {
  success: boolean;
  questions: ParsedQuestion[];
  errors: string[];
}

/**
 * Parse CSV file for questions
 * Expected format:
 * question_text,question_type,points,option_a,option_b,option_c,option_d,correct_answer
 */
export async function parseCSV(fileContent: string): Promise<ParseResult> {
  const errors: string[] = [];
  const questions: ParsedQuestion[] = [];

  try {
    const result = Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase(),
    });

    if (result.errors.length > 0) {
      result.errors.forEach((error) => {
        errors.push(`Row ${error.row}: ${error.message}`);
      });
    }

    result.data.forEach((row: any, index: number) => {
      const rowNum = index + 2; // +2 because index is 0-based and header is row 1

      // Validate required fields
      if (!row.question_text || !row.question_type || !row.points) {
        errors.push(`Row ${rowNum}: Missing required fields (question_text, question_type, points)`);
        return;
      }

      // Validate question type
      const questionType = row.question_type.toLowerCase().trim();
      if (!['mcq', 'one_word', 'long_answer'].includes(questionType)) {
        errors.push(`Row ${rowNum}: Invalid question_type. Must be: mcq, one_word, or long_answer`);
        return;
      }

      // Validate points
      const points = parseInt(row.points);
      if (isNaN(points) || points <= 0) {
        errors.push(`Row ${rowNum}: Points must be a positive number`);
        return;
      }

      // Build question object
      const question: ParsedQuestion = {
        question_text: row.question_text.trim(),
        question_type: questionType as QuestionType,
        points,
        correct_answer: row.correct_answer?.trim() || '',
        order_index: index,
      };

      // For MCQ, validate options
      if (questionType === 'mcq') {
        const options = [
          row.option_a?.trim(),
          row.option_b?.trim(),
          row.option_c?.trim(),
          row.option_d?.trim(),
        ].filter((opt) => opt && opt.length > 0);

        if (options.length < 2) {
          errors.push(`Row ${rowNum}: MCQ questions must have at least 2 options`);
          return;
        }

        if (!row.correct_answer || !options.includes(row.correct_answer.trim())) {
          errors.push(`Row ${rowNum}: correct_answer must match one of the options`);
          return;
        }

        question.options = options;
      }

      questions.push(question);
    });
  } catch (error: any) {
    errors.push(`Failed to parse CSV: ${error.message}`);
  }

  return {
    success: errors.length === 0,
    questions,
    errors,
  };
}

/**
 * Parse Excel file for questions
 * Expected sheet name: "Questions"
 * Columns: question_text, question_type, points, option_a, option_b, option_c, option_d, correct_answer
 */
export async function parseExcel(fileBuffer: ArrayBuffer): Promise<ParseResult> {
  const errors: string[] = [];
  const questions: ParsedQuestion[] = [];

  try {
    const workbook = XLSX.read(fileBuffer, { type: 'array' });

    // Try to find "Questions" sheet, otherwise use first sheet
    const sheetName = workbook.SheetNames.includes('Questions')
      ? 'Questions'
      : workbook.SheetNames[0];

    if (!sheetName) {
      errors.push('No sheets found in Excel file');
      return { success: false, questions: [], errors };
    }

    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    data.forEach((row: any, index: number) => {
      const rowNum = index + 2; // +2 because index is 0-based and header is row 1

      // Normalize keys to lowercase
      const normalizedRow: any = {};
      Object.keys(row).forEach((key) => {
        normalizedRow[key.toLowerCase().trim()] = row[key];
      });

      // Validate required fields
      if (!normalizedRow.question_text || !normalizedRow.question_type || !normalizedRow.points) {
        errors.push(`Row ${rowNum}: Missing required fields (question_text, question_type, points)`);
        return;
      }

      // Validate question type
      const questionType = String(normalizedRow.question_type).toLowerCase().trim();
      if (!['mcq', 'one_word', 'long_answer'].includes(questionType)) {
        errors.push(`Row ${rowNum}: Invalid question_type. Must be: mcq, one_word, or long_answer`);
        return;
      }

      // Validate points
      const points = parseInt(normalizedRow.points);
      if (isNaN(points) || points <= 0) {
        errors.push(`Row ${rowNum}: Points must be a positive number`);
        return;
      }

      // Build question object
      const question: ParsedQuestion = {
        question_text: String(normalizedRow.question_text).trim(),
        question_type: questionType as QuestionType,
        points,
        correct_answer: normalizedRow.correct_answer ? String(normalizedRow.correct_answer).trim() : '',
        order_index: index,
      };

      // For MCQ, validate options
      if (questionType === 'mcq') {
        const options = [
          normalizedRow.option_a,
          normalizedRow.option_b,
          normalizedRow.option_c,
          normalizedRow.option_d,
        ]
          .filter((opt) => opt !== undefined && opt !== null && String(opt).trim().length > 0)
          .map((opt) => String(opt).trim());

        if (options.length < 2) {
          errors.push(`Row ${rowNum}: MCQ questions must have at least 2 options`);
          return;
        }

        if (!normalizedRow.correct_answer || !options.includes(String(normalizedRow.correct_answer).trim())) {
          errors.push(`Row ${rowNum}: correct_answer must match one of the options`);
          return;
        }

        question.options = options;
      }

      questions.push(question);
    });
  } catch (error: any) {
    errors.push(`Failed to parse Excel: ${error.message}`);
  }

  return {
    success: errors.length === 0,
    questions,
    errors,
  };
}

/**
 * Parse TXT file for questions
 * Simple format:
 * [MCQ|ONE_WORD|LONG_ANSWER] Points: X
 * Question text here?
 * A) Option 1
 * B) Option 2
 * C) Option 3
 * D) Option 4
 * Answer: A
 * ---
 */
export async function parseTXT(fileContent: string): Promise<ParseResult> {
  const errors: string[] = [];
  const questions: ParsedQuestion[] = [];

  try {
    const blocks = fileContent.split('---').filter((block) => block.trim().length > 0);

    blocks.forEach((block, index) => {
      const lines = block.split('\n').filter((line) => line.trim().length > 0);

      if (lines.length === 0) return;

      // Parse first line: [TYPE] Points: X
      const firstLine = lines[0].trim();
      const typeMatch = firstLine.match(/\[(MCQ|ONE_WORD|LONG_ANSWER)\]\s*Points:\s*(\d+)/i);

      if (!typeMatch) {
        errors.push(`Question ${index + 1}: Invalid format. First line must be: [TYPE] Points: X`);
        return;
      }

      const questionType = typeMatch[1].toLowerCase() as QuestionType;
      const points = parseInt(typeMatch[2]);

      // Parse question text (line 2)
      if (lines.length < 2) {
        errors.push(`Question ${index + 1}: Missing question text`);
        return;
      }

      const questionText = lines[1].trim();

      // Build question object
      const question: ParsedQuestion = {
        question_text: questionText,
        question_type: questionType,
        points,
        correct_answer: '',
        order_index: index,
      };

      // For MCQ, parse options and answer
      if (questionType === 'mcq') {
        const options: string[] = [];
        let answerLine: string | undefined;

        for (let i = 2; i < lines.length; i++) {
          const line = lines[i].trim();

          // Check if it's an option line
          if (/^[A-D]\)/.test(line)) {
            options.push(line.substring(2).trim());
          }
          // Check if it's the answer line
          else if (line.startsWith('Answer:')) {
            answerLine = line;
          }
        }

        if (options.length < 2) {
          errors.push(`Question ${index + 1}: MCQ must have at least 2 options`);
          return;
        }

        if (!answerLine) {
          errors.push(`Question ${index + 1}: Missing Answer line`);
          return;
        }

        const answerMatch = answerLine.match(/Answer:\s*([A-D])/i);
        if (!answerMatch) {
          errors.push(`Question ${index + 1}: Invalid answer format. Use: Answer: A`);
          return;
        }

        const answerIndex = answerMatch[1].toUpperCase().charCodeAt(0) - 65; // A=0, B=1, etc.
        if (answerIndex < 0 || answerIndex >= options.length) {
          errors.push(`Question ${index + 1}: Answer refers to non-existent option`);
          return;
        }

        question.options = options;
        question.correct_answer = options[answerIndex];
      }
      // For ONE_WORD and LONG_ANSWER, parse answer from last line
      else {
        const lastLine = lines[lines.length - 1].trim();
        if (lastLine.startsWith('Answer:')) {
          question.correct_answer = lastLine.substring(7).trim();
        }
      }

      questions.push(question);
    });
  } catch (error: any) {
    errors.push(`Failed to parse TXT: ${error.message}`);
  }

  return {
    success: errors.length === 0,
    questions,
    errors,
  };
}

/**
 * Parse JSON file for questions
 * Expected format:
 * {
 *   "questions": [
 *     {
 *       "question_text": "...",
 *       "question_type": "mcq|one_word|long_answer",
 *       "points": 5,
 *       "options": ["A", "B", "C", "D"], // only for MCQ
 *       "correct_answer": "..."
 *     }
 *   ]
 * }
 */
export async function parseJSON(fileContent: string): Promise<ParseResult> {
  const errors: string[] = [];
  const questions: ParsedQuestion[] = [];

  try {
    // Validate fileContent is not empty
    if (!fileContent || typeof fileContent !== 'string' || fileContent.trim().length === 0) {
      errors.push('File is empty or invalid');
      return { success: false, questions: [], errors };
    }

    let data;
    try {
      data = JSON.parse(fileContent);
    } catch (parseError: any) {
      errors.push(`Invalid JSON format: ${parseError?.message || 'Parse error'}`);
      return { success: false, questions: [], errors };
    }

    if (!data.questions || !Array.isArray(data.questions)) {
      errors.push('Invalid JSON format. Expected: { "questions": [...] }');
      return { success: false, questions: [], errors };
    }

    data.questions.forEach((item: any, index: number) => {
      const qNum = index + 1;

      // Validate required fields
      if (!item.question_text || !item.question_type || !item.points) {
        errors.push(`Question ${qNum}: Missing required fields (question_text, question_type, points)`);
        return;
      }

      // Validate question type
      const questionType = item.question_type.toLowerCase().trim();
      if (!['mcq', 'one_word', 'long_answer'].includes(questionType)) {
        errors.push(`Question ${qNum}: Invalid question_type. Must be: mcq, one_word, or long_answer`);
        return;
      }

      // Validate points
      const points = parseInt(item.points);
      if (isNaN(points) || points <= 0) {
        errors.push(`Question ${qNum}: Points must be a positive number`);
        return;
      }

      // Build question object
      const question: ParsedQuestion = {
        question_text: item.question_text.trim(),
        question_type: questionType as QuestionType,
        points,
        correct_answer: item.correct_answer?.trim() || '',
        order_index: index,
      };

      // For MCQ, validate options
      if (questionType === 'mcq') {
        if (!Array.isArray(item.options) || item.options.length < 2) {
          errors.push(`Question ${qNum}: MCQ questions must have at least 2 options`);
          return;
        }

        const options = item.options.map((opt: any) => String(opt).trim());

        if (!item.correct_answer || !options.includes(item.correct_answer.trim())) {
          errors.push(`Question ${qNum}: correct_answer must match one of the options`);
          return;
        }

        question.options = options;
      }

      questions.push(question);
    });
  } catch (error: any) {
    errors.push(`Failed to parse JSON: ${error.message}`);
  }

  return {
    success: errors.length === 0,
    questions,
    errors,
  };
}
