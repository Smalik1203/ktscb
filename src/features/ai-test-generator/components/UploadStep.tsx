/**
 * UploadStep Component
 * 
 * Step 1 of the AI Test Generator wizard.
 * Premium upload area with animations and drag-drop feel.
 */

import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Animated, Easing } from 'react-native';
import { useTheme } from '../../../contexts/ThemeContext';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Heading, Body, Caption, Button } from '../../../ui';
import { LinearGradient } from 'expo-linear-gradient';

export interface UploadStepProps {
    selectedImage: string | null;
    onPickImage: () => void;
    onRemoveImage: () => void;
    onContinue: () => void;
}

export function UploadStep({
    selectedImage,
    onPickImage,
    onRemoveImage,
    onContinue,
}: UploadStepProps) {
    const { colors, spacing, borderRadius, shadows, isDark } = useTheme();

    // Floating animation for upload icon
    const floatAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const glowAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Floating animation
        Animated.loop(
            Animated.sequence([
                Animated.timing(floatAnim, {
                    toValue: -10,
                    duration: 1500,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(floatAnim, {
                    toValue: 0,
                    duration: 1500,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
            ])
        ).start();

        // Pulse animation
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.05,
                    duration: 1200,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1200,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, [floatAnim, pulseAnim]);

    // Glow animation when image is selected
    useEffect(() => {
        if (selectedImage) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(glowAnim, {
                        toValue: 1,
                        duration: 1500,
                        useNativeDriver: false,
                    }),
                    Animated.timing(glowAnim, {
                        toValue: 0.5,
                        duration: 1500,
                        useNativeDriver: false,
                    }),
                ])
            ).start();
        }
    }, [selectedImage, glowAnim]);

    const glowColor = glowAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [colors.primary[300], colors.primary[500]],
    });

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.iconContainer}>
                    <MaterialIcons name="auto-awesome" size={24} color={colors.primary[600]} />
                </View>
                <Heading level={3} align="center">Upload for Sage</Heading>
                <Body color="secondary" align="center" style={{ marginTop: spacing.xs }}>
                    Upload textbook pages, notes, or any study material
                </Body>
            </View>

            {/* Upload Area */}
            {selectedImage ? (
                <Animated.View
                    style={[
                        styles.imageContainer,
                        {
                            borderRadius: borderRadius.xl,
                            borderColor: glowColor,
                            borderWidth: 3,
                            ...shadows.lg,
                        },
                    ]}
                >
                    <Image source={{ uri: selectedImage }} style={styles.imagePreview} />

                    {/* Remove button */}
                    <TouchableOpacity
                        style={[styles.removeButton, { backgroundColor: colors.error[500] }]}
                        onPress={onRemoveImage}
                    >
                        <MaterialIcons name="close" size={20} color={colors.text.inverse} />
                    </TouchableOpacity>

                    {/* Success badge */}
                    <View style={[styles.successBadge, { backgroundColor: colors.success[500] }]}>
                        <MaterialIcons name="image" size={14} color={colors.text.inverse} />
                        <Caption style={{ color: colors.text.inverse, marginLeft: 4 }}>
                            Ready to analyze
                        </Caption>
                    </View>
                </Animated.View>
            ) : (
                <TouchableOpacity onPress={onPickImage} activeOpacity={0.8}>
                    <Animated.View
                        style={[
                            styles.uploadArea,
                            {
                                backgroundColor: isDark ? colors.surface.secondary : colors.primary[50],
                                borderColor: colors.primary[300],
                                borderRadius: borderRadius.xl,
                                transform: [{ scale: pulseAnim }],
                            },
                        ]}
                    >
                        {/* Gradient overlay */}
                        <LinearGradient
                            colors={[
                                isDark ? 'rgba(139, 92, 246, 0.1)' : 'rgba(139, 92, 246, 0.05)',
                                isDark ? 'rgba(139, 92, 246, 0.2)' : 'rgba(139, 92, 246, 0.1)',
                            ]}
                            style={StyleSheet.absoluteFill}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        />

                        {/* Floating icon */}
                        <Animated.View
                            style={[
                                styles.uploadIconWrapper,
                                {
                                    backgroundColor: colors.surface.primary,
                                    transform: [{ translateY: floatAnim }],
                                    ...shadows.lg,
                                },
                            ]}
                        >
                            <MaterialIcons name="upload" size={32} color={colors.primary[600]} />
                        </Animated.View>

                        <Heading level={5} style={{ marginTop: spacing.lg, color: colors.primary[700] }}>
                            Tap to Upload
                        </Heading>
                        <Body color="tertiary" style={{ marginTop: spacing.xs }}>
                            PNG, JPG, or PDF up to 10MB
                        </Body>

                        {/* Decorative dots */}
                        <View style={styles.dotsContainer}>
                            {[...Array(3)].map((_, i) => (
                                <View
                                    key={i}
                                    style={[
                                        styles.dot,
                                        { backgroundColor: colors.primary[200 + i * 100] },
                                    ]}
                                />
                            ))}
                        </View>
                    </Animated.View>
                </TouchableOpacity>
            )}

            {/* Continue Button */}
            {selectedImage && (
                <Animated.View style={{ marginTop: spacing.xl }}>
                    <TouchableOpacity onPress={onContinue} activeOpacity={0.8}>
                        <LinearGradient
                            colors={[colors.primary[600], colors.primary[700]]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={[styles.continueButton, { borderRadius: borderRadius.xl }]}
                        >
                            <Body weight="semibold" style={{ color: colors.text.inverse }}>
                                Continue
                            </Body>
                            <View style={styles.arrowIcon}>
                                <MaterialIcons name="auto-awesome" size={18} color={colors.text.inverse} />
                            </View>
                        </LinearGradient>
                    </TouchableOpacity>
                </Animated.View>
            )}

            {/* Tip */}
            <View style={[styles.tipContainer, { backgroundColor: colors.info[50], borderRadius: borderRadius.lg }]}>
                <Caption color="secondary" align="center">
                    💡 Tip: Clear, high-quality images generate better questions
                </Caption>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 24,
    },
    header: {
        alignItems: 'center',
        marginBottom: 32,
    },
    iconContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    uploadArea: {
        padding: 40,
        alignItems: 'center',
        borderWidth: 2,
        borderStyle: 'dashed',
        minHeight: 280,
        justifyContent: 'center',
        overflow: 'hidden',
    },
    uploadIconWrapper: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dotsContainer: {
        flexDirection: 'row',
        marginTop: 24,
        gap: 8,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    imageContainer: {
        position: 'relative',
        overflow: 'hidden',
    },
    imagePreview: {
        width: '100%',
        height: 280,
        backgroundColor: '#f0f0f0',
    },
    removeButton: {
        position: 'absolute',
        top: 12,
        right: 12,
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    successBadge: {
        position: 'absolute',
        bottom: 12,
        left: 12,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
    },
    continueButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        gap: 8,
    },
    arrowIcon: {
        marginLeft: 4,
    },
    tipContainer: {
        marginTop: 24,
        padding: 12,
    },
});

export default UploadStep;
