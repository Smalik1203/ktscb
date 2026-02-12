# UI Consistency - Phase 2 Tracking

Phase 1 (completed) addressed duplicate screen headers and modal inconsistencies.
This document tracks the remaining cleanup for a future pass.

---

## 1. Hardcoded Hex Colors (Replace with theme tokens)

Priority files (most occurrences):

| File | Examples |
|------|----------|
| `src/features/announcements/components/CreateAnnouncementModal.tsx` | `#3B82F6`, `#8B5CF6`, `#F59E0B`, `#EF4444`, `#fff` |
| `src/features/announcements/components/AnnouncementCard.tsx` | Hardcoded status colors |
| `src/features/announcements/AnnouncementsScreen.tsx` | `#fff`, `#000` |
| `src/features/admin/ManageScreen.tsx` | Multiple hardcoded values |
| `src/features/syllabus/SyllabusScreen.tsx` | Various hardcoded colors |
| `src/features/feedback/components/StudentFeedbackForm.tsx` | 5+ hardcoded colors |
| `src/features/tasks/TasksScreen.tsx` | `shadowColor: '#000'` |
| `src/features/fees/FeesScreen.tsx` | 3+ hardcoded values |
| `src/features/finance/FinanceScreen.tsx` | Hardcoded hex in styles |
| `src/features/chatbot/ChatbotScreen.tsx` | `#FFFFFF` for icon color |
| `src/features/ai-test-generator/components/AIGenerationOverlay.tsx` | Multiple |
| `src/features/ai-test-generator/components/UploadStep.tsx` | Multiple |

**Pattern to follow:** Replace `#fff` with `colors.text.inverse`, `#000` shadow with `colors.neutral[900]`, status colors with `colors.success/warning/error` tokens.

---

## 2. Raw RN Text Usage (Replace with UI kit typography)

25+ files import `Text` from `react-native` instead of using `Heading`, `Body`, or `Caption` from the UI kit.

Top offenders:
- `src/features/dashboard/DashboardScreen.tsx`
- `src/features/announcements/AnnouncementsScreen.tsx`
- `src/features/admin/ManageScreen.tsx`
- `src/features/syllabus/SyllabusScreen.tsx`
- `src/features/calendar/CalendarScreen.tsx`
- `src/features/tasks/TasksScreen.tsx`
- `src/features/fees/FeesScreen.tsx`
- `src/features/finance/FinanceScreen.tsx`
- `src/features/students/AddStudentScreen.tsx`
- `src/features/classes/AddClassesScreen.tsx`

**Pattern to follow:** `<Text style={styles.title}>` becomes `<Heading level={4}>`, body text becomes `<Body>`, small labels become `<Caption>`.

---

## 3. Hardcoded Padding/Margin (Replace with spacing tokens)

30+ files use raw pixel values (`padding: 24`, `marginTop: 100`) instead of spacing tokens (`spacing.lg`, `spacing.xl`).

Common violations:
- `paddingTop: 100` / `paddingBottom: 140` for empty state positioning
- `marginTop: 2`, `marginLeft: 4` instead of `spacing.xs`
- `padding: 3` instead of `spacing[1]` or similar

**Pattern to follow:** Import `spacing` from design system and use token names.

---

## 4. Container Component Adoption

The `Container` component from `src/ui/` is almost never used. Most screens use raw `View` or `ScrollView` with manual padding and safe area handling.

**Goal:** Wrap screen content in `<Container>` for consistent padding and safe area behavior.

---

## 5. Static StyleSheet.create vs Dynamic Styles

Many screens define `const styles = StyleSheet.create({...})` with hardcoded values at module scope. These cannot use theme colors or spacing tokens.

**Pattern to follow:** Convert to `const createStyles = (colors, spacing) => StyleSheet.create({...})` and call inside the component with theme values.

---

## 6. Type Errors (Pre-existing)

These pre-existing type issues were found during Phase 1 verification:
- `colors.border.primary` used in `CreateAnnouncementModal.tsx` but `BorderColors` type only has `light`, `DEFAULT`, `dark`, `accent`
- `colors.border.medium` used in `AnnouncementCard.tsx` but doesn't exist
- Multiple `useQuery` generic type mismatches
- `database.types.ts` missing exported member types used by `queries.ts`
