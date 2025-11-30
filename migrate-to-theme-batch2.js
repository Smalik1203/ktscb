#!/usr/bin/env node
/**
 * Design System Migration Script - Batch 2
 * Fixes remaining files with direct color imports
 */

const fs = require('fs');
const path = require('path');

// Remaining files from grep
const filesToMigrate = [
  'src/features/admin/AddAdminScreen.tsx',
  'src/features/students/AddStudentScreen.tsx',
  'src/components/tasks/TaskSubmissionModal.tsx',
  'src/components/analytics/dashboards/SuperAdminDashboard.tsx',
  'src/components/analytics/dashboards/StudentDashboard.tsx',
  'src/components/analytics/dashboards/AdminDashboard.tsx',
  'src/components/analytics/shared/CategoryCards.tsx',
  'src/components/analytics/shared/SummaryCard.tsx',
  'src/components/resources/PDFViewer.tsx',
  'src/components/resources/VideoPlayer.tsx',
  'src/components/fees/StudentFeesView.tsx',
  'src/components/attendance/StudentAttendanceView.tsx',
  'src/components/tasks/StudentTaskCard.tsx',
  'src/components/tests/QuestionBuilderScreen.tsx',
  'src/components/tests/TestTakingScreen.tsx',
  'src/components/tests/TestResultsScreen.tsx',
  'src/components/tests/ImportQuestionsModal.tsx',
  'src/features/subjects/AddSubjectsScreen.tsx',
  'src/features/classes/AddClassesScreen.tsx',
  'src/features/fees/StudentFeesScreen.tsx',
  'src/features/fees/PaymentsScreen.tsx',
  'src/features/ai-test-generator/AITestGeneratorScreen.tsx',
  'src/components/common/Pagination.tsx',
  'src/components/ErrorBoundary.tsx',
  'src/components/ui/EmptyState.tsx',
  'src/components/ui/LoadingView.tsx',
  'src/components/ui/ErrorView.tsx',
  'src/components/ui/NetworkStatus.tsx',
  'src/components/ui/SuccessAnimation.tsx',
  'src/components/ui/ProgressRing.tsx',
  'src/components/skeletons/TimetableSkeleton.tsx',
  'src/components/skeletons/FeesSkeleton.tsx',
  'src/components/skeletons/DashboardSkeleton.tsx',
  'src/components/skeletons/CardSkeleton.tsx',
];

function determineImportPath(filePath) {
  // Count directory depth to determine correct relative path
  const depth = filePath.split('/').length - 2; // -2 for src/ and filename
  if (depth === 1) return '../contexts/ThemeContext';
  if (depth === 2) return '../../contexts/ThemeContext';
  if (depth === 3) return '../../../contexts/ThemeContext';
  return '../../contexts/ThemeContext';
}

function migrateFile(filePath) {
  const fullPath = path.join(__dirname, filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  Skipping ${filePath} - file not found`);
    return false;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  const original = content;

  // Skip if already migrated
  if (content.includes('useTheme()') && content.includes('createStyles')) {
    console.log(`✅ ${filePath} - already migrated`);
    return false;
  }

  const importPath = determineImportPath(filePath);

  // Step 1: Update imports - handle multiple variations
  content = content.replace(
    /import\s*{\s*colors\s*,\s*([^}]+)}\s*from\s*['"].*design-system['"]/g,
    (match, rest) => {
      // Keep other imports, remove colors
      return `import { ${rest.trim()} } from '../../../lib/design-system'`;
    }
  );

  // Also handle case where colors is the only import
  content = content.replace(
    /import\s*{\s*colors\s*}\s*from\s*['"].*design-system['"]\s*;?\n/g,
    ''
  );

  // Add useTheme and types if not present
  if (!content.includes('useTheme')) {
    // Add React useMemo if not present
    if (content.includes('import React') && !content.includes('useMemo')) {
      content = content.replace(
        /import React(.*?) from 'react'/,
        "import React$1, { useMemo } from 'react'"
      );
    } else if (!content.includes('import React')) {
      // Add React import if missing
      content = "import React, { useMemo } from 'react';\n" + content;
    }

    // Find the right import location
    const importMatch = content.match(/(import React.*?;\n)/);
    if (importMatch) {
      const insertPoint = importMatch.index + importMatch[0].length;
      content = content.slice(0, insertPoint) +
        `import { useTheme } from '${importPath}';\n` +
        `import type { ThemeColors } from '${importPath.replace('contexts/ThemeContext', 'theme/types')}';\n` +
        content.slice(insertPoint);
    }
  }

  // Step 2: Add useTheme() in component
  const componentPatterns = [
    /export (?:const|function) (\w+).*?(?:=>|{)\s*\n/,
    /const (\w+)(?::\s*React\.FC.*?)?\s*=\s*(?:\(.*?\)|.*?)(?:=>|{)\s*\n/,
    /function (\w+)\s*\(.*?\)\s*{/,
  ];

  let componentMatch = null;
  for (const pattern of componentPatterns) {
    componentMatch = content.match(pattern);
    if (componentMatch) break;
  }

  if (componentMatch && !content.includes('useTheme()')) {
    const insertPoint = componentMatch.index + componentMatch[0].length;
    const indent = '  ';

    content = content.slice(0, insertPoint) +
      `${indent}const { colors, typography, spacing, borderRadius, shadows } = useTheme();\n` +
      `${indent}const styles = useMemo(() => createStyles(colors, typography, spacing, borderRadius, shadows), [colors, typography, spacing, borderRadius, shadows]);\n\n` +
      content.slice(insertPoint);
  }

  // Step 3: Convert static StyleSheet to createStyles
  content = content.replace(
    /const styles = StyleSheet\.create\({/g,
    'const createStyles = (colors: ThemeColors, typography: any, spacing: any, borderRadius: any, shadows: any) =>\n  StyleSheet.create({'
  );

  // Step 4: Fix closing bracket
  if (content.includes('createStyles') && !original.includes('createStyles')) {
    content = content.replace(/}\);(\s*)$/, '});$1');
  }

  // Only write if changed
  if (content !== original) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✨ ${filePath} - migrated successfully`);
    return true;
  }

  console.log(`⏭️  ${filePath} - no changes needed`);
  return false;
}

// Run migration
console.log('🚀 Starting design system migration (Batch 2)...\n');
let migratedCount = 0;

filesToMigrate.forEach(file => {
  if (migrateFile(file)) {
    migratedCount++;
  }
});

console.log(`\n✅ Migration complete! Migrated ${migratedCount} files.`);
