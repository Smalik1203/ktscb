/**
 * Inventory Item Master Screen
 * 
 * Main screen for creating and managing inventory item policies.
 * Supports offline draft mode with local persistence.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, Alert, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useCapabilities } from '../../hooks/useCapabilities';
import { useInventoryItems, useCreateInventoryItem, useIssueInventoryItem, useInventoryIssues, useReturnInventoryItem } from '../../hooks/useInventory';
import { IssueInventoryModal } from '../../components/inventory/IssueInventoryModal';
import { ReturnInventoryModal } from '../../components/inventory/ReturnInventoryModal';
import { IssueDetailsModal } from '../../components/inventory/IssueDetailsModal';
import { InventoryItemForm } from '../../components/inventory/InventoryItemForm';
import { LoadingView, ErrorView, EmptyStateIllustration, FAB } from '../../ui';
import { AccessDenied } from '../../components/common/AccessDenied';
import { spacing, typography, borderRadius, shadows } from '../../../lib/design-system';
import type { InventoryItemInput } from '../../lib/domain-schemas';
import { isOnline } from '../../utils/offline';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Text, TouchableOpacity } from 'react-native';

const DRAFT_STORAGE_KEY = 'inventory_item_draft';

export default function InventoryItemMasterScreen() {
  const { profile, user } = useAuth();
  const { colors, isDark } = useTheme();
  const { can, isLoading: capabilitiesLoading } = useCapabilities();
  const router = useRouter();

  const [hasDraft, setHasDraft] = useState(false);
  const [draftData, setDraftData] = useState<Partial<InventoryItemInput> | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [selectedItemForIssue, setSelectedItemForIssue] = useState<any | null>(null);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [selectedIssueForReturn, setSelectedIssueForReturn] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'items' | 'issued'>('items');
  const [showIssueDetails, setShowIssueDetails] = useState(false);
  const [selectedItemIssues, setSelectedItemIssues] = useState<any[]>([]);
  const [selectedItemName, setSelectedItemName] = useState<string>('');

  const canCreate = can('inventory.create');
  const canManage = can('inventory.manage');
  
  // Fetch inventory items
  const { data: items = [], isLoading: itemsLoading, error: itemsError, refetch } = useInventoryItems(profile?.school_code);
  const { data: issues = [], isLoading: issuesLoading, refetch: refetchIssues } = useInventoryIssues(
    profile?.school_code,
    { status: 'issued' } // Only show active issues
  );
  const createItem = useCreateInventoryItem();
  const issueItem = useIssueInventoryItem();
  const returnItem = useReturnInventoryItem();

  // Group issues by inventory_item_id
  const groupedIssues = useMemo(() => {
    if (!issues || issues.length === 0) return [];
    
    const grouped = new Map<string, any[]>();
    issues.forEach((issue: any) => {
      const itemId = issue.inventory_item_id;
      if (!grouped.has(itemId)) {
        grouped.set(itemId, []);
      }
      // Runtime-safe: we just checked has() above, but guard against minification issues
      const itemIssues = grouped.get(itemId);
      if (itemIssues) {
        itemIssues.push(issue);
      }
    });
    
    // Convert to array with aggregated data
    return Array.from(grouped.entries()).map(([itemId, itemIssues]) => {
      const firstIssue = itemIssues[0];
      const totalQuantity = itemIssues.reduce((sum, i) => sum + i.quantity, 0);
      const overdueCount = itemIssues.filter((i: any) => 
        i.expected_return_date && new Date(i.expected_return_date) < new Date()
      ).length;
      const totalCharge = itemIssues.reduce((sum, i) => 
        sum + ((i.charge_amount || 0) * i.quantity), 0
      );
      
      return {
        inventory_item_id: itemId,
        inventory_item: firstIssue.inventory_item,
        totalQuantity,
        issueCount: itemIssues.length,
        overdueCount,
        totalCharge,
        issues: itemIssues,
        latestIssueDate: itemIssues.reduce((latest, i: any) => 
          new Date(i.issue_date) > new Date(latest) ? i.issue_date : latest, 
          itemIssues[0].issue_date
        ),
      };
    });
  }, [issues]);

  // Check for draft on mount
  useEffect(() => {
    checkForDraft();
  }, []);

  const checkForDraft = async () => {
    try {
      const draftJson = await AsyncStorage.getItem(DRAFT_STORAGE_KEY);
      if (draftJson) {
        try {
          const draft = JSON.parse(draftJson);
          // Validate draft structure before using
          if (draft && typeof draft === 'object') {
            setDraftData(draft);
            setHasDraft(true);
          } else {
            // Invalid draft format - clear it
            await AsyncStorage.removeItem(DRAFT_STORAGE_KEY);
          }
        } catch (parseError) {
          // Corrupted JSON - clear it
          // Corrupted JSON - clear it
          await AsyncStorage.removeItem(DRAFT_STORAGE_KEY);
        }
      }
    } catch (err) {
      // Draft load failed - start fresh
    }
  };

  const saveDraft = async (data: Partial<InventoryItemInput>) => {
    try {
      await AsyncStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(data));
      setDraftData(data);
      setHasDraft(true);
    } catch (err) {
      // Draft save failed silently
    }
  };

  const clearDraft = async () => {
    try {
      await AsyncStorage.removeItem(DRAFT_STORAGE_KEY);
      setDraftData(null);
      setHasDraft(false);
    } catch (err) {
      // Draft clear failed silently
    }
  };

  const handleSubmit = async (data: InventoryItemInput) => {
    // Check online status
    const online = await isOnline();
    if (!online) {
      // Save as draft and show message
      await saveDraft(data);
      Alert.alert(
        'Offline Mode',
        'You are currently offline. Your item has been saved as a draft and will be submitted when you are back online.',
        [{ text: 'OK' }]
      );
      setShowForm(false);
      return;
    }

    try {
      await createItem.mutateAsync(data);
      
      // Clear draft on success
      await clearDraft();
      
      // Close form and show success (list will auto-refresh via React Query)
      setShowForm(false);
      Alert.alert(
        'Success',
        'Inventory item created successfully',
        [{ text: 'OK' }]
      );
    } catch (err: any) {
      // Save as draft if submission fails
      await saveDraft(data);
      Alert.alert(
        'Submission Failed',
        err.message || 'Failed to create inventory item. Your data has been saved as a draft.',
        [{ text: 'OK' }]
      );
      throw err;
    }
  };

  const handleResumeDraft = () => {
    setShowForm(true);
  };

  const handleDiscardDraft = async () => {
    Alert.alert(
      'Discard Draft?',
      'Are you sure you want to discard your saved draft?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            await clearDraft();
            setShowForm(true);
          },
        },
      ]
    );
  };

  const handleNewItem = () => {
    if (hasDraft) {
      Alert.alert(
        'Draft Found',
        'You have a saved draft. Would you like to resume it or start fresh?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: handleDiscardDraft },
          { text: 'Resume', onPress: handleResumeDraft },
        ]
      );
    } else {
      setShowForm(true);
    }
  };

  // Authorization check
  if (capabilitiesLoading || itemsLoading) {
    return <LoadingView message="Loading..." />;
  }

  if (!canCreate) {
    return (
      <AccessDenied
        message="You don't have permission to manage inventory."
        capability="inventory.create"
      />
    );
  }

  if (!profile?.school_code) {
    return (
      <ErrorView
        title="School Not Found"
        message="Unable to determine your school. Please contact support."
      />
    );
  }

  if (!user?.id) {
    return <ErrorView title="Authentication Error" message="Please log in again." />;
  }

  if (itemsError) {
    return <ErrorView title="Failed to load inventory items" message={itemsError.message} />;
  }

  // Show form
  if (showForm) {
    return (
      <InventoryItemForm
        onSubmit={handleSubmit}
        onCancel={() => {
          setShowForm(false);
        }}
        schoolCode={profile.school_code}
        userId={user.id}
        initialData={draftData || undefined}
      />
    );
  }

  // Main screen - list or empty state
  const styles = createStyles(colors, isDark);

  const handleIssuePress = (item: any) => {
    if (!item.can_be_issued) {
      Alert.alert('Not Issuable', 'This item cannot be issued');
      return;
    }
    setSelectedItemForIssue(item);
    setShowIssueModal(true);
  };

  const handleIssueSuccess = () => {
    refetch();
    refetchIssues();
  };

  const handleReturnPress = (issue: any) => {
    setSelectedIssueForReturn(issue);
    setShowReturnModal(true);
  };

  const handleReturnSuccess = () => {
    refetch();
    refetchIssues();
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.itemCard}>
      <View style={{ padding: spacing.md }}>
        <TouchableOpacity
          onPress={() => canManage && item.can_be_issued && handleIssuePress(item)}
          disabled={!canManage || !item.can_be_issued}
          activeOpacity={item.can_be_issued ? 0.7 : 1}
        >
          <View style={styles.itemHeader}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemCategory}>{item.category}</Text>
            </View>
            {item.track_quantity && item.current_quantity !== null && (
              <View style={styles.quantityBadge}>
                <Text style={styles.quantityText}>{item.current_quantity}</Text>
              </View>
            )}
          </View>
          {item.description && (
            <Text style={styles.itemDescription} numberOfLines={2}>
              {item.description}
            </Text>
          )}
          <View style={styles.itemMeta}>
            {item.can_be_issued && (
              <View style={styles.metaTag}>
                <Text style={styles.metaText}>Issuable</Text>
              </View>
            )}
            {item.is_chargeable && (
              <View style={[styles.metaTag, styles.chargeableTag]}>
                <Text style={styles.metaText}>₹{item.charge_amount}</Text>
              </View>
            )}
          </View>
          {canManage && item.can_be_issued && (
            <TouchableOpacity
              style={styles.issueButton}
              onPress={() => handleIssuePress(item)}
            >
              <MaterialIcons name="inventory-2" size={16} color={colors.primary[600]} />
              <Text style={styles.issueButtonText}>Issue</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {hasDraft && (
        <View style={styles.draftBanner}>
          <MaterialIcons name="inventory-2" size={20} color={colors.warning[600]} />
          <View style={styles.draftBannerContent}>
            <Text style={styles.draftBannerTitle}>Draft Saved</Text>
            <Text style={styles.draftBannerText}>
              You have an unsaved draft. Resume or discard it to continue.
            </Text>
          </View>
          <View style={styles.draftBannerActions}>
            <TouchableOpacity
              style={styles.draftButton}
              onPress={handleResumeDraft}
            >
              <Text style={styles.draftButtonText}>Resume</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.draftButton, styles.draftButtonSecondary]}
              onPress={handleDiscardDraft}
            >
              <Text style={[styles.draftButtonText, styles.draftButtonTextSecondary]}>
                Discard
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'items' && styles.tabActive]}
          onPress={() => setActiveTab('items')}
        >
          <MaterialIcons name="inventory-2" size={18} color={activeTab === 'items' ? colors.primary[600] : colors.text.secondary} />
          <Text style={[styles.tabText, activeTab === 'items' && styles.tabTextActive]}>
            Items ({items.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'issued' && styles.tabActive]}
          onPress={() => setActiveTab('issued')}
        >
          <MaterialIcons name="list" size={18} color={activeTab === 'issued' ? colors.primary[600] : colors.text.secondary} />
          <Text style={[styles.tabText, activeTab === 'issued' && styles.tabTextActive]}>
            Issued ({issues.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Items Tab */}
      {activeTab === 'items' && (
        <>
          {items.length === 0 ? (
            <EmptyStateIllustration
              type="inventory"
              title="Inventory Items"
              description="Create inventory item policies to define how items are tracked, issued, and charged."
              action={
                <TouchableOpacity
                  style={styles.createButton}
                  onPress={handleNewItem}
                >
                  <MaterialIcons name="add" size={20} color={colors.text.inverse} />
                  <Text style={styles.createButtonText}>Create Item</Text>
                </TouchableOpacity>
              }
            />
          ) : (
        <>
          <FlatList
            data={items}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <EmptyStateIllustration
                type="inventory"
                title="No Items"
                description="Create your first inventory item to get started."
                action={
                  <TouchableOpacity
                    style={styles.createButton}
                    onPress={handleNewItem}
                  >
                    <MaterialIcons name="add" size={20} color={colors.text.inverse} />
                    <Text style={styles.createButtonText}>Create Item</Text>
                  </TouchableOpacity>
                }
              />
            }
          />
        </>
          )}
        </>
      )}

      {/* Issued Items Tab */}
      {activeTab === 'issued' && (
        <>
          {issuesLoading ? (
            <LoadingView message="Loading issued items..." />
          ) : issues.length === 0 ? (
            <EmptyStateIllustration
              type="inventory"
              title="No Issued Items"
              description="Items that have been issued will appear here. You can return them to reverse quantities and fees."
            />
          ) : (
            <FlatList
              data={groupedIssues}
              keyExtractor={(item) => item.inventory_item_id}
              renderItem={({ item: groupedItem }) => {
                return (
                  <View style={styles.issueCard}>
                    <View style={{ padding: spacing.md }}>
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedItemIssues(groupedItem.issues);
                          setSelectedItemName(groupedItem.inventory_item?.name || 'Unknown Item');
                          setShowIssueDetails(true);
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={styles.issueHeader}>
                          <View style={styles.issueInfo}>
                            <View style={styles.issueItemHeader}>
                              <Text style={styles.issueItemName}>
                                {groupedItem.inventory_item?.name || 'Unknown Item'}
                              </Text>
                              <View style={styles.issueBadge}>
                                <Text style={styles.issueBadgeText}>
                                  {groupedItem.issueCount} {groupedItem.issueCount === 1 ? 'issue' : 'issues'}
                                </Text>
                              </View>
                            </View>
                            <Text style={styles.issueDetails}>
                              Total Quantity: {groupedItem.totalQuantity} • Latest: {new Date(groupedItem.latestIssueDate).toLocaleDateString('en-IN')}
                            </Text>
                            {groupedItem.overdueCount > 0 && (
                              <Text style={styles.issueOverdue}>
                                {groupedItem.overdueCount} {groupedItem.overdueCount === 1 ? 'item' : 'items'} overdue
                              </Text>
                            )}
                            {groupedItem.totalCharge > 0 && (
                              <Text style={styles.issueCharge}>
                                Total Charge: ₹{groupedItem.totalCharge.toFixed(2)}
                              </Text>
                            )}
                          </View>
                          <MaterialIcons name="chevron-right" size={20} color={colors.text.secondary} />
                        </View>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }}
              contentContainerStyle={styles.listContent}
            />
          )}
        </>
      )}

      {/* Issue Modal */}
      {selectedItemForIssue && (
        <IssueInventoryModal
          visible={showIssueModal}
          onClose={() => {
            setShowIssueModal(false);
            setSelectedItemForIssue(null);
          }}
          onSuccess={handleIssueSuccess}
          inventoryItem={selectedItemForIssue}
          schoolCode={profile.school_code || ''}
          onIssue={async (data) => {
            const result = await issueItem.mutateAsync(data);
            return result;
          }}
        />
      )}

      {/* Return Modal */}
      {selectedIssueForReturn && (
        <ReturnInventoryModal
          visible={showReturnModal}
          onClose={() => {
            setShowReturnModal(false);
            setSelectedIssueForReturn(null);
          }}
          onSuccess={handleReturnSuccess}
          issue={selectedIssueForReturn}
          onReturn={async (data) => {
            await returnItem.mutateAsync(data);
          }}
        />
      )}

      {/* Floating Add Button */}
      <FAB icon="add" onPress={handleNewItem} visible={activeTab === 'items' && !itemsLoading} />

      {/* Issue Details Modal */}
      {showIssueDetails && (
        <IssueDetailsModal
          visible={showIssueDetails}
          onClose={() => {
            setShowIssueDetails(false);
            setSelectedItemIssues([]);
            setSelectedItemName('');
          }}
          itemName={selectedItemName}
          issues={selectedItemIssues}
          onReturnPress={handleReturnPress}
          canManage={canManage}
        />
      )}
    </View>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.app,
  },
  draftBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning[50],
    borderBottomWidth: 1,
    borderBottomColor: colors.warning[200],
    padding: spacing.md,
    gap: spacing.sm,
  },
  draftBannerContent: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  draftBannerTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning[700],
    marginBottom: spacing.xs / 2,
  },
  draftBannerText: {
    fontSize: typography.fontSize.sm,
    color: colors.warning[700],
  },
  draftBannerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  draftButton: {
    backgroundColor: colors.warning[600],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.button,
  },
  draftButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.warning[600],
  },
  draftButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.inverse,
  },
  draftButtonTextSecondary: {
    color: colors.warning[600],
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.button,
    ...shadows.sm,
  },
  createButtonText: {
    color: colors.text.inverse,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
  itemCard: {
    marginBottom: spacing.md,
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.md,
    ...shadows.sm,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs / 2,
  },
  itemCategory: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  quantityBadge: {
    backgroundColor: colors.primary[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  quantityText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[700],
  },
  itemDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  itemMeta: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  metaTag: {
    backgroundColor: colors.surface.secondary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.sm,
  },
  chargeableTag: {
    backgroundColor: colors.success[100],
  },
  metaText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  issueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary[50],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.button,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  issueButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    gap: spacing.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface.secondary,
  },
  tabActive: {
    backgroundColor: colors.primary[50],
    borderBottomWidth: 2,
    borderBottomColor: colors.primary[600],
  },
  tabText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  tabTextActive: {
    color: colors.primary[600],
    fontWeight: typography.fontWeight.semibold,
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
  issueItemName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  issueItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  issueBadge: {
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.sm,
  },
  issueBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
  },
  issueDetails: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.xs / 2,
  },
  issueReturnDate: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.xs / 2,
  },
  issueOverdue: {
    color: colors.error[600],
    fontWeight: typography.fontWeight.semibold,
  },
  issueCharge: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
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
});

