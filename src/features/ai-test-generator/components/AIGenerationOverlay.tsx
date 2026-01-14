/**
 * AIGenerationOverlay Component
 * 
 * Full-screen overlay shown during AI question generation.
 * Premium pulsing animation with sparkles and streaming text.
 */

import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Modal, Animated, Easing, ScrollView } from 'react-native';
import { useTheme } from '../../../contexts/ThemeContext';
import { Sparkles, Brain } from 'lucide-react-native';
import { Heading, Body, Caption } from '../../../ui';
import { LinearGradient } from 'expo-linear-gradient';

export interface AIGenerationOverlayProps {
    visible: boolean;
    streamingText: string;
    progress?: number;
}

export function AIGenerationOverlay({
    visible,
    streamingText,
    progress = 0,
}: AIGenerationOverlayProps) {
    const { colors, isDark } = useTheme();

    // All animations use native driver for consistency
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const rotateAnim = useRef(new Animated.Value(0)).current;
    const opacityAnim = useRef(new Animated.Value(0.5)).current;
    const particle1Anim = useRef(new Animated.Value(0)).current;
    const particle2Anim = useRef(new Animated.Value(0)).current;
    const particle3Anim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (!visible) return;

        // Pulse animation
        const pulseAnimation = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.15,
                    duration: 800,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 800,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
            ])
        );

        // Rotate animation
        const rotateAnimation = Animated.loop(
            Animated.timing(rotateAnim, {
                toValue: 1,
                duration: 8000,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        );

        // Opacity pulse animation
        const opacityAnimation = Animated.loop(
            Animated.sequence([
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 1500,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 0.5,
                    duration: 1500,
                    useNativeDriver: true,
                }),
            ])
        );

        // Particle animations
        const animateParticle = (anim: Animated.Value, delay: number) => {
            return Animated.loop(
                Animated.sequence([
                    Animated.delay(delay),
                    Animated.timing(anim, {
                        toValue: 1,
                        duration: 2000,
                        easing: Easing.out(Easing.ease),
                        useNativeDriver: true,
                    }),
                    Animated.timing(anim, {
                        toValue: 0,
                        duration: 0,
                        useNativeDriver: true,
                    }),
                ])
            );
        };

        const p1 = animateParticle(particle1Anim, 0);
        const p2 = animateParticle(particle2Anim, 600);
        const p3 = animateParticle(particle3Anim, 1200);

        pulseAnimation.start();
        rotateAnimation.start();
        opacityAnimation.start();
        p1.start();
        p2.start();
        p3.start();

        return () => {
            pulseAnimation.stop();
            rotateAnimation.stop();
            opacityAnimation.stop();
            p1.stop();
            p2.stop();
            p3.stop();
        };
    }, [visible, pulseAnim, rotateAnim, opacityAnim, particle1Anim, particle2Anim, particle3Anim]);

    const rotation = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    const particleOpacity = (anim: Animated.Value) =>
        anim.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [0, 1, 0],
        });

    const particleTranslateY = (anim: Animated.Value) =>
        anim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -80],
        });

    if (!visible) return null;

    return (
        <Modal visible={visible} transparent animationType="fade">
            <View style={styles.overlay}>
                <LinearGradient
                    colors={[
                        isDark ? 'rgba(15, 15, 30, 0.98)' : 'rgba(88, 28, 135, 0.95)',
                        isDark ? 'rgba(30, 15, 50, 0.98)' : 'rgba(139, 92, 246, 0.95)',
                    ]}
                    style={StyleSheet.absoluteFill}
                />

                <View style={styles.content}>
                    {/* Animated Brain Icon */}
                    <View style={styles.iconArea}>
                        {/* Rotating ring */}
                        <Animated.View
                            style={[
                                styles.rotatingRing,
                                { transform: [{ rotate: rotation }] },
                            ]}
                        >
                            <View style={[styles.ringDot, { backgroundColor: colors.primary[300] }]} />
                            <View style={[styles.ringDot, styles.ringDot2, { backgroundColor: colors.secondary[300] }]} />
                            <View style={[styles.ringDot, styles.ringDot3, { backgroundColor: colors.primary[400] }]} />
                        </Animated.View>

                        {/* Pulsing brain */}
                        <Animated.View
                            style={[
                                styles.brainContainer,
                                {
                                    transform: [{ scale: pulseAnim }],
                                    opacity: opacityAnim,
                                },
                            ]}
                        >
                            <LinearGradient
                                colors={[colors.primary[500], colors.secondary[500]]}
                                style={styles.brainGradient}
                            >
                                <Brain size={48} color="#fff" />
                            </LinearGradient>
                        </Animated.View>

                        {/* Floating particles */}
                        {[particle1Anim, particle2Anim, particle3Anim].map((anim, i) => (
                            <Animated.View
                                key={i}
                                style={[
                                    styles.particle,
                                    {
                                        left: 50 + i * 30,
                                        opacity: particleOpacity(anim),
                                        transform: [{ translateY: particleTranslateY(anim) }],
                                    },
                                ]}
                            >
                                <Sparkles size={16} color={colors.primary[300]} />
                            </Animated.View>
                        ))}
                    </View>

                    {/* Text */}
                    <Heading level={3} style={{ color: '#fff', marginTop: 32 }}>
                        Sage is Generating
                    </Heading>
                    <Body style={{ color: 'rgba(255,255,255,0.8)', marginTop: 8 }}>
                        Analyzing your content with AI...
                    </Body>

                    {/* Streaming text */}
                    {streamingText ? (
                        <View style={styles.streamingContainer}>
                            <ScrollView
                                style={styles.streamingScroll}
                                showsVerticalScrollIndicator={false}
                            >
                                <Caption style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 20 }}>
                                    {streamingText}
                                </Caption>
                            </ScrollView>
                        </View>
                    ) : null}

                    {/* Loading dots */}
                    <View style={styles.dotsContainer}>
                        {[0, 1, 2].map((i) => (
                            <Animated.View
                                key={i}
                                style={[
                                    styles.loadingDot,
                                    {
                                        backgroundColor: colors.primary[300],
                                        opacity: opacityAnim,
                                    },
                                ]}
                            />
                        ))}
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    iconArea: {
        width: 160,
        height: 160,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rotatingRing: {
        position: 'absolute',
        width: 160,
        height: 160,
        borderRadius: 80,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.1)',
        borderStyle: 'dashed',
    },
    ringDot: {
        position: 'absolute',
        width: 10,
        height: 10,
        borderRadius: 5,
        top: -5,
        left: 75,
    },
    ringDot2: {
        top: 75,
        left: 155,
    },
    ringDot3: {
        top: 155,
        left: 75,
    },
    brainContainer: {
        elevation: 20,
    },
    brainGradient: {
        width: 100,
        height: 100,
        borderRadius: 50,
        alignItems: 'center',
        justifyContent: 'center',
    },
    particle: {
        position: 'absolute',
        bottom: 50,
    },
    streamingContainer: {
        marginTop: 24,
        maxHeight: 120,
        width: '100%',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: 16,
    },
    streamingScroll: {
        maxHeight: 88,
    },
    dotsContainer: {
        flexDirection: 'row',
        marginTop: 32,
        gap: 8,
    },
    loadingDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
});

export default AIGenerationOverlay;
