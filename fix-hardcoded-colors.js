#!/usr/bin/env node
/**
 * Fix Hardcoded Colors Script
 * Replaces hex color codes with theme color references
 */

const fs = require('fs');
const path = require('path');

const filesToFix = [
  'src/components/calendar/CalendarEventFormModal.tsx',
  'src/features/syllabus/SyllabusScreen.tsx',
  'src/components/common/ThreeStateView.tsx',
  'src/components/layout/DrawerContent.tsx',
  'src/components/tests/OfflineMarksUploadScreen.tsx',
  'src/features/syllabus/StudentSyllabusScreen.tsx',
  'src/components/syllabus/AddChapterTopicModal.tsx',
  'src/components/calendar/IntegratedCalendarView.tsx',
  'src/components/calendar/HolidayChecker.tsx',
];

// Common color mappings from hex to theme
const colorMappings = [
  // Blues
  { hex: /#0369a1/gi, replace: 'colors.info[600]' },
  { hex: /#1890ff/gi, replace: 'colors.primary[500]' },
  { hex: /#1E4EB8/gi, replace: 'colors.primary[600]' },
  { hex: /#3b82f6/gi, replace: 'colors.primary[500]' },

  // Yellows/Oranges
  { hex: /#faad14/gi, replace: 'colors.warning[500]' },
  { hex: /#f59e0b/gi, replace: 'colors.warning[500]' },

  // Greens
  { hex: /#52c41a/gi, replace: 'colors.success[500]' },
  { hex: /#10b981/gi, replace: 'colors.success[600]' },

  // Purples
  { hex: /#722ed1/gi, replace: 'colors.secondary[600]' },
  { hex: /#a855f7/gi, replace: 'colors.secondary[500]' },

  // Pinks
  { hex: /#eb2f96/gi, replace: 'colors.accent[500]' },
  { hex: /#ec4899/gi, replace: 'colors.accent[600]' },

  // Reds
  { hex: /#ef4444/gi, replace: 'colors.error[500]' },
  { hex: /#dc2626/gi, replace: 'colors.error[600]' },

  // Grays
  { hex: /#8c8c8c/gi, replace: 'colors.neutral[500]' },
  { hex: /#9ca3af/gi, replace: 'colors.neutral[400]' },
  { hex: /#6b7280/gi, replace: 'colors.neutral[500]' },
  { hex: /#4b5563/gi, replace: 'colors.neutral[600]' },
  { hex: /#374151/gi, replace: 'colors.neutral[700]' },
  { hex: /#1f2937/gi, replace: 'colors.neutral[900]' },
  { hex: /#e5e7eb/gi, replace: 'colors.border.DEFAULT' },
  { hex: /#d1d5db/gi, replace: 'colors.neutral[300]' },
  { hex: /#f3f4f6/gi, replace: 'colors.neutral[100]' },
  { hex: /#f9fafb/gi, replace: 'colors.neutral[50]' },

  // Whites/Blacks
  { hex: /#ffffff/gi, replace: 'colors.surface.primary' },
  { hex: /#FFFFFF/gi, replace: 'colors.surface.primary' },
  { hex: /#000000/gi, replace: 'colors.text.primary' },
  { hex: /#000/gi, replace: 'colors.text.primary' },
  { hex: /#fff/gi, replace: 'colors.surface.primary' },
];

function fixFile(filePath) {
  const fullPath = path.join(__dirname, filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  Skipping ${filePath} - file not found`);
    return false;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  const original = content;
  let changesCount = 0;

  // Apply all color mappings
  colorMappings.forEach(({ hex, replace }) => {
    const before = content;
    content = content.replace(hex, replace);
    if (content !== before) {
      changesCount++;
    }
  });

  // Handle rgba() patterns - replace with theme colors and opacity
  const rgbaMatches = content.matchAll(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/g);
  for (const match of rgbaMatches) {
    const [fullMatch, r, g, b] = match;

    // Black with opacity
    if (r === '0' && g === '0' && b === '0') {
      content = content.replace(fullMatch, 'colors.surface.overlay');
      changesCount++;
    }
    // White with opacity
    else if (r === '255' && g === '255' && b === '255') {
      content = content.replace(fullMatch, 'colors.surface.glass');
      changesCount++;
    }
  }

  if (content !== original) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✨ ${filePath} - fixed ${changesCount} color references`);
    return true;
  }

  console.log(`⏭️  ${filePath} - no hardcoded colors found`);
  return false;
}

// Run fixes
console.log('🎨 Fixing hardcoded colors...\n');
let fixedCount = 0;

filesToFix.forEach(file => {
  if (fixFile(file)) {
    fixedCount++;
  }
});

console.log(`\n✅ Fixed ${fixedCount} files!`);
