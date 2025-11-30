#!/usr/bin/env node
/**
 * Fix Hook Placement
 * Moves misplaced useTheme hooks to the correct location
 */

const fs = require('fs');
const path = require('path');

const filesToFix = [
  'src/components/analytics/KPICard.tsx',
  'src/components/analytics/ProgressRing.tsx',
  'src/components/analytics/TrendChart.tsx',
  'src/components/analytics/shared/MetricCard.tsx',
  'src/components/analytics/shared/ComparisonChart.tsx',
  'src/components/analytics/features/attendance/AttendanceDetailView.tsx',
  'src/components/analytics/features/fees/FeesDetailView.tsx',
  'src/components/analytics/features/learning/LearningDetailView.tsx',
  'src/components/analytics/features/syllabus/SyllabusProgressDetailView.tsx',
  'src/components/analytics/dashboards/SuperAdminDashboard.tsx',
  'src/components/analytics/dashboards/StudentDashboard.tsx',
  'src/components/analytics/dashboards/AdminDashboard.tsx',
];

function fixFile(filePath) {
  const fullPath = path.join(__dirname, filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  Skipping ${filePath} - file not found`);
    return false;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  const original = content;

  // Pattern: hooks inserted inside parameter list
  // Look for the malformed pattern and fix it
  const malformedPattern = /export const (\w+) = React\.memo<[^>]+>\(\(\{\s*const \{ colors[^}]+\} = useTheme\(\);\s*const styles = useMemo\([^)]+\), \[[^\]]+\]\);\s*\n\s*([^}]+)\}\) => \{/s;

  if (malformedPattern.test(content)) {
    // Extract the parameters that were pushed down
    const match = content.match(/export const (\w+) = React\.memo<[^>]+>\(\(\{\s*const \{ colors[^}]+\} = useTheme\(\);\s*const styles = useMemo\([^)]+\), \[[^\]]+\]\);\s*\n\s*([^}]+?)\n\}\) => \{/s);

    if (match) {
      const componentName = match[1];
      const params = match[2].trim();

      // Find and extract the hooks
      const hooksMatch = content.match(/(const \{ colors[^}]+\} = useTheme\(\);)\s*(const styles = useMemo\([^)]+\), \[[^\]]+\]\);)/s);

      if (hooksMatch) {
        const hook1 = hooksMatch[1];
        const hook2 = hooksMatch[2];

        // Remove hooks from parameter list
        content = content.replace(/\{\s*const \{ colors[^}]+\} = useTheme\(\);\s*const styles = useMemo\([^)]+\), \[[^\]]+\]\);\s*\n\s*/, '{\n  ');

        // Add hooks after the opening brace of the function body
        content = content.replace(
          /(\}\) => \{)\s*\n/,
          `}) => {\n  ${hook1}\n  ${hook2}\n\n`
        );
      }
    }
  }

  if (content !== original) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✨ ${filePath} - fixed hook placement`);
    return true;
  }

  console.log(`⏭️  ${filePath} - already correct or pattern not found`);
  return false;
}

// Run fixes
console.log('🔧 Fixing hook placement...\n');
let fixedCount = 0;

filesToFix.forEach(file => {
  if (fixFile(file)) {
    fixedCount++;
  }
});

console.log(`\n✅ Fixed ${fixedCount} files!`);
