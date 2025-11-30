#!/usr/bin/env python3
import re
import sys

files = [
    "src/components/analytics/shared/ComparisonChart.tsx",
    "src/components/analytics/shared/SummaryCard.tsx",
    "src/components/analytics/features/attendance/AttendanceDetailView.tsx",
    "src/components/analytics/features/fees/FeesDetailView.tsx",
    "src/components/analytics/features/learning/LearningDetailView.tsx",
    "src/components/analytics/features/syllabus/SyllabusProgressDetailView.tsx",
    "src/components/analytics/dashboards/SuperAdminDashboard.tsx",
    "src/components/analytics/dashboards/StudentDashboard.tsx",
    "src/components/analytics/dashboards/AdminDashboard.tsx",
    "src/components/common/Pagination.tsx",
    "src/components/resources/AddResourceModal.tsx",
    "src/components/tasks/StudentTaskCard.tsx",
    "src/components/tasks/TaskFormModal.tsx",
    "src/components/tasks/TaskSubmissionModal.tsx",
    "src/components/tests/CreateTestForm.tsx",
    "src/components/ui/EmptyState.tsx",
    "src/components/ui/ErrorView.tsx",
    "src/components/ui/LoadingView.tsx",
    "src/components/ui/SuccessAnimation.tsx",
    "src/features/fees/PaymentsScreen.tsx",
    "src/features/fees/StudentFeesScreen.tsx",
]

def fix_file(filepath):
    try:
        with open(filepath, 'r') as f:
            content = f.read()
        
        original = content
        
        # Pattern: Find function with hooks in parameters
        # Looking for:   export const Name = ({
        #                  const { colors...
        #                  const styles...
        #                  
        #                  actualParam1,
        #                  actualParam2,
        #                }) => {
        
        pattern = r'(export const \w+ = (?:React\.memo<[^>]+>\()?\(\{)\n  (const \{ colors[^\n]+\n  const styles[^\n]+)\n\n((?:  [^\n]+,?\n)+)(\}\) => \{)'
        
        def replacer(match):
            func_start = match.group(1)  # "export const Name = ({"
            hooks = match.group(2)        # The two hook lines
            params = match.group(3)       # The actual parameters
            func_arrow = match.group(4)   # "}) => {"
            
            # Reconstruct correctly
            return f"{func_start}\n{params}{func_arrow}\n  {hooks}\n"
        
        content = re.sub(pattern, replacer, content)
        
        if content != original:
            with open(filepath, 'w') as f:
                f.write(content)
            print(f"✨ Fixed: {filepath}")
            return True
        else:
            print(f"⏭️  Skip: {filepath} (no changes needed)")
            return False
            
    except FileNotFoundError:
        print(f"⚠️  Skip: {filepath} (not found)")
        return False
    except Exception as e:
        print(f"❌ Error: {filepath} - {e}")
        return False

print("🔧 Fixing hook placements...\n")
fixed = sum(fix_file(f) for f in files)
print(f"\n✅ Fixed {fixed} files!")
