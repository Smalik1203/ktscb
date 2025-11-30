#!/usr/bin/env node
/**
 * Fix Import Errors
 * Fixes malformed imports from migration
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get all files with import errors
const errorFiles = [
  'src/components/analytics/shared/TimePeriodFilter.tsx',
  'src/components/calendar/CalendarEventFormModal.tsx',
  'src/components/common/Pagination.tsx',
  'src/components/ErrorBoundary.tsx',
  'src/components/resources/AddResourceModal.tsx',
  'src/components/resources/PDFViewer.tsx',
  'src/components/resources/VideoPlayer.tsx',
  'src/components/tasks/StudentTaskCard.tsx',
  'src/components/tasks/TaskFormModal.tsx',
  'src/components/tasks/TaskSubmissionModal.tsx',
  'src/components/tests/CreateTestForm.tsx',
  'src/components/tests/ImportQuestionsModal.tsx',
  'src/components/tests/QuestionBuilderScreen.tsx',
  'src/components/tests/TestTakingScreen.tsx',
  'src/components/ui/ProgressRing.tsx',
  'src/components/ui/SuccessAnimation.tsx',
  'src/features/ai-test-generator/AITestGeneratorScreen.tsx',
  'src/features/classes/AddClassesScreen.tsx',
];

function fixFile(filePath) {
  const fullPath = path.join(__dirname, filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  Skip ${filePath} - not found`);
    return false;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  const original = content;

  // Fix 1: Add useMemo to React import if missing
  if (!content.includes('useMemo') && content.includes('import React')) {
    content = content.replace(
      /import React(,\s*\{([^}]*)\})?\s+from\s+['"]react['"]/,
      (match, group1, existing) => {
        if (!existing) {
          return "import React, { useMemo } from 'react'";
        }
        if (!existing.includes('useMemo')) {
          return `import React, { ${existing.trim()}, useMemo } from 'react'`;
        }
        return match;
      }
    );
  }

  // Fix 2: Ensure proper import structure
  // Pattern: import React, { useMemo } from useTheme <- WRONG
  content = content.replace(
    /import React,\s*\{\s*useMemo\s*\}\s*from\s*useTheme/g,
    "import React, { useMemo } from 'react'"
  );

  content = content.replace(
    /import React,\s*\{\s*useMemo\s*\}\s*from\s*useTheme/g,
    "import React, { useMemo } from 'react'"
  );

  // Fix 3: Look for completely malformed imports
  const lines = content.split('\n');
  const fixedLines = lines.map((line, idx) => {
    // Check if line has "from useTheme" without proper string quotes
    if (line.includes('from useTheme') && !line.includes("from 'useTheme'") && !line.includes('from "useTheme"')) {
      // This is likely: import React, { useMemo } from useTheme
      return line.replace(/from\s+useTheme/, "from 'react'");
    }
    return line;
  });
  content = fixedLines.join('\n');

  if (content !== original) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✨ ${filePath} - fixed imports`);
    return true;
  }

  console.log(`⏭️  ${filePath} - no changes needed`);
  return false;
}

console.log('🔧 Fixing import errors...\n');
let fixed = 0;

errorFiles.forEach(file => {
  if (fixFile(file)) fixed++;
});

console.log(`\n✅ Fixed ${fixed} files`);
