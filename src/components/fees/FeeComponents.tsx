import React, { useState, useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import type { ThemeColors } from '../../theme/types';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, Platform, ToastAndroid } from 'react-native';
import { Text, Button, ActivityIndicator, Portal, Modal as PaperModal, IconButton } from 'react-native-paper';
import { Plus, Edit, Trash2, X, DollarSign, Search, Settings2 } from 'lucide-react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { spacing, borderRadius, shadows, typography, colors } from '../../../lib/design-system';

interface FeeComponent {
  id: string;
  name: string;
  default_amount_inr: number | null;
  created_at: string;
  code: string;
}

interface FeeComponentsProps {
  schoolCode: string;
}

const toast = (msg: string) => {
  if (Platform.OS === 'android') {
    ToastAndroid.show(msg, ToastAndroid.SHORT);
  } else {
    Alert.alert('Notice', msg);
  }
};

const formatAmount = (amount: number | null) => {
  if (!amount && amount !== 0) return '₹---';
  if (amount === 0) return '₹0';
  
  const absAmount = Math.abs(amount);
  
  // Format large numbers more cleanly
  if (absAmount >= 10000000) {
    const crores = absAmount / 10000000;
    return `₹${crores.toFixed(1)}Cr`;
  }
  
  if (absAmount >= 100000) {
    const lakhs = absAmount / 100000;
    return `₹${lakhs.toFixed(1)}L`;
  }
  
  if (absAmount >= 1000) {
    const thousands = absAmount / 1000;
    return `₹${thousands.toFixed(1)}K`;
  }
  
  // For smaller amounts, show with proper formatting
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
};

export function FeeComponents({ schoolCode }: FeeComponentsProps) {
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const styles = useMemo(() => createStyles(colors, typography, spacing, borderRadius, shadows), [colors, typography, spacing, borderRadius, shadows]);

  const [showModal, setShowModal] = useState(false);
  const [editingComponent, setEditingComponent] = useState<FeeComponent | null>(null);
  const [componentName, setComponentName] = useState('');
  const [componentAmount, setComponentAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const queryClient = useQueryClient();
  const { profile } = useAuth();

  // Fetch components
  const { data: components = [], isLoading } = useQuery({
    queryKey: ['feeComponents', schoolCode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fee_component_types')
        .select('*')
        .eq('school_code', schoolCode)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as FeeComponent[];
    },
    enabled: !!schoolCode,
  });

  // Filter and search components
  const filteredComponents = useMemo(() => {
    if (!searchQuery.trim()) return components;
    const query = searchQuery.toLowerCase().trim();
    return components.filter(
      (comp) =>
        comp.name.toLowerCase().includes(query) ||
        comp.code.toLowerCase().includes(query)
    );
  }, [components, searchQuery]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = components.length;
    const withAmount = components.filter((c) => c.default_amount_inr !== null).length;
    const totalAmount = components.reduce((sum, c) => sum + (c.default_amount_inr || 0), 0);
    return { total, withAmount, totalAmount };
  }, [components]);

  // Open add modal
  const openAddModal = () => {
    setEditingComponent(null);
    setComponentName('');
    setComponentAmount('');
    setShowModal(true);
  };

  // Open edit modal
  const openEditModal = (component: FeeComponent) => {
    setEditingComponent(component);
    setComponentName(component.name);
    setComponentAmount(component.default_amount_inr ? component.default_amount_inr.toString() : '');
    setShowModal(true);
  };

  // Save component
  const handleSave = async () => {
    if (!componentName.trim()) {
      Alert.alert('Error', 'Enter component name');
      return;
    }
    
    // Amount is optional - if provided, validate it
    let amountInr: number | null = null;
    if (componentAmount.trim()) {
      if (isNaN(parseFloat(componentAmount))) {
        Alert.alert('Error', 'Enter valid amount');
      return;
      }
      amountInr = parseFloat(componentAmount);
    }

    // Check for duplicate names in the same school (case-insensitive)
    const trimmedName = componentName.trim();
    const { data: existingComponents, error: checkError } = await supabase
      .from('fee_component_types')
      .select('id, name')
      .eq('school_code', schoolCode);

    if (checkError) {
      Alert.alert('Error', 'Failed to check for duplicates');
      return;
    }

    // Check for duplicate name (case-insensitive), excluding current component if editing
    const duplicateExists = existingComponents?.some(
      (comp) => comp.name.trim().toLowerCase() === trimmedName.toLowerCase() &&
        (!editingComponent || comp.id !== editingComponent.id)
    );

    if (duplicateExists) {
      Alert.alert(
        'Duplicate Name',
        `A component named "${trimmedName}" already exists in this school. Please use a different name.`
      );
      return;
    }

    setLoading(true);
    try {
    if (editingComponent) {
        // Update
        const { error } = await supabase
          .from('fee_component_types')
          .update({
        name: trimmedName,
            default_amount_inr: amountInr,
          })
          .eq('id', editingComponent.id);

        if (error) throw error;
        toast('Component updated');
    } else {
        // Create
        const { error } = await supabase
          .from('fee_component_types')
          .insert({
        name: trimmedName,
            default_amount_inr: amountInr,
            school_code: schoolCode,
            code: trimmedName.toLowerCase().replace(/\s+/g, '_'),
            created_by: profile?.auth_id || '',
          });

        if (error) throw error;
        toast('Component added');
      }

      await queryClient.invalidateQueries({ queryKey: ['feeComponents', schoolCode] });
      setShowModal(false);
      setEditingComponent(null);
      setComponentName('');
      setComponentAmount('');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  // Delete component
  const handleDelete = async (component: FeeComponent) => {
    Alert.alert(
      'Delete Component',
      `Delete "${component.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('fee_component_types')
                .delete()
                .eq('id', component.id);

              if (error) throw error;
              await queryClient.invalidateQueries({ queryKey: ['feeComponents', schoolCode] });
              toast('Component deleted');
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Delete failed');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Statistics Cards */}
      {!isLoading && components.length > 0 && (
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.total}</Text>
            <Text style={styles.statLabel}>Components</Text>
          </View>
          <View style={[styles.statCard, styles.statCardHighlight]}>
            <Text style={[styles.statValue, styles.statValueHighlight]}>
              {stats.withAmount}
            </Text>
            <Text style={styles.statLabel}>With Amount</Text>
          </View>
        </View>
      )}

      {/* Search Bar */}
      {!isLoading && components.length > 0 && (
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Search size={18} color={colors.text.secondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search components..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={colors.text.tertiary}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                style={styles.clearSearchButton}
              >
                <X size={16} color={colors.text.secondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      <ScrollView style={styles.scrollView}>
        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary[600]} />
            <Text style={styles.loadingText}>Loading components...</Text>
          </View>
        ) : components.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <DollarSign size={64} color={colors.primary[300]} />
            </View>
            <Text style={styles.emptyTitle}>No Fee Components</Text>
            <Text style={styles.emptyText}>
              Create fee components like Tuition, Transport, Books, etc.{'\n'}
              These can be assigned to students in fee plans.
            </Text>
            <TouchableOpacity
              style={styles.emptyActionButton}
              onPress={openAddModal}
            >
              <Plus size={20} color={colors.text.inverse} />
              <Text style={styles.emptyActionText}>Add First Component</Text>
            </TouchableOpacity>
          </View>
        ) : filteredComponents.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Search size={64} color={colors.text.tertiary} />
            </View>
            <Text style={styles.emptyTitle}>No Results Found</Text>
            <Text style={styles.emptyText}>
              No components match &quot;{searchQuery}&quot;
            </Text>
            <TouchableOpacity
              style={styles.emptyActionButton}
              onPress={() => setSearchQuery('')}
            >
              <Text style={styles.emptyActionText}>Clear Search</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.list}>
            {filteredComponents.map((component) => {
              const hasAmount = component.default_amount_inr !== null;
              return (
                <TouchableOpacity
                  key={component.id}
                  style={styles.componentCard}
                  onPress={() => openEditModal(component)}
                  activeOpacity={0.7}
                >
                <View style={styles.componentContent}>
                  <View style={styles.componentInfo}>
                      <View style={[
                        styles.componentIconContainer,
                        hasAmount && styles.componentIconContainerWithAmount
                      ]}>
                        <Settings2 size={20} color={hasAmount ? colors.primary[600] : colors.text.tertiary} />
                    </View>
                    <View style={styles.componentText}>
                        <View style={styles.componentHeader}>
                      <Text style={styles.componentName}>{component.name}</Text>
                          {hasAmount && (
                            <View style={styles.amountBadge}>
                              <Text style={styles.amountBadgeText}>Default</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.componentCode}>{component.code}</Text>
                    </View>
                  </View>
                  <View style={styles.componentRight}>
                      <View style={[
                        styles.amountContainer,
                        !hasAmount && styles.amountContainerEmpty
                      ]}>
                        <Text style={[
                          styles.componentAmount,
                          !hasAmount && styles.componentAmountEmpty
                        ]}>
                      {formatAmount(component.default_amount_inr)}
                    </Text>
                      </View>
                    <View style={styles.componentActions}>
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={(e) => {
                            e.stopPropagation();
                            openEditModal(component);
                          }}
                        >
                          <Edit size={16} color={colors.primary[600]} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionButton, styles.deleteButton]}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleDelete(component);
                          }}
                        >
                          <Trash2 size={16} color={colors.error[600]} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Floating Action Button */}
      <View style={styles.fabContainer}>
        <TouchableOpacity
          style={styles.fab}
          onPress={openAddModal}
        >
          <Plus size={24} color={colors.text.inverse} />
        </TouchableOpacity>
      </View>

      {/* Modal */}
      {showModal && (
      <Portal>
          <PaperModal
          visible={showModal}
          onDismiss={() => {
            setShowModal(false);
              setEditingComponent(null);
              setComponentName('');
              setComponentAmount('');
          }}
          >
            <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                  {editingComponent ? 'Edit Component' : 'Add Component'}
              </Text>
              <IconButton
                icon={() => <X size={24} color={colors.text.primary} />}
                onPress={() => {
                  setShowModal(false);
                    setEditingComponent(null);
                    setComponentName('');
                    setComponentAmount('');
                }}
                size={24}
              />
            </View>

              <View style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Component Name <Text style={styles.required}>*</Text>
                </Text>
                  <TextInput
                  style={styles.input}
                    placeholder="e.g. Tuition, Transport, Books"
                  value={componentName}
                  onChangeText={setComponentName}
                  autoFocus
                  placeholderTextColor={colors.text.tertiary}
                />
                <Text style={styles.inputHint}>
                  This name will appear in fee plans
                </Text>
              </View>

              <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    Default Amount (₹) <Text style={styles.optional}>Optional</Text>
                  </Text>
                  <View style={styles.amountInputContainer}>
                    <Text style={styles.currencySymbol}>₹</Text>
                  <TextInput
                      style={styles.amountInput}
                      placeholder="0.00"
                  value={componentAmount}
                  onChangeText={setComponentAmount}
                  keyboardType="decimal-pad"
                      placeholderTextColor={colors.text.tertiary}
                />
                  </View>
                <Text style={styles.inputHint}>
                  Leave empty to set amount per student or leave variable
                </Text>
              </View>

                <View style={styles.modalActions}>
                  <Button
                    onPress={() => {
                      setShowModal(false);
                      setEditingComponent(null);
                      setComponentName('');
                      setComponentAmount('');
                    }}
                  >
                    Cancel
                  </Button>
              <Button
                mode="contained"
                onPress={handleSave}
                    loading={loading}
                    disabled={!componentName.trim() || loading}
              >
                    {editingComponent ? 'Update' : 'Add'}
              </Button>
                </View>
              </View>
            </View>
          </PaperModal>
      </Portal>
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors, typography: any, spacing: any, borderRadius: any, shadows: any) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  scrollView: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  statCardHighlight: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[200],
  },
  statValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold as any,
    color: colors.text.primary,
    marginBottom: spacing.xs / 2,
  },
  statValueHighlight: {
    color: colors.primary[700],
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium as any,
  },
  searchContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.light,
    ...shadows.xs,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    padding: 0,
  },
  clearSearchButton: {
    padding: spacing.xs,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl * 2,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold as any,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: spacing.lg,
  },
  emptyActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  emptyActionText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold as any,
    color: colors.text.inverse,
  },
  list: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl + 80, // Extra space for FAB
    gap: spacing.sm,
  },
  componentCard: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    marginHorizontal: spacing.md,
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  componentContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  componentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.md,
  },
  componentIconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  componentIconContainerWithAmount: {
    backgroundColor: colors.primary[50],
  },
  componentText: {
    flex: 1,
  },
  componentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs / 2,
    flexWrap: 'wrap',
  },
  componentName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold as any,
    color: colors.text.primary,
  },
  amountBadge: {
    backgroundColor: colors.primary[100],
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  amountBadgeText: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[700],
    fontWeight: typography.fontWeight.medium as any,
  },
  componentCode: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    fontFamily: typography.fontFamily.mono,
  },
  componentRight: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  amountContainer: {
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  amountContainerEmpty: {
    backgroundColor: colors.neutral[50],
    borderColor: colors.neutral[200],
  },
  componentAmount: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold as any,
    color: colors.primary[700],
  },
  componentAmountEmpty: {
    color: colors.text.tertiary,
    fontWeight: typography.fontWeight.normal as any,
  },
  componentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral[50],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  deleteButton: {
    backgroundColor: colors.error[50],
    borderColor: colors.error[200],
  },
  fabContainer: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    zIndex: 1000,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  modalContent: {
    backgroundColor: colors.surface.primary,
    padding: spacing.lg,
    margin: spacing.lg,
    borderRadius: borderRadius.lg,
    maxHeight: '80%',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold as any,
    color: colors.text.primary,
  },
  modalBody: {
    gap: spacing.md,
  },
  inputGroup: {
    gap: spacing.xs,
  },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold as any,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  required: {
    color: colors.error[600],
  },
  optional: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    fontWeight: typography.fontWeight.normal as any,
  },
  inputHint: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: spacing.xs / 2,
  },
  input: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
  },
  currencySymbol: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold as any,
    color: colors.text.secondary,
    marginRight: spacing.xs,
  },
  amountInput: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
