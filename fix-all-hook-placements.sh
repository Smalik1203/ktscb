#!/bin/bash

# List of files with hook placement issues
files=(
  "src/components/analytics/TrendChart.tsx"
  "src/components/analytics/shared/ComparisonChart.tsx"
  "src/components/analytics/shared/SummaryCard.tsx"
  "src/components/analytics/shared/TimePeriodFilter.tsx"
  "src/components/analytics/features/attendance/AttendanceDetailView.tsx"
  "src/components/analytics/features/fees/FeesDetailView.tsx"
  "src/components/analytics/features/learning/LearningDetailView.tsx"
  "src/components/analytics/features/syllabus/SyllabusProgressDetailView.tsx"
  "src/components/analytics/dashboards/SuperAdminDashboard.tsx"
  "src/components/analytics/dashboards/StudentDashboard.tsx"
  "src/components/analytics/dashboards/AdminDashboard.tsx"
  "src/components/common/Pagination.tsx"
  "src/components/resources/AddResourceModal.tsx"
  "src/components/tasks/StudentTaskCard.tsx"
  "src/components/tasks/TaskFormModal.tsx"
  "src/components/tasks/TaskSubmissionModal.tsx"
  "src/components/tests/CreateTestForm.tsx"
  "src/components/ui/EmptyState.tsx"
  "src/components/ui/ErrorView.tsx"
  "src/components/ui/LoadingView.tsx"
  "src/components/ui/ProgressRing.tsx"
  "src/components/ui/SuccessAnimation.tsx"
  "src/features/fees/PaymentsScreen.tsx"
  "src/features/fees/StudentFeesScreen.tsx"
)

echo "🔧 Fixing hook placement in ${#files[@]} files..."
echo ""

for file in "${files[@]}"; do
  if [ ! -f "$file" ]; then
    echo "⚠️  Skip: $file (not found)"
    continue
  fi
  
  # Check if file has the problematic pattern
  if grep -q "^  const { colors" "$file" 2>/dev/null; then
    # Extract the hooks lines
    hooks=$(grep "^  const { colors\|^  const styles = useMemo" "$file" | head -2)
    
    # Use Python to do the fix
    python3 << 'PY_EOF' "$file"
import sys, re

file_path = sys.argv[1]
with open(file_path, 'r') as f:
    content = f.read()

# Pattern: hooks in parameter section
pattern = r'((?:export const|const) \w+ = (?:React\.memo<[^>]+>\()?(?:\()?{)\s*(const \{ colors[^\n]+)\s*(const styles[^\n]+)\s*\n\s*([^}]+?)(\}\) => \{|=> \{)'

def fix_hooks(match):
    before = match.group(1)
    hook1 = match.group(2)
    hook2 = match.group(3)
    params = match.group(4).strip()
    after = match.group(5)
    
    # Reconstruct with hooks after function start
    return f"{before}\n  {params}\n{after}\n  {hook1}\n  {hook2}\n"

if re.search(pattern, content, re.DOTALL):
    content = re.sub(pattern, fix_hooks, content, flags=re.DOTALL)
    with open(file_path, 'w') as f:
        f.write(content)
    print(f"✨ Fixed: {file_path}")
else:
    print(f"⏭️  Skip: {file_path} (no pattern match)")
PY_EOF
    python3 - "$file"
  else
    echo "⏭️  Skip: $file (already fixed or different structure)"
  fi
done

echo ""
echo "✅ Done!"
