/**
 * FeesScreen - Main fees screen (Invoice-First)
 * 
 * Admin: Shows class selector + invoice list + generate button
 * Student: Shows their invoices directly
 */

import React, { useState, useMemo, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { Users, Plus, ChevronDown } from 'lucide-react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useClassSelection } from '../../contexts/ClassSelectionContext';
import { useTheme } from '../../contexts/ThemeContext';
import type { ThemeColors } from '../../theme/types';
import { useCapabilities } from '../../hooks/useCapabilities';
import { useClasses } from '../../hooks/useClasses';
import { InvoiceList, StudentFeesView, GenerateFeesModal } from '../../components/fees';
import { ClassSelectorModal } from '../../components/fees/ClassSelectorModal';

export default function FeesScreen() {
  const { profile } = useAuth();
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const { selectedClass, setSelectedClass, scope } = useClassSelection();
  const { can } = useCapabilities();
  const { data: classes = [] } = useClasses(scope.school_code ?? undefined);
  const queryClient = useQueryClient();

  const styles = useMemo(
    () => createStyles(colors, typography, spacing, borderRadius, shadows),
    [colors, typography, spacing, borderRadius, shadows]
  );

  const [showClassSelector, setShowClassSelector] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Check capabilities
  const canManageFees = can('fees.write');
  const isStudentView = can('fees.read_own') && !can('fees.read');

  const handleGenerated = useCallback(() => {
    // Invalidate invoice queries to trigger refetch
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
    setRefreshKey(k => k + 1);
    setShowGenerateModal(false);
  }, [queryClient]);

  // Student view
  if (isStudentView) {
    return <StudentFeesView />;
  }

  // Admin view - needs class selection
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.classSelector}
          onPress={() => setShowClassSelector(true)}
        >
          <Users size={20} color={colors.primary[600]} />
          <Text style={styles.classSelectorText}>
            {selectedClass ? `Grade ${selectedClass.grade} ${selectedClass.section}` : 'Select Class'}
          </Text>
          <ChevronDown size={18} color={colors.text.tertiary} />
        </TouchableOpacity>

        {selectedClass && canManageFees && (
          <TouchableOpacity
            style={styles.generateBtn}
            onPress={() => setShowGenerateModal(true)}
          >
            <Plus size={18} color="#fff" />
            <Text style={styles.generateBtnText}>Generate</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      {selectedClass ? (
        <InvoiceList
          key={`${selectedClass.id}-${refreshKey}`}
          classInstanceId={selectedClass.id}
          schoolCode={scope.school_code || ''}
        />
      ) : (
        <View style={styles.emptyState}>
          <Users size={64} color={colors.neutral[300]} />
          <Text style={styles.emptyTitle}>Select a Class</Text>
          <Text style={styles.emptyText}>
            Choose a class to view and manage fee invoices.
          </Text>
          <TouchableOpacity
            style={styles.selectBtn}
            onPress={() => setShowClassSelector(true)}
          >
            <Text style={styles.selectBtnText}>Select Class</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Class Selector Modal */}
      <ClassSelectorModal
        visible={showClassSelector}
        onClose={() => setShowClassSelector(false)}
        classes={classes}
        selectedClass={selectedClass}
        onSelect={(cls) => {
          setSelectedClass(cls);
          setShowClassSelector(false);
        }}
      />

      {/* Generate Fees Modal */}
      {selectedClass && (
        <GenerateFeesModal
          visible={showGenerateModal}
          onClose={() => setShowGenerateModal(false)}
          onGenerated={handleGenerated}
          classInstanceId={selectedClass.id}
          className={`Grade ${selectedClass.grade} ${selectedClass.section}`}
          schoolCode={scope.school_code || ''}
        />
      )}
    </View>
  );
}

const createStyles = (
  colors: ThemeColors,
  typography: any,
  spacing: any,
  borderRadius: any,
  shadows: any
) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.app,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: colors.surface.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  classSelector: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    marginRight: spacing.sm,
  },
  classSelectorText: {
    flex: 1,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginLeft: spacing.sm,
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    gap: spacing.xs,
  },
  generateBtnText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: '#fff',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginTop: spacing.lg,
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  selectBtn: {
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
  },
  selectBtnText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: '#fff',
  },
});
