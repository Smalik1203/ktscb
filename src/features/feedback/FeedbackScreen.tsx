import React from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useCapabilities } from '../../hooks/useCapabilities';
import { StudentFeedbackForm } from './components/StudentFeedbackForm';
import { AdminFeedbackList } from './components/AdminFeedbackList';
import { SuperAdminFeedbackDashboard } from './components/SuperAdminFeedbackDashboard';

/**
 * FeedbackScreen - Role-based routing to appropriate feedback view
 * 
 * - Students → Share Feedback form
 * - Admins/Teachers → Feedback Received list
 * - Super Admins → Staff Feedback dashboard
 */
export default function FeedbackScreen() {
    const { colors, spacing } = useTheme();
    const { profile, loading: authLoading } = useAuth();
    const { can, isLoading: capabilitiesLoading } = useCapabilities();

    // Show loading while auth/capabilities load
    if (authLoading || capabilitiesLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface.primary }}>
                <ActivityIndicator size="large" color={colors.primary[600]} />
                <Text style={{ marginTop: spacing.md, color: colors.text.secondary }}>Loading...</Text>
            </View>
        );
    }

    // Guard: no profile
    if (!profile) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface.primary }}>
                <Text style={{ color: colors.text.secondary }}>Please log in to access feedback.</Text>
            </View>
        );
    }

    // Determine which view to show based on capabilities
    const canViewAll = can('feedback.view_all');
    const canSubmit = can('feedback.submit');
    const canReadOwn = can('feedback.read_own');

    // Super Admin: Full dashboard
    if (canViewAll) {
        return <SuperAdminFeedbackDashboard />;
    }

    // Admin/Teacher: Received feedback list
    if (canReadOwn && !canSubmit) {
        return <AdminFeedbackList />;
    }

    // Student: Submit feedback form
    if (canSubmit) {
        return <StudentFeedbackForm />;
    }

    // Fallback: No access
    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface.primary }}>
            <Text style={{ color: colors.text.secondary }}>You don't have access to the feedback module.</Text>
        </View>
    );
}
