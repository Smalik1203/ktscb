#!/bin/bash
# Fix hook placement in all analytics files

# Function to fix a single file
fix_file() {
    local file="$1"
    if [ ! -f "$file" ]; then
        echo "⚠️  Skipping $file - not found"
        return
    fi

    # Check if file has the malformed pattern
    if grep -q "React.memo<.*>(\({" "$file" && grep -q "const { colors" "$file" | head -1 | grep -q "({"; then
        echo "✨ Fixing $file"
        # Create backup
        cp "$file" "${file}.bak"
        
        # Use Python for more reliable text manipulation
        python3 << 'PYTHON_EOF'
import re
import sys

file_path = sys.argv[1]
with open(file_path, 'r') as f:
    content = f.read()

# Pattern to match the hooks in wrong location
pattern = r'(React\.memo<[^>]+>\(\(\{)\s*(const \{ colors[^}]+\} = useTheme\(\);)\s*(const styles = useMemo\([^)]+\), \[[^\]]+\]\);)\s*\n\s*([^}]+?)(\}\) => \{)'

def fix_hooks(match):
    before_params = match.group(1)
    hook1 = match.group(2)
    hook2 = match.group(3)
    params = match.group(4).strip()
    after_params = match.group(5)
    
    # Reconstruct correctly
    return f"{before_params}\n  {params}\n{after_params}\n  {hook1}\n  {hook2}\n\n"

content = re.sub(pattern, fix_hooks, content, flags=re.DOTALL)

with open(file_path, 'w') as f:
    f.write(content)
PYTHON_EOF
        python3 - "$file"
        echo "  ✅ Fixed"
    else
        echo "⏭️  $file - already correct or different pattern"
    fi
}

# Files to fix
files=(
    "src/components/analytics/ProgressRing.tsx"
    "src/components/analytics/TrendChart.tsx"
    "src/components/analytics/shared/MetricCard.tsx"
    "src/components/analytics/shared/ComparisonChart.tsx"
    "src/components/analytics/features/attendance/AttendanceDetailView.tsx"
    "src/components/analytics/features/fees/FeesDetailView.tsx"
    "src/components/analytics/features/learning/LearningDetailView.tsx"
    "src/components/analytics/features/syllabus/SyllabusProgressDetailView.tsx"
    "src/components/analytics/dashboards/SuperAdminDashboard.tsx"
    "src/components/analytics/dashboards/StudentDashboard.tsx"
    "src/components/analytics/dashboards/AdminDashboard.tsx"
)

echo "🔧 Fixing hook placement..."
for file in "${files[@]}"; do
    fix_file "$file"
done

echo "✅ Done!"
