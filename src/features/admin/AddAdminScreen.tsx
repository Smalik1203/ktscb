import React, { useMemo, useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import type { ThemeColors } from '../../theme/types';
import { View, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Text, Modal, Portal } from 'react-native-paper';
import { Trash2, Edit, X } from 'lucide-react-native';
import { spacing, borderRadius, typography, shadows } from '../../../lib/design-system';
import { Button, Input, EmptyState, Badge, SearchBar, SegmentedControl } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { useCapabilities } from '../../hooks/useCapabilities';
import { AccessDenied } from '../../components/common/AccessDenied';
import { sanitizeEmail, sanitizePhone, sanitizeCode, sanitizeName, validatePassword } from '../../utils/sanitize';
import { useAdmins, useCreateAdmin, useUpdateAdmin, useDeleteAdmin } from '../../hooks/useAdmins';
import { ThreeStateView } from '../../components/common/ThreeStateView';
import { Pagination } from '../../components/common/Pagination';

export default function AddAdminScreen() {
  const { profile } = useAuth();
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const styles = useMemo(
    () => createStyles(colors, typography, spacing, borderRadius, shadows),
    [colors, typography, spacing, borderRadius, shadows]
  );
  
  const schoolCode = profile?.school_code;

  // Search query (server-side)
  const [adminSearch, setAdminSearch] = useState('');

  // Queries
  const [adminPage, setAdminPage] = useState(1);
  const adminPageSize = 25;
  const { data: adminsResponse, isLoading, error, refetch } = useAdmins(schoolCode, {
    page: adminPage,
    pageSize: adminPageSize,
    search: adminSearch,
  });
  const [mode, setMode] = useState<'create' | 'list'>('create');

  // Extract data from pagination response
  const admins = adminsResponse?.data || [];
  const totalAdmins = adminsResponse?.total || 0;
  const totalPages = Math.ceil(totalAdmins / adminPageSize);

  // Reset to page 1 when search changes
  useEffect(() => {
    setAdminPage(1);
  }, [adminSearch]);

  // Search handled in SQL (no client-side filtering)
  const createMutation = useCreateAdmin(schoolCode);
  const updateMutation = useUpdateAdmin(schoolCode);
  const deleteMutation = useDeleteAdmin(schoolCode);

  // Form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [adminCode, setAdminCode] = useState('A');

  // Edit modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<any>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAdminCode, setEditAdminCode] = useState('');

  // Capability-based check (NO role checks in UI)
  const { can, isLoading: capabilitiesLoading } = useCapabilities();
  const canManageAdmins = can('admins.manage');

  if (!canManageAdmins && !capabilitiesLoading) {
    return (
      <AccessDenied
        capability="admins.manage"
        title="Access Denied"
        message="Only Super Admins can manage administrators"
      />
    );
  }

  if (!schoolCode) {
    return (
      <View style={styles.container}>
        <EmptyState
          title="No School Code"
          message="School code not found in your profile"
        />
      </View>
    );
  }

  const handleCreate = async () => {
    // Validation
    if (!fullName.trim() || !email.trim() || !password.trim() || !phone.trim() || !adminCode.trim()) {
      Alert.alert('Validation Error', 'Please fill in all fields');
      return;
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      const missing: string[] = [];
      if (!passwordValidation.requirements.minLength) missing.push('at least 8 characters');
      if (!passwordValidation.requirements.hasLetter) missing.push('at least one letter');
      if (!passwordValidation.requirements.hasNumber) missing.push('at least one number');
      Alert.alert('Validation Error', `Password must contain: ${missing.join(', ')}`);
      return;
    }

    // Sanitize inputs
    const sanitizedData = {
      full_name: sanitizeName(fullName),
      email: sanitizeEmail(email),
      phone: sanitizePhone(phone),
      admin_code: sanitizeCode(adminCode),
    };

    // Validate sanitized data
    if (!sanitizedData.full_name || !sanitizedData.email || !sanitizedData.phone || !sanitizedData.admin_code) {
      Alert.alert('Validation Error', 'Please check all fields for invalid characters');
      return;
    }

    try {
      const payload = {
        full_name: sanitizedData.full_name,
        email: sanitizedData.email,
        password,
        phone: sanitizedData.phone,
        admin_code: sanitizedData.admin_code,
      };

      await createMutation.mutateAsync(payload);
      Alert.alert('Success', 'Admin created successfully!');
      
      // Reset form
      setFullName('');
      setEmail('');
      setPassword('');
      setPhone('');
      setAdminCode('A');
    } catch (error: any) {
      
      Alert.alert('Error', error.message || 'Failed to create admin');
    }
  };

  const handleEdit = (admin: any) => {
    setEditingAdmin(admin);
    setEditFullName(admin.full_name);
    setEditPhone(admin.phone);
    setEditAdminCode(admin.admin_code);
    setEditModalVisible(true);
  };

  const handleUpdate = async () => {
    if (!editingAdmin || !editFullName.trim() || !editPhone.trim() || !editAdminCode.trim()) {
      Alert.alert('Validation Error', 'Please fill in all fields');
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id: editingAdmin.id,
        full_name: sanitizeName(editFullName),
        phone: sanitizePhone(editPhone),
        admin_code: sanitizeCode(editAdminCode),
      });

      Alert.alert('Success', 'Admin updated successfully');
      setEditModalVisible(false);
      setEditingAdmin(null);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update admin');
    }
  };

  const handleDelete = (admin: any) => {
    Alert.alert(
      'Delete Admin',
      `Are you sure you want to delete ${admin.full_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMutation.mutateAsync(admin.id);
              Alert.alert('Success', 'Admin deleted successfully');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete admin');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Segment */}
        <SegmentedControl
          value={mode}
          onChange={(value) => setMode(value as 'create' | 'list')}
          options={[
            { label: 'Create', value: 'create' },
            { label: 'Existing', value: 'list' },
          ]}
          containerStyle={styles.segment}
        />

        {/* Create Admin Form */}
        {mode === 'create' && (
        <View style={styles.section}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Add Admin</Text>
          </View>

          <View style={styles.form}>
            <Input
              label="Full Name"
              value={fullName}
              onChangeText={setFullName}
              placeholder="Enter full name"
              autoCapitalize="words"
            />

            <Input
              label="Email Address"
              value={email}
              onChangeText={setEmail}
              placeholder="Enter email address"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Enter password (min 8 characters)"
              secureTextEntry
            />

            <View style={styles.formRow}>
              <View style={styles.formCol}>
                <Input
                  label="Phone Number"
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Enter phone number"
                  keyboardType="phone-pad"
                />
              </View>
              <View style={styles.formCol}>
                <Input
                  label="Admin Code"
                  value={adminCode}
                  onChangeText={setAdminCode}
                  placeholder="Enter admin code"
                  autoCapitalize="characters"
                />
              </View>
            </View>

            {/* Moved primary action to sticky footer */}
          </View>
        </View>
        )}

        {/* Admins List */}
        {mode === 'list' && (
        <View style={styles.section}>
          <View style={styles.listHeaderRow}>
            <Text style={styles.listTitle}>Admins</Text>
            <Badge variant="primary">{totalAdmins}</Badge>
          </View>

          {/* Search */}
          <SearchBar
            value={adminSearch}
            onChangeText={setAdminSearch}
            placeholder="Search admins by name, email, phone, code"
          />

          <ThreeStateView
            state={isLoading ? 'loading' : error ? 'error' : admins.length === 0 ? 'empty' : 'success'}
            loadingMessage="Loading admins..."
            errorMessage="Failed to load admins"
            errorDetails={(error as any)?.message}
            emptyMessage={adminSearch ? 'No matching admins' : 'No administrators have been created yet'}
            onRetry={() => refetch()}
          >
            <View style={styles.adminList}>
              {admins.map((admin) => (
                <View key={admin.id} style={styles.adminCard}>
                  <View style={styles.adminInfo}>
                    <Text style={styles.adminName}>{admin.full_name}</Text>
                    <Text style={styles.adminDetail}>{admin.email}  ·  {admin.phone}</Text>
                    <View style={styles.adminMetaRow}>
                      <View style={styles.adminCodeBadge}>
                        <Text style={styles.adminCodeText}>Code: {admin.admin_code}</Text>
                      </View>
                      <View style={styles.adminCodeBadge}>
                        <Text style={styles.adminCodeText}>Role: Admin</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.adminActions}>
                    <TouchableOpacity onPress={() => handleEdit(admin)} style={styles.actionButton}>
                      <Edit size={18} color={colors.info[600]} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(admin)} style={styles.actionButton}>
                      <Trash2 size={18} color={colors.error[600]} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </ThreeStateView>
          
          {!adminSearch && totalPages > 0 && (
            <Pagination
              currentPage={adminPage}
              totalPages={totalPages}
              totalItems={totalAdmins}
              itemsPerPage={adminPageSize}
              onPageChange={setAdminPage}
            />
          )}
        </View>
        )}
      </ScrollView>

      {/* Sticky Create Bar */}
      {mode === 'create' && (
      <View style={styles.footerBar}>
        <Button 
          title={createMutation.isPending ? 'Creating...' : 'Create Admin'} 
          onPress={handleCreate} 
          loading={createMutation.isPending} 
          disabled={createMutation.isPending} 
        />
      </View>
      )}

      {/* Edit Modal */}
      <Portal>
        <Modal
          visible={editModalVisible}
          onDismiss={() => setEditModalVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Admin</Text>
            <TouchableOpacity onPress={() => setEditModalVisible(false)}>
              <X size={24} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <Input
              label="Full Name"
              value={editFullName}
              onChangeText={setEditFullName}
              placeholder="Enter full name"
              autoCapitalize="words"
            />

            <Input
              label="Phone Number"
              value={editPhone}
              onChangeText={setEditPhone}
              placeholder="Enter phone number"
              keyboardType="phone-pad"
            />

            <Input
              label="Admin Code"
              value={editAdminCode}
              onChangeText={setEditAdminCode}
              placeholder="Enter admin code"
              autoCapitalize="characters"
            />

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                onPress={() => setEditModalVisible(false)}
                variant="outline"
                style={styles.modalButton}
              />
              <Button
                title="Update"
                onPress={handleUpdate}
                loading={updateMutation.isPending}
                disabled={updateMutation.isPending}
                style={styles.modalButton}
              />
            </View>
          </View>
        </Modal>
      </Portal>
    </View>
  );
}

const createStyles = (colors: ThemeColors, typography: any, spacing: any, borderRadius: any, shadows: any) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.sm,
    paddingBottom: spacing.xl * 2 + 64,
  },
  formRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  formCol: {
    flex: 1,
  },
  section: {
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    flex: 1,
  },
  form: {
    gap: spacing.sm,
  },
  submitButton: {
    marginTop: spacing.md,
  },
  footerBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface.primary,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    ...shadows.md,
  },
  segment: {
    marginBottom: spacing.lg,
  },
  adminList: {
    gap: 0,
  },
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
  },
  adminCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  adminInfo: {
    flex: 1,
  },
  adminName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  adminDetail: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: spacing.xs / 2,
  },
  adminCodeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.info[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.sm,
    marginTop: spacing.xs,
  },
  adminCodeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium as any,
    color: colors.info[700],
  },
  adminMetaRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: 2,
  },
  adminActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: 'transparent',
  },
  modal: {
    backgroundColor: colors.surface.primary,
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold as any,
    color: colors.text.primary,
  },
  modalContent: {
    gap: spacing.sm,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  modalButton: {
    flex: 1,
  },
});

