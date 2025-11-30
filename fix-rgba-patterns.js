#!/usr/bin/env node
/**
 * Fix RGBA Patterns
 * Replaces rgba() with theme color references
 */

const fs = require('fs');
const path = require('path');

const filesToFix = [
  'src/features/admin/ManageScreen.tsx',
  'src/features/students/AddStudentScreen.tsx',
  'src/features/ai-test-generator/AITestGeneratorScreen.tsx',
  'src/components/tasks/TaskSubmissionModal.tsx',
  'src/components/calendar/CalendarMonthView.tsx',
  'src/components/layout/AppNavbarExpo.tsx',
  'src/components/resources/AddResourceModal.tsx',
  'src/components/resources/PDFViewer.tsx',
  'src/components/tests/QuestionBuilderScreen.tsx',
  'src/components/tests/StudentTestCard.tsx',
  'src/components/common/MonthPickerModal.tsx',
  'src/components/timetable/ModernTimetableScreen.tsx',
];

function fixFile(filePath) {
  const fullPath = path.join(__dirname, filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  Skipping ${filePath} - file not found`);
    return false;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  const original = content;
  let changes = 0;

  // Common rgba patterns to theme colors
  const replacements = [
    // Black overlays
    { from: /backgroundColor:\s*'rgba\(0,\s*0,\s*0,\s*0\.5\)'/g, to: "backgroundColor: colors.surface.overlay", desc: "overlay" },
    { from: /backgroundColor:\s*'rgba\(0,0,0,0\.5\)'/g, to: "backgroundColor: colors.surface.overlay", desc: "overlay" },

    // White with opacity (glass/frosted)
    { from: /backgroundColor:\s*'rgba\(255,\s*255,\s*255,\s*0\.[0-9]+\)'/g, to: "backgroundColor: colors.surface.glass", desc: "glass" },
    { from: /backgroundColor:\s*'rgba\(255,255,255,0\.[0-9]+\)'/g, to: "backgroundColor: colors.surface.glass", desc: "glass" },

    // Border colors with opacity
    { from: /borderLeftColor:\s*'rgba\(0,0,0,0\.[0-9]+\)'/g, to: "borderLeftColor: colors.border.light", desc: "border" },
    { from: /color:\s*'rgba\(255,\s*255,\s*255,\s*0\.[89][0-9]*\)'/g, to: "color: colors.text.inverse", desc: "inverse text" },
    { from: /color:\s*'rgba\(255,255,255,0\.[89][0-9]*\)'/g, to: "color: colors.text.inverse", desc: "inverse text" },

    // Ripple effect - use primary with opacity
    { from: /android_ripple=\{\{\s*color:\s*'rgba\(30,\s*78,\s*184,\s*0\.[0-9]+\)'\s*\}\}/g, to: "android_ripple={{ color: colors.primary[100] }}", desc: "ripple" },

    // Box shadow - can't be themed in RN, but comment it out or use elevation instead
    { from: /boxShadow:\s*'[^']*rgba\([^)]+\)[^']*'/g, to: "// boxShadow removed - use shadows from theme instead", desc: "shadow" },
  ];

  replacements.forEach(({ from, to, desc }) => {
    const before = content;
    content = content.replace(from, to);
    if (content !== before) {
      changes++;
      console.log(`  - Replaced ${desc}`);
    }
  });

  if (content !== original) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✨ ${filePath} - fixed ${changes} rgba patterns\n`);
    return true;
  }

  console.log(`⏭️  ${filePath} - no rgba patterns to fix\n`);
  return false;
}

// Run fixes
console.log('🎨 Fixing rgba patterns...\n');
let fixedCount = 0;

filesToFix.forEach(file => {
  if (fixFile(file)) {
    fixedCount++;
  }
});

console.log(`✅ Fixed ${fixedCount} files!`);
