/**
 * Inventory Item Form - Multi-Step Guided Setup
 * 
 * Mobile-native, step-by-step form for creating inventory items.
 * Follows Apple Settings pattern - clear, guided, impossible to misconfigure.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, TextInput, Switch, Alert, Text, ActivityIndicator } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '../../contexts/ThemeContext';
import { spacing, typography, borderRadius, shadows } from '../../../lib/design-system';
import type { InventoryItemInput } from '../../lib/domain-schemas';

interface InventoryItemFormProps {
  onSubmit: (data: InventoryItemInput) => Promise<void>;
  onCancel: () => void;
  schoolCode: string;
  userId: string;
  initialData?: Partial<InventoryItemInput>;
}

type Step = 1 | 2 | 3 | 4 | 5;

export function InventoryItemForm({
  onSubmit,
  onCancel,
  schoolCode,
  userId,
  initialData,
}: InventoryItemFormProps) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  // Step state
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1: Basic Information
  const [name, setName] = useState(initialData?.name || '');
  const [category, setCategory] = useState(initialData?.category || '');
  const [description, setDescription] = useState(initialData?.description || '');

  // Step 2: Tracking Rules
  const [trackQuantity, setTrackQuantity] = useState(initialData?.track_quantity ?? true);
  const [currentQuantity, setCurrentQuantity] = useState<string>(
    initialData?.current_quantity?.toString() || ''
  );
  const [lowStockThreshold, setLowStockThreshold] = useState<string>(
    initialData?.low_stock_threshold?.toString() || ''
  );
  const [trackSerially, setTrackSerially] = useState(initialData?.track_serially ?? false);

  // Step 3: Issuance Rules
  const [canBeIssued, setCanBeIssued] = useState(initialData?.can_be_issued ?? false);
  const [issueTo, setIssueTo] = useState<'student' | 'staff' | 'both' | null>(
    initialData?.issue_to || null
  );
  const [mustBeReturned, setMustBeReturned] = useState(initialData?.must_be_returned ?? false);
  const [returnDurationDays, setReturnDurationDays] = useState<string>(
    initialData?.return_duration_days?.toString() || ''
  );

  // Step 4: Fee Rules
  const [isChargeable, setIsChargeable] = useState(initialData?.is_chargeable ?? false);
  const [chargeType, setChargeType] = useState<'one_time' | 'deposit' | null>(
    initialData?.charge_type || null
  );
  const [chargeAmount, setChargeAmount] = useState<string>(
    initialData?.charge_amount?.toString() || ''
  );
  const [autoAddToFees, setAutoAddToFees] = useState(initialData?.auto_add_to_fees ?? false);
  const [feeCategory, setFeeCategory] = useState<'books' | 'uniform' | 'misc' | null>(
    initialData?.fee_category || null
  );

  // Step 5: Internal Controls (collapsed by default)
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [unitCost, setUnitCost] = useState<string>(
    initialData?.unit_cost?.toString() || ''
  );
  const [allowPriceOverride, setAllowPriceOverride] = useState(initialData?.allow_price_override ?? false);
  const [internalNotes, setInternalNotes] = useState(initialData?.internal_notes || '');

  // Validation
  const validateStep = (step: Step): boolean => {
    switch (step) {
      case 1:
        if (!name.trim()) {
          Alert.alert('Required', 'Please enter item name');
          return false;
        }
        if (!category.trim()) {
          Alert.alert('Required', 'Please enter category');
          return false;
        }
        return true;
      
      case 2:
        if (trackQuantity) {
          const qty = parseInt(currentQuantity);
          if (currentQuantity && (isNaN(qty) || qty < 0)) {
            Alert.alert('Invalid', 'Current quantity must be a positive number');
            return false;
          }
          const threshold = parseInt(lowStockThreshold);
          if (lowStockThreshold && (isNaN(threshold) || threshold < 0)) {
            Alert.alert('Invalid', 'Low stock threshold must be a positive number');
            return false;
          }
        }
        if (trackSerially && !trackQuantity) {
          Alert.alert('Invalid', 'Serial tracking requires quantity tracking');
          return false;
        }
        return true;
      
      case 3:
        if (canBeIssued && !issueTo) {
          Alert.alert('Required', 'Please select who can receive this item');
          return false;
        }
        if (mustBeReturned) {
          const days = parseInt(returnDurationDays);
          if (!returnDurationDays || isNaN(days) || days <= 0) {
            Alert.alert('Required', 'Please enter return duration in days');
            return false;
          }
        }
        return true;
      
      case 4:
        if (isChargeable) {
          if (!chargeType) {
            Alert.alert('Required', 'Please select charge type');
            return false;
          }
          const amount = parseFloat(chargeAmount);
          if (!chargeAmount || isNaN(amount) || amount < 0) {
            Alert.alert('Required', 'Please enter a valid charge amount');
            return false;
          }
          if (autoAddToFees && !feeCategory) {
            Alert.alert('Required', 'Please select fee category');
            return false;
          }
        }
        return true;
      
      case 5:
        if (unitCost) {
          const cost = parseFloat(unitCost);
          if (isNaN(cost) || cost < 0) {
            Alert.alert('Invalid', 'Unit cost must be a positive number');
            return false;
          }
        }
        return true;
      
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) return;
    if (currentStep < 5) {
      setCurrentStep((prev) => (prev + 1) as Step);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as Step);
    }
  };

  const handleCancel = () => {
    // Check if user has entered any data
    const hasData = name.trim() || category.trim() || description.trim() || 
                    currentQuantity || lowStockThreshold || 
                    canBeIssued || isChargeable || unitCost || internalNotes;
    
    if (hasData) {
      Alert.alert(
        'Discard Changes?',
        'You have unsaved changes. Are you sure you want to close?',
        [
          { text: 'Continue Editing', style: 'cancel' },
          { 
            text: 'Discard', 
            style: 'destructive',
            onPress: onCancel 
          },
        ]
      );
    } else {
      onCancel();
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(5)) return;

    const data: InventoryItemInput = {
      school_code: schoolCode,
      name: name.trim(),
      category,
      description: description.trim() || null,
      track_quantity: trackQuantity,
      current_quantity: trackQuantity && currentQuantity ? parseInt(currentQuantity) : null,
      low_stock_threshold: trackQuantity && lowStockThreshold ? parseInt(lowStockThreshold) : null,
      track_serially: trackSerially,
      can_be_issued: canBeIssued,
      issue_to: canBeIssued ? issueTo : null,
      must_be_returned: mustBeReturned,
      return_duration_days: mustBeReturned && returnDurationDays ? parseInt(returnDurationDays) : null,
      is_chargeable: isChargeable,
      charge_type: isChargeable ? chargeType : null,
      charge_amount: isChargeable && chargeAmount ? parseFloat(chargeAmount) : null,
      auto_add_to_fees: autoAddToFees,
      fee_category: autoAddToFees ? feeCategory : null,
      unit_cost: unitCost ? parseFloat(unitCost) : null,
      allow_price_override: allowPriceOverride,
      internal_notes: internalNotes.trim() || null,
      is_active: true,
      created_by: userId,
    };

    try {
      setSubmitting(true);
      await onSubmit(data);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create inventory item');
      throw error;
    } finally {
      setSubmitting(false);
    }
  };

  // Calculate example fee impact
  const exampleFeeImpact = useMemo(() => {
    if (!isChargeable || !chargeAmount || !chargeType) return null;
    const amount = parseFloat(chargeAmount);
    if (isNaN(amount)) return null;
    const quantity = parseInt(currentQuantity) || 1;
    return {
      perItem: amount,
      total: amount * quantity,
      type: chargeType,
    };
  }, [isChargeable, chargeAmount, chargeType, currentQuantity]);

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      case 4:
        return renderStep4();
      case 5:
        return renderStep5();
      default:
        return null;
    }
  };

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>What is this item?</Text>
      <Text style={styles.stepDescription}>
        Start by giving your inventory item a name and category.
      </Text>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Item Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., Mathematics Textbook Grade 5"
          value={name}
          onChangeText={setName}
          placeholderTextColor={colors.text.secondary}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Category *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., Books, Uniform, Devices, Sports, etc."
          value={category}
          onChangeText={setCategory}
          placeholderTextColor={colors.text.secondary}
        />
        <Text style={styles.helperText}>
          Enter the category name (e.g., Books, Uniform, Stationery)
        </Text>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Description (Optional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Add any additional details..."
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          placeholderTextColor={colors.text.secondary}
        />
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>How is it tracked?</Text>
      <Text style={styles.stepDescription}>
        Choose how you want to track this item&apos;s quantity.
      </Text>

      <View style={styles.toggleGroup}>
        <View style={styles.toggleRow}>
          <View style={styles.toggleContent}>
            <Text style={styles.toggleLabel}>Track quantity</Text>
            <Text style={styles.toggleDescription}>
              Monitor how many items are available
            </Text>
          </View>
          <Switch
            value={trackQuantity}
            onValueChange={setTrackQuantity}
            trackColor={{ false: colors.border.DEFAULT, true: colors.primary[600] }}
            thumbColor={colors.surface.primary}
          />
        </View>
      </View>

      {trackQuantity && (
        <>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Current Quantity</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              value={currentQuantity}
              onChangeText={setCurrentQuantity}
              keyboardType="numeric"
              placeholderTextColor={colors.text.secondary}
            />
            <Text style={styles.helperText}>
              Leave empty if setting up for the first time
            </Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Low Stock Alert</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 10"
              value={lowStockThreshold}
              onChangeText={setLowStockThreshold}
              keyboardType="numeric"
              placeholderTextColor={colors.text.secondary}
            />
            <Text style={styles.helperText}>
              Get notified when quantity falls below this number
            </Text>
          </View>

          <View style={styles.toggleGroup}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleContent}>
                <Text style={styles.toggleLabel}>Track each item individually</Text>
                <Text style={styles.toggleDescription}>
                  Assign unique serial numbers to each item (for devices, books, etc.)
                </Text>
              </View>
              <Switch
                value={trackSerially}
                onValueChange={setTrackSerially}
                disabled={!trackQuantity}
                trackColor={{ 
                  false: trackQuantity ? colors.border.DEFAULT : colors.border.light, 
                  true: colors.primary[600] 
                }}
                thumbColor={colors.surface.primary}
              />
            </View>
          </View>
        </>
      )}
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Can it be issued?</Text>
      <Text style={styles.stepDescription}>
        Define if and how this item can be issued to students or staff.
      </Text>

      <View style={styles.toggleGroup}>
        <View style={styles.toggleRow}>
          <View style={styles.toggleContent}>
            <Text style={styles.toggleLabel}>Can be issued</Text>
            <Text style={styles.toggleDescription}>
              Allow this item to be issued to students or staff
            </Text>
          </View>
          <Switch
            value={canBeIssued}
            onValueChange={setCanBeIssued}
            trackColor={{ false: colors.border.DEFAULT, true: colors.primary[600] }}
            thumbColor={colors.surface.primary}
          />
        </View>
      </View>

      {canBeIssued && (
        <>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Issue To *</Text>
            <View style={[styles.segmentedButtons, { flexDirection: 'row', gap: spacing.sm }]}>
              {(['student', 'staff', 'both'] as const).map((val) => (
                <TouchableOpacity
                  key={val}
                  style={[styles.segmentBtn, issueTo === val && styles.segmentBtnActive]}
                  onPress={() => setIssueTo(val)}
                >
                  <Text style={[styles.segmentBtnText, issueTo === val && styles.segmentBtnTextActive]}>
                    {val.charAt(0).toUpperCase() + val.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.toggleGroup}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleContent}>
                <Text style={styles.toggleLabel}>Must be returned</Text>
                <Text style={styles.toggleDescription}>
                  Item must be returned after use (e.g., library books, devices)
                </Text>
              </View>
              <Switch
                value={mustBeReturned}
                onValueChange={setMustBeReturned}
                trackColor={{ false: colors.border.DEFAULT, true: colors.primary[600] }}
                thumbColor={colors.surface.primary}
              />
            </View>
          </View>

          {mustBeReturned && (
            <View style={styles.formGroup}>
              <Text style={styles.label}>Return Duration (Days) *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 7"
                value={returnDurationDays}
                onChangeText={setReturnDurationDays}
                keyboardType="numeric"
                placeholderTextColor={colors.text.secondary}
              />
              <Text style={styles.helperText}>
                Number of days before item must be returned
              </Text>
            </View>
          )}
        </>
      )}

      {!canBeIssued && (
        <View style={styles.infoCard}>
          <MaterialIcons name="info" size={20} color={colors.text.secondary} />
          <Text style={styles.infoText}>
            This item will not be available for issuing. It can only be tracked in inventory.
          </Text>
        </View>
      )}
    </View>
  );

  const renderStep4 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Does this affect fees?</Text>
      <Text style={styles.stepDescription}>
        Configure if issuing this item should add charges to student fees.
      </Text>

      <View style={styles.toggleGroup}>
        <View style={styles.toggleRow}>
          <View style={styles.toggleContent}>
            <Text style={styles.toggleLabel}>This item is chargeable</Text>
            <Text style={styles.toggleDescription}>
              Add a fee when this item is issued
            </Text>
          </View>
          <Switch
            value={isChargeable}
            onValueChange={setIsChargeable}
            trackColor={{ false: colors.border.DEFAULT, true: colors.primary[600] }}
            thumbColor={colors.surface.primary}
          />
        </View>
      </View>

      {!isChargeable && (
        <View style={styles.infoCard}>
          <MaterialIcons name="info" size={20} color={colors.text.secondary} />
          <Text style={styles.infoText}>
            No fee will be added when this item is issued.
          </Text>
        </View>
      )}

      {isChargeable && (
        <>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Charge Type *</Text>
            <View style={styles.choiceCards}>
              <TouchableOpacity
                style={[
                  styles.choiceCard,
                  chargeType === 'one_time' && styles.choiceCardSelected,
                ]}
                onPress={() => setChargeType('one_time')}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.choiceCardTitle,
                  chargeType === 'one_time' && styles.choiceCardTitleSelected,
                ]}>
                  One-time charge
                </Text>
                <Text style={styles.choiceCardDescription}>
                  Student pays once when item is issued
                </Text>
                {chargeType === 'one_time' && (
                  <MaterialIcons name="check-circle" size={20} color={colors.primary[600]} style={styles.choiceCheckmark} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.choiceCard,
                  chargeType === 'deposit' && styles.choiceCardSelected,
                ]}
                onPress={() => setChargeType('deposit')}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.choiceCardTitle,
                  chargeType === 'deposit' && styles.choiceCardTitleSelected,
                ]}>
                  Refundable deposit
                </Text>
                <Text style={styles.choiceCardDescription}>
                  Student pays deposit, refunded on return
                </Text>
                {chargeType === 'deposit' && (
                  <MaterialIcons name="check-circle" size={20} color={colors.primary[600]} style={styles.choiceCheckmark} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Amount (₹) *</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              value={chargeAmount}
              onChangeText={setChargeAmount}
              keyboardType="decimal-pad"
              placeholderTextColor={colors.text.secondary}
            />
          </View>

          {mustBeReturned && chargeType === 'one_time' && (
            <View style={styles.warningCard}>
              <MaterialIcons name="warning" size={20} color={colors.warning[600]} />
              <Text style={styles.warningText}>
                Warning: One-time charge with returnable items may cause confusion. Consider using a deposit instead.
              </Text>
            </View>
          )}

          {exampleFeeImpact && (
            <View style={styles.exampleCard}>
              <Text style={styles.exampleTitle}>Example Impact</Text>
              <Text style={styles.exampleText}>
                Issuing {currentQuantity || 1} item{currentQuantity !== '1' ? 's' : ''} → ₹{exampleFeeImpact.total.toFixed(2)} added to fees
                {chargeType === 'deposit' && ' (refundable on return)'}
              </Text>
            </View>
          )}

          <View style={styles.toggleGroup}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleContent}>
                <Text style={styles.toggleLabel}>Add to student fees automatically</Text>
                <Text style={styles.toggleDescription}>
                  Charge will appear on student fee invoices
                </Text>
              </View>
              <Switch
                value={autoAddToFees}
                onValueChange={setAutoAddToFees}
                trackColor={{ false: colors.border.DEFAULT, true: colors.primary[600] }}
                thumbColor={colors.surface.primary}
              />
            </View>
          </View>

          {autoAddToFees && (
            <View style={styles.formGroup}>
              <Text style={styles.label}>Fee Category *</Text>
              <View style={[styles.segmentedButtons, { flexDirection: 'row', gap: spacing.sm }]}>
                {(['books', 'uniform', 'misc'] as const).map((val) => (
                  <TouchableOpacity
                    key={val}
                    style={[styles.segmentBtn, feeCategory === val && styles.segmentBtnActive]}
                    onPress={() => setFeeCategory(val)}
                  >
                    <Text style={[styles.segmentBtnText, feeCategory === val && styles.segmentBtnTextActive]}>
                      {val.charAt(0).toUpperCase() + val.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </>
      )}
    </View>
  );

  const renderStep5 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Internal Controls</Text>
      <Text style={styles.stepDescription}>
        Advanced settings for internal tracking and accounting.
      </Text>

      <TouchableOpacity
        style={styles.advancedToggle}
        onPress={() => setShowAdvanced(!showAdvanced)}
        activeOpacity={0.7}
      >
        <Text style={styles.advancedToggleText}>
          {showAdvanced ? 'Hide' : 'Show'} Advanced Settings
        </Text>
        <MaterialIcons 
          name="chevron-right" 
          size={20} 
          color={colors.text.secondary}
          style={[styles.chevron, showAdvanced && styles.chevronRotated]}
        />
      </TouchableOpacity>

      {showAdvanced && (
        <>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Unit Cost (Internal Only)</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              value={unitCost}
              onChangeText={setUnitCost}
              keyboardType="decimal-pad"
              placeholderTextColor={colors.text.secondary}
            />
            <Text style={styles.helperText}>
              Internal cost for accounting purposes (not visible to students)
            </Text>
          </View>

          <View style={styles.toggleGroup}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleContent}>
                <Text style={styles.toggleLabel}>Allow price override at issue</Text>
                <Text style={styles.toggleDescription}>
                  Admins can modify charge amount when issuing
                </Text>
              </View>
              <Switch
                value={allowPriceOverride}
                onValueChange={setAllowPriceOverride}
                trackColor={{ false: colors.border.DEFAULT, true: colors.primary[600] }}
                thumbColor={colors.surface.primary}
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Internal Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Add internal notes (not visible to students)..."
              value={internalNotes}
              onChangeText={setInternalNotes}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              placeholderTextColor={colors.text.secondary}
            />
          </View>
        </>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header with Close Button */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Create Inventory Item</Text>
        <TouchableOpacity 
          onPress={handleCancel} 
          style={styles.closeButton}
          disabled={submitting}
        >
          <MaterialIcons name="close" size={24} color={colors.text.primary} />
        </TouchableOpacity>
      </View>

      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        {[1, 2, 3, 4, 5].map((step) => (
          <View key={step} style={styles.progressStep}>
            <View
              style={[
                styles.progressDot,
                step <= currentStep && styles.progressDotActive,
              ]}
            />
            {step < 5 && (
              <View
                style={[
                  styles.progressLine,
                  step < currentStep && styles.progressLineActive,
                ]}
              />
            )}
          </View>
        ))}
        <Text style={styles.progressText}>Step {currentStep} of 5</Text>
      </View>

      {/* Step Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {renderStepContent()}
      </ScrollView>

      {/* Navigation Buttons */}
      <View style={styles.navigation}>
        {currentStep > 1 && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            disabled={submitting}
          >
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.nextButton, submitting && styles.nextButtonDisabled]}
          onPress={handleNext}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={colors.text.inverse} />
          ) : (
            <Text style={styles.nextButtonText}>
              {currentStep === 5 ? 'Create Item' : 'Continue'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.app,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  closeButton: {
    padding: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface.secondary,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  progressStep: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border.DEFAULT,
  },
  progressDotActive: {
    backgroundColor: colors.primary[600],
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  progressLine: {
    flex: 1,
    height: 2,
    backgroundColor: colors.border.light,
    marginHorizontal: spacing.xs,
  },
  progressLineActive: {
    backgroundColor: colors.primary[600],
  },
  progressText: {
    marginLeft: spacing.md,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  stepDescription: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
  },
  formGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface.primary,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    minHeight: 48,
  },
  textArea: {
    minHeight: 100,
    paddingTop: spacing.md,
  },
  helperText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  toggleGroup: {
    marginBottom: spacing.lg,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  toggleContent: {
    flex: 1,
    marginRight: spacing.md,
  },
  toggleLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs / 2,
  },
  toggleDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  segmentedButtons: {
    marginTop: spacing.sm,
  },
  segmentBtn: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface.secondary,
    borderWidth: 1,
    borderColor: colors.border.primary,
  },
  segmentBtnActive: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },
  segmentBtnText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  segmentBtnTextActive: {
    color: colors.text.inverse,
    fontWeight: '600' as const,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  warningCard: {
    flexDirection: 'row',
    backgroundColor: colors.warning[50],
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  warningText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.warning[700],
  },
  exampleCard: {
    backgroundColor: colors.success[50],
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  exampleTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.success[700],
    marginBottom: spacing.xs,
  },
  exampleText: {
    fontSize: typography.fontSize.sm,
    color: colors.success[700],
  },
  choiceCards: {
    gap: spacing.md,
  },
  choiceCard: {
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.border.light,
    padding: spacing.md,
    position: 'relative',
  },
  choiceCardSelected: {
    borderColor: colors.primary[600],
    backgroundColor: colors.primary[50],
  },
  choiceCardTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  choiceCardTitleSelected: {
    color: colors.primary[600],
  },
  choiceCardDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  choiceCheckmark: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
  },
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  advancedToggleText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  chevron: {
    transform: [{ rotate: '0deg' }],
  },
  chevronRotated: {
    transform: [{ rotate: '90deg' }],
  },
  navigation: {
    flexDirection: 'row',
    padding: spacing.lg,
    backgroundColor: colors.surface.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    gap: spacing.md,
  },
  backButton: {
    flex: 1,
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.button,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  nextButton: {
    flex: 2,
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.button,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonDisabled: {
    opacity: 0.6,
  },
  nextButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.inverse,
  },
});

