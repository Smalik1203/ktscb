import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bot, MessageCircle, Sparkles } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { spacing, borderRadius, typography } from '../../../lib/design-system';
import { LinearGradient } from 'expo-linear-gradient';

export function ChatbotScreen() {
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();

    return (
        <View style={[styles.container, { backgroundColor: colors.background.primary }]}>
            <ScrollView
                contentContainerStyle={[
                    styles.content,
                    { paddingBottom: insets.bottom + 100 }
                ]}
                showsVerticalScrollIndicator={false}
            >
                {/* Hero Section */}
                <View style={styles.heroSection}>
                    <LinearGradient
                        colors={isDark
                            ? [colors.primary[700], colors.primary[500]]
                            : [colors.primary[500], colors.primary[400]]
                        }
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.iconContainer}
                    >
                        <Bot size={48} color="#FFFFFF" />
                    </LinearGradient>

                    <Text style={[styles.title, { color: colors.text.primary }]}>
                        Sage AI Assistant
                    </Text>

                    <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
                        Your personal learning companion
                    </Text>
                </View>

                {/* Feature Cards */}
                <View style={styles.featuresSection}>
                    <FeatureCard
                        icon={MessageCircle}
                        title="Ask Questions"
                        description="Get instant answers about your subjects, homework, and more"
                        colors={colors}
                        isDark={isDark}
                    />

                    <FeatureCard
                        icon={Sparkles}
                        title="Study Help"
                        description="Get explanations, summaries, and study tips tailored to your curriculum"
                        colors={colors}
                        isDark={isDark}
                    />
                </View>

                {/* Coming Soon Badge */}
                <View style={[styles.comingSoonBadge, { backgroundColor: colors.primary[50] }]}>
                    <Sparkles size={16} color={colors.primary[600]} />
                    <Text style={[styles.comingSoonText, { color: colors.primary[600] }]}>
                        Coming Soon
                    </Text>
                </View>

                <Text style={[styles.comingSoonDescription, { color: colors.text.tertiary }]}>
                    We're working on bringing you an intelligent AI assistant to help with your studies. Stay tuned!
                </Text>
            </ScrollView>
        </View>
    );
}

interface FeatureCardProps {
    icon: any;
    title: string;
    description: string;
    colors: any;
    isDark: boolean;
}

function FeatureCard({ icon: Icon, title, description, colors, isDark }: FeatureCardProps) {
    return (
        <View style={[
            styles.featureCard,
            {
                backgroundColor: colors.surface.elevated,
                borderColor: colors.border.light,
            }
        ]}>
            <View style={[styles.featureIconContainer, { backgroundColor: colors.primary[50] }]}>
                <Icon size={24} color={colors.primary[600]} />
            </View>
            <View style={styles.featureContent}>
                <Text style={[styles.featureTitle, { color: colors.text.primary }]}>
                    {title}
                </Text>
                <Text style={[styles.featureDescription, { color: colors.text.secondary }]}>
                    {description}
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        padding: spacing.lg,
        alignItems: 'center',
    },
    heroSection: {
        alignItems: 'center',
        marginTop: spacing.xl,
        marginBottom: spacing.xl,
    },
    iconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    title: {
        fontSize: typography.fontSize['2xl'],
        fontWeight: typography.fontWeight.bold as any,
        marginBottom: spacing.xs,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: typography.fontSize.base,
        textAlign: 'center',
    },
    featuresSection: {
        width: '100%',
        gap: spacing.md,
        marginBottom: spacing.xl,
    },
    featureCard: {
        flexDirection: 'row',
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        alignItems: 'center',
    },
    featureIconContainer: {
        width: 48,
        height: 48,
        borderRadius: borderRadius.md,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    featureContent: {
        flex: 1,
    },
    featureTitle: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold as any,
        marginBottom: spacing.xs,
    },
    featureDescription: {
        fontSize: typography.fontSize.sm,
        lineHeight: 20,
    },
    comingSoonBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.full,
        gap: spacing.xs,
        marginBottom: spacing.md,
    },
    comingSoonText: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold as any,
    },
    comingSoonDescription: {
        fontSize: typography.fontSize.sm,
        textAlign: 'center',
        paddingHorizontal: spacing.lg,
    },
});

export default ChatbotScreen;
