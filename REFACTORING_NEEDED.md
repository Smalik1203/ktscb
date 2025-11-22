# Code Refactoring Backlog

## Priority: HIGH - Large Component Files

### ModernTimetableScreen.tsx (3,360 lines)
**Location**: `src/components/timetable/ModernTimetableScreen.tsx`

**Recommended Structure**:
```
src/components/timetable/
├── ModernTimetableScreen.tsx (main - 300-400 lines)
├── components/
│   ├── TimetableCard.tsx (CleanTimetableCard)
│   ├── TimetableSlotCard.tsx (ModernTimetableSlotCard)
│   ├── TimetableDatePicker.tsx
│   ├── TimetableFilters.tsx
│   └── TimetableEditModal.tsx
├── hooks/
│   ├── useTimetableFilters.ts
│   └── useTimetableActions.ts
└── types/
    └── timetable.types.ts
```

**Impact**: Improves maintainability, testability, and performance

### PaymentHistory.tsx (2,805 lines)
**Location**: `src/components/fees/PaymentHistory.tsx`

**Impact**: Similar refactoring needed

## Completed Improvements
- ✅ Removed deprecated RPC analytics
- ✅ Integrated fee_student_plans properly
- ✅ Fixed test score calculations
- ✅ Added React.memo to analytics components
- ✅ Removed dayjs (using only date-fns)
- ✅ Enabled strictNullChecks & strictFunctionTypes
- ✅ Replaced console with logger in critical files
