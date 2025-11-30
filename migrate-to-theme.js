#!/usr/bin/env node
/**
 * Design System Migration Script
 *
 * This script migrates components from static color imports to dynamic theming:
 * - Replaces `import { colors } from 'design-system'` with `useTheme()`
 * - Converts static StyleSheet to dynamic createStyles pattern
 * - Maintains all existing functionality
 */

const fs = require('fs');
const path = require('path');

// Files to migrate (from grep results)
const filesToMigrate = [
  'src/components/analytics/KPICard.tsx',
  'src/components/analytics/ProgressRing.tsx',
  'src/components/analytics/TrendChart.tsx',
  'src/components/analytics/shared/MetricCard.tsx',
  'src/components/analytics/shared/ComparisonChart.tsx',
  'src/components/analytics/shared/TimePeriodFilter.tsx',
  'src/components/analytics/shared/EmptyState.tsx',
  'src/components/analytics/shared/LoadingState.tsx',
  'src/components/analytics/shared/SkeletonCard.tsx',
  'src/components/analytics/features/attendance/AttendanceDetailView.tsx',
  'src/components/analytics/features/fees/FeesDetailView.tsx',
  'src/components/analytics/features/learning/LearningDetailView.tsx',
  'src/components/analytics/features/syllabus/SyllabusProgressDetailView.tsx',
  'src/components/fees/FeeComponents.tsx',
  'src/components/fees/FeePlans.tsx',
  'src/components/tasks/TaskFormModal.tsx',
  'src/components/resources/AddResourceModal.tsx',
  'src/components/calendar/CalendarEventFormModal.tsx',
  'src/components/tests/CreateTestForm.tsx',
];

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

  // Step 1: Update imports
  // Remove colors from design-system import
  content = content.replace(
    /import\s*{\s*colors\s*,\s*([^}]+)}\s*from\s*['"].*design-system['"]/g,
    "import { $1 } from '../../../lib/design-system'"
  );

  // Add useTheme and types if not present
  if (!content.includes('useTheme')) {
    // Add React useMemo if not present
    if (!content.includes('useMemo')) {
      content = content.replace(
        /import React(.*?) from 'react'/,
        "import React$1, { useMemo } from 'react'"
      );
    }

    // Find the right import location (after React, before components)
    const importMatch = content.match(/(import React.*?;\n)/);
    if (importMatch) {
      const insertPoint = importMatch.index + importMatch[0].length;
      content = content.slice(0, insertPoint) +
        "import { useTheme } from '../../contexts/ThemeContext';\n" +
        "import type { ThemeColors } from '../../theme/types';\n" +
        content.slice(insertPoint);
    }
  }

  // Step 2: Add useTheme() call in component
  // Find the component function/const
  const componentMatch = content.match(/(export (?:const|function) \w+.*?(?:=>|{))\s*\n/);
  if (componentMatch) {
    // Add useTheme and styles after the component declaration
    const insertPoint = componentMatch.index + componentMatch[0].length;
    const indent = '  ';

    if (!content.includes('useTheme()')) {
      content = content.slice(0, insertPoint) +
        `${indent}const { colors, typography, spacing, borderRadius, shadows } = useTheme();\n` +
        `${indent}const styles = useMemo(() => createStyles(colors, typography, spacing, borderRadius, shadows), [colors, typography, spacing, borderRadius, shadows]);\n\n` +
        content.slice(insertPoint);
    }
  }

  // Step 3: Convert static StyleSheet to createStyles
  content = content.replace(
    /const styles = StyleSheet\.create\({/g,
    'const createStyles = (colors: ThemeColors, typography: any, spacing: any, borderRadius: any, shadows: any) =>\n  StyleSheet.create({'
  );

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
console.log('🚀 Starting design system migration...\n');
let migratedCount = 0;

filesToMigrate.forEach(file => {
  if (migrateFile(file)) {
    migratedCount++;
  }
});

console.log(`\n✅ Migration complete! Migrated ${migratedCount} files.`);
console.log('\n📝 Next steps:');
console.log('1. Review the changes with: git diff');
console.log('2. Test the app to ensure everything works');
console.log('3. Fix any TypeScript errors that may have been introduced');
