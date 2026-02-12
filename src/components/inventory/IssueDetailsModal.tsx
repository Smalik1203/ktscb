/**
 * Issue Details Modal
 * 
 * Shows individual issue instances for a grouped inventory item.
 */

import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Text } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Modal } from '../../ui';
import { useTheme } from '../../contexts/ThemeContext';
import { spacing, typography, borderRadius, shadows } from '../../../lib/design-system';

interface IssueDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  itemName: string;
  issues: any[];
  onReturnPress: (issue: any) => void;
  canManage: boolean;
}

export function IssueDetailsModal({
  visible,
  onClose,
  itemName,
  issues,
  onReturnPress,
  canManage,
}: IssueDetailsModalProps) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  return (
    <Modal
      visible={visible}
      onDismiss={onClose}
      title={itemName}
    >
      <View style={styles.container}>
          <Text style={styles.headerSubtitle}>
            {issues.length} {issues.length === 1 ? 'issue' : 'issues'}
          </Text>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {issues.map((issue) => {
              const isOverdue = issue.expected_return_date 
                ? new Date(issue.expected_return_date) < new Date()
                : false;
              
              return (
                <View key={issue.id} style={styles.issueCard}>
                  <View style={{ padding: spacing.md }}>
                    <View style={styles.issueHeader}>
                      <View style={styles.issueInfo}>
                        <View style={styles.issueRow}>
                          <Text style={styles.issueLabel}>Quantity:</Text>
                          <Text style={styles.issueValue}>{issue.quantity}</Text>
                        </View>
                        <View style={styles.issueRow}>
                          <Text style={styles.issueLabel}>Issued Date:</Text>
                          <Text style={styles.issueValue}>
                            {new Date(issue.issue_date).toLocaleDateString('en-IN')}
                          </Text>
                        </View>
                        {issue.expected_return_date && (
                          <View style={styles.issueRow}>
                            <Text style={styles.issueLabel}>Expected Return:</Text>
                            <Text style={[styles.issueValue, isOverdue && styles.overdueText]}>
                              {new Date(issue.expected_return_date).toLocaleDateString('en-IN')}
                              {isOverdue && ' (Overdue)'}
                            </Text>
                          </View>
                        )}
                        {issue.serial_number && (
                          <View style={styles.issueRow}>
                            <Text style={styles.issueLabel}>Serial Number:</Text>
                            <Text style={styles.issueValue}>{issue.serial_number}</Text>
                          </View>
                        )}
                        {issue.charge_amount && (
                          <View style={styles.issueRow}>
                            <Text style={styles.issueLabel}>Charge:</Text>
                            <Text style={styles.issueValue}>
                              ₹{issue.charge_amount} {issue.charge_type === 'deposit' ? '(Refundable)' : ''}
                            </Text>
                          </View>
                        )}
                        {issue.issued_to_name && (
                          <View style={styles.issueRow}>
                            <Text style={styles.issueLabel}>Issued To:</Text>
                            <Text style={styles.issueValue}>
                              {issue.issued_to_name}
                            </Text>
                          </View>
                        )}
                      </View>
                      {canManage && (
                        <TouchableOpacity
                          style={styles.returnButton}
                          onPress={() => {
                            onReturnPress(issue);
                            onClose();
                          }}
                        >
                          <MaterialIcons name="replay" size={16} color={colors.primary[600]} />
                          <Text style={styles.returnButtonText}>Return</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    {isOverdue && (
                      <View style={styles.overdueBadge}>
                        <MaterialIcons name="error" size={14} color={colors.error[600]} />
                        <Text style={styles.overdueBadgeText}>Overdue</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  modal: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.xl,
    margin: spacing.lg,
    maxHeight: '90%',
    ...shadows.lg,
  },
  container: {
    maxHeight: '90%',
  },
  headerSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  scrollView: {
    maxHeight: 500,
  },
  issueCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  issueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  issueInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  issueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  issueLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  issueValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  overdueText: {
    color: colors.error[600],
    fontWeight: typography.fontWeight.semibold,
  },
  returnButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary[50],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.button,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  returnButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
  },
  overdueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.error[50],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  overdueBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.error[600],
  },
});

