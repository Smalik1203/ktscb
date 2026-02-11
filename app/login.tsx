/**
 * LoginScreen - Krishnaveni Talent School
 * 
 * Premium login experience with animated entrance, inline validation,
 * keyboard-aware layout, and polished visual design.
 * Brand: "Mentored for Life"
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
  Animated,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { Image } from 'expo-image';
import { ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { useAuth } from '../src/contexts/AuthContext';
import { useTheme } from '../src/contexts/ThemeContext';
import { Eye, EyeOff, User, Mail, Lock, GraduationCap } from 'lucide-react-native';
import { isRateLimited, getRemainingAttempts, getResetTime, clearRateLimit } from '../src/utils/rateLimiter';
import { sanitizeString, sanitizeEmail } from '../src/utils/sanitize';
import { LinearGradient } from 'expo-linear-gradient';
import { log } from '../src/lib/logger';
import {
  Container,
  Stack,
  Heading,
  Body,
  Caption,
  Center,
  Input,
} from '../src/ui';

export default function LoginScreen() {
  const router = useRouter();
  const auth = useAuth();
  const { colors, spacing, borderRadius, shadows, isDark } = useTheme();
  const [loginMode, setLoginMode] = useState<'usercode' | 'email'>('usercode');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [loginError, setLoginError] = useState('');

  // Animation values
  const logoScale = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerTranslateY = useRef(new Animated.Value(20)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(40)).current;
  const footerOpacity = useRef(new Animated.Value(0)).current;

  // Entrance animations (with cleanup on unmount to prevent native-driver crashes)
  useEffect(() => {
    let cancelled = false;
    const sequence = Animated.stagger(150, [
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 6,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(headerOpacity, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.timing(headerTranslateY, {
          toValue: 0,
          duration: 350,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(cardTranslateY, {
          toValue: 0,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(footerOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]);
    if (!cancelled) {
      sequence.start();
    }
    return () => {
      cancelled = true;
      sequence.stop();
    };
  }, [logoScale, logoOpacity, headerOpacity, headerTranslateY, cardOpacity, cardTranslateY, footerOpacity]);

  // Redirect if already signed in
  useEffect(() => {
    if (auth.status === 'signedIn') {
      router.replace('/(tabs)');
    }
  }, [auth.status]);

  // Handle access denied
  useEffect(() => {
    if (auth.status === 'accessDenied') {
      auth.signOut().catch((err) => {
        log.error('Failed to sign out after access denied', err);
      });

      Alert.alert(
        'Access Denied',
        auth.accessDeniedReason || 'No profile found in system. Please contact administrator.',
        [{
          text: 'OK',
          onPress: () => {
            setUsername('');
            setEmail('');
            setPassword('');
            setLoginError('');
          }
        }],
        { cancelable: false }
      );
    }
  }, [auth.status, auth.accessDeniedReason, auth.signOut]);

  // Reset loading state on auth change
  useEffect(() => {
    if (auth.status === 'signedIn' || auth.status === 'accessDenied' || auth.status === 'signedOut') {
      setLoading(false);
    }
  }, [auth.status]);

  // Clear field errors on typing
  const handleUsernameChange = useCallback((text: string) => {
    setUsername(text);
    if (usernameError) setUsernameError('');
    if (loginError) setLoginError('');
  }, [usernameError, loginError]);

  const handleEmailChange = useCallback((text: string) => {
    setEmail(text);
    if (emailError) setEmailError('');
    if (loginError) setLoginError('');
  }, [emailError, loginError]);

  const handlePasswordChange = useCallback((text: string) => {
    setPassword(text);
    if (passwordError) setPasswordError('');
    if (loginError) setLoginError('');
  }, [passwordError, loginError]);

  // Toggle login mode — dismiss keyboard first to avoid iOS simulator crash
  // in UIInlineInputSwitcher when input mode changes during TextInput recycling
  const toggleLoginMode = useCallback(() => {
    Keyboard.dismiss();
    setTimeout(() => {
      setLoginMode((prev) => (prev === 'usercode' ? 'email' : 'usercode'));
      setUsernameError('');
      setEmailError('');
      setPasswordError('');
      setLoginError('');
    }, 100);
  }, []);

  // Gradient colors based on theme
  const gradientColors = isDark
    ? [colors.background.primary, colors.background.secondary, colors.background.tertiary] as const
    : ['#FFFFFF', '#FAF8FC', '#F5F0FA'] as const;

  const buttonGradientColors = isDark
    ? [colors.primary[700], colors.primary.main] as const
    : [colors.primary.main, colors.secondary.main] as const;

  const disabledButtonColors = isDark
    ? [colors.neutral[600], colors.neutral[500]] as const
    : [colors.neutral[300], colors.neutral[400]] as const;

  // Show loading screen while auth is loading
  if (auth.loading) {
    return (
      <Container background="primary" flex>
        <Center style={{ flex: 1 }}>
          <Animated.View style={{ transform: [{ scale: logoScale }], opacity: logoOpacity }}>
            <View style={[styles.loadingLogoContainer, {
              backgroundColor: colors.surface.primary,
              ...(isDark ? { borderWidth: 1, borderColor: colors.border.light } : shadows.lg),
            }]}>
              <Image
                source={require('../assets/images/Image.png')}
                style={styles.loadingLogo}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            </View>
          </Animated.View>
          <ActivityIndicator size="small" color={colors.primary.main} style={{ marginTop: spacing.lg }} />
          <Body color="tertiary" style={{ marginTop: spacing.sm }}>Loading...</Body>
        </Center>
      </Container>
    );
  }

  const handleLogin = async () => {
    Keyboard.dismiss();

    // Inline validation
    let hasError = false;
    let resolvedEmail = '';
    let rateLimitKey = '';

    if (loginMode === 'usercode') {
      const trimmedUsername = sanitizeString(username).trim();
      if (!trimmedUsername) {
        setUsernameError('User code is required');
        hasError = true;
      }
      rateLimitKey = trimmedUsername.toLowerCase();
    } else {
      if (!email.trim()) {
        setEmailError('Email address is required');
        hasError = true;
      } else {
        const sanitized = sanitizeEmail(email);
        if (!sanitized) {
          setEmailError('Please enter a valid email address');
          hasError = true;
        } else {
          resolvedEmail = sanitized;
        }
      }
      rateLimitKey = email.trim().toLowerCase();
    }

    if (!password) {
      setPasswordError('Password is required');
      hasError = true;
    }

    if (hasError) return;

    if (isRateLimited(rateLimitKey, 'login')) {
      const resetTime = getResetTime(rateLimitKey, 'login');
      const minutes = Math.floor(resetTime / 60);
      const seconds = resetTime % 60;
      setLoginError(`Too many attempts. Try again in ${minutes > 0 ? `${minutes}m ` : ''}${seconds}s`);
      return;
    }

    setLoading(true);
    setLoginError('');

    try {
      // If user code mode, resolve to email first
      if (loginMode === 'usercode') {
        const trimmedUsername = sanitizeString(username).trim();
        const { data: emailData, error: lookupError } = await supabase.rpc('get_login_email_by_user_code', {
          p_user_code: trimmedUsername,
        });

        if (lookupError) {
          setLoginError(lookupError.message || 'Unable to verify user code');
          setLoading(false);
          return;
        }

        const foundEmail = emailData ?? null;
        if (!foundEmail || typeof foundEmail !== 'string') {
          setLoginError('Invalid user code. Please check and try again.');
          setLoading(false);
          return;
        }
        resolvedEmail = foundEmail;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: resolvedEmail,
        password,
      });

      if (error) {
        const remaining = getRemainingAttempts(rateLimitKey, 'login');
        const identityLabel = loginMode === 'usercode' ? 'user code' : 'email';
        if (error.message?.includes('Invalid login credentials')) {
          setLoginError(
            remaining > 0
              ? `Incorrect ${identityLabel} or password. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`
              : `Incorrect ${identityLabel} or password.`
          );
        } else {
          setLoginError(error.message);
        }
        setLoading(false);
        return;
      }

      if (data.user) {
        clearRateLimit(rateLimitKey);
      }
    } catch (error: any) {
      setLoginError(error.message || 'An unexpected error occurred');
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    router.push('/forgot-password');
  };

  const isFormValid = loginMode === 'usercode'
    ? username.trim().length > 0 && password.length > 0
    : email.trim().length > 0 && password.length > 0;
  const isButtonDisabled = loading || !isFormValid;

  // Card style
  const cardStyle = {
    backgroundColor: colors.surface.elevated,
    borderRadius: borderRadius['2xl'],
    padding: spacing['2xl'],
    ...(isDark ? { borderWidth: 1, borderColor: colors.border.light } : shadows.xl),
  };

  return (
    <>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }} edges={['top', 'bottom']}>
        <LinearGradient
          colors={gradientColors}
          style={{ flex: 1 }}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        >
          {/* Decorative background circles */}
          <View style={styles.decorContainer} pointerEvents="none">
            <View style={[styles.decorCircle, styles.decorCircle1, {
              backgroundColor: colors.primary[100],
              opacity: isDark ? 0.05 : 0.3,
            }]} />
            <View style={[styles.decorCircle, styles.decorCircle2, {
              backgroundColor: colors.secondary[100],
              opacity: isDark ? 0.04 : 0.25,
            }]} />
            <View style={[styles.decorCircle, styles.decorCircle3, {
              backgroundColor: colors.primary[200],
              opacity: isDark ? 0.03 : 0.15,
            }]} />
          </View>

          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={{ flex: 1 }}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
              <Container
                scroll
                showScrollIndicator={false}
                padding="lg"
                background="transparent"
                keyboardShouldPersistTaps="handled"
                style={{ flexGrow: 1 }}
              >
                <View style={styles.contentWrapper}>
                  {/* Logo Section */}
                  <Animated.View style={[
                    styles.logoSection,
                    {
                      opacity: logoOpacity,
                      transform: [{ scale: logoScale }],
                    },
                  ]}>
                    <View style={[styles.logoContainer, {
                      backgroundColor: colors.surface.primary,
                      ...(isDark
                        ? { borderWidth: 1, borderColor: colors.border.light }
                        : {
                            ...shadows.xl,
                            shadowColor: colors.primary.main,
                            shadowOpacity: 0.15,
                          }),
                    }]}>
                      <Image
                        source={require('../assets/images/Image.png')}
                        style={styles.logoImage}
                        contentFit="cover"
                        transition={200}
                        cachePolicy="memory-disk"
                        onError={(error) => {
                          log.error('Logo image failed to load', error);
                        }}
                      />
                    </View>
                    {/* Subtle ring decoration around logo */}
                    <View style={[styles.logoRing, {
                      borderColor: isDark ? colors.primary[800] : colors.primary[100],
                    }]} />
                  </Animated.View>

                  {/* School Name & Tagline */}
                  <Animated.View style={[
                    styles.headerSection,
                    {
                      opacity: headerOpacity,
                      transform: [{ translateY: headerTranslateY }],
                    },
                  ]}>
                    <Heading
                      level={1}
                      color="accent"
                      style={{ textAlign: 'center', letterSpacing: -0.5 }}
                    >
                      Krishnaveni Talent School
                    </Heading>

                    <View style={styles.taglineRow}>
                      <View style={[styles.taglineLine, { backgroundColor: colors.secondary[300] }]} />
                      <Heading
                        level={4}
                        align="center"
                        style={{ color: colors.secondary.main, paddingHorizontal: spacing.md }}
                      >
                        Mentored for Life
                      </Heading>
                      <View style={[styles.taglineLine, { backgroundColor: colors.secondary[300] }]} />
                    </View>
                  </Animated.View>

                  {/* Form Card */}
                  <Animated.View style={[
                    styles.cardWrapper,
                    {
                      opacity: cardOpacity,
                      transform: [{ translateY: cardTranslateY }],
                    },
                  ]}>
                    <View style={cardStyle}>
                      <Stack spacing="sm">
                        <View style={styles.cardHeader}>
                          <GraduationCap size={22} color={colors.primary.main} />
                          <Heading level={3} style={{ marginLeft: spacing.sm }}>
                            Welcome Back
                          </Heading>
                        </View>
                        <Body color="tertiary" style={{ marginBottom: spacing.md }}>
                          Sign in to your school account
                        </Body>

                        {/* Login mode toggle */}
                        <View style={[styles.modeToggleContainer, {
                          backgroundColor: isDark ? colors.surface.secondary : colors.neutral[100],
                          borderRadius: borderRadius.lg,
                        }]}>
                          <TouchableOpacity
                            style={[
                              styles.modeToggleButton,
                              {
                                borderRadius: borderRadius.md,
                              },
                              loginMode === 'usercode' && {
                                backgroundColor: colors.surface.elevated,
                                ...(isDark ? { borderWidth: 1, borderColor: colors.border.light } : shadows.sm),
                              },
                            ]}
                            onPress={() => loginMode !== 'usercode' && toggleLoginMode()}
                            disabled={loading}
                            activeOpacity={0.7}
                          >
                            <User size={14} color={loginMode === 'usercode' ? colors.primary.main : colors.text.tertiary} />
                            <Body
                              weight={loginMode === 'usercode' ? 'semibold' : 'regular'}
                              style={{
                                color: loginMode === 'usercode' ? colors.primary.main : colors.text.tertiary,
                                fontSize: 13,
                                marginLeft: 6,
                              }}
                            >
                              User Code
                            </Body>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.modeToggleButton,
                              {
                                borderRadius: borderRadius.md,
                              },
                              loginMode === 'email' && {
                                backgroundColor: colors.surface.elevated,
                                ...(isDark ? { borderWidth: 1, borderColor: colors.border.light } : shadows.sm),
                              },
                            ]}
                            onPress={() => loginMode !== 'email' && toggleLoginMode()}
                            disabled={loading}
                            activeOpacity={0.7}
                          >
                            <Mail size={14} color={loginMode === 'email' ? colors.primary.main : colors.text.tertiary} />
                            <Body
                              weight={loginMode === 'email' ? 'semibold' : 'regular'}
                              style={{
                                color: loginMode === 'email' ? colors.primary.main : colors.text.tertiary,
                                fontSize: 13,
                                marginLeft: 6,
                              }}
                            >
                              Email
                            </Body>
                          </TouchableOpacity>
                        </View>

                        {/* Login Error Banner */}
                        {loginError ? (
                          <View style={[styles.errorBanner, {
                            backgroundColor: isDark ? (colors.error?.[900] ?? colors.error?.main) + '40' : (colors.error?.[50] ?? colors.surface?.primary),
                            borderColor: colors.error?.[200] ?? colors.border?.DEFAULT,
                          }]}>
                            <Body
                              style={{ color: colors.error?.main ?? colors.text?.primary, fontSize: 13, lineHeight: 18 }}
                            >
                              {loginError}
                            </Body>
                          </View>
                        ) : null}

                        {/* Username / Email Input — single component, dynamic props */}
                        <Input
                          key={loginMode}
                          label={loginMode === 'usercode' ? 'User Code' : 'Email Address'}
                          placeholder={loginMode === 'usercode' ? 'Enter your user code' : 'you@school.com'}
                          value={loginMode === 'usercode' ? username : email}
                          onChangeText={loginMode === 'usercode' ? handleUsernameChange : handleEmailChange}
                          keyboardType={loginMode === 'email' ? 'email-address' : 'default'}
                          autoCapitalize="none"
                          autoCorrect={false}
                          disabled={loading}
                          error={loginMode === 'usercode' ? usernameError : emailError}
                          leftIcon={loginMode === 'usercode'
                            ? <User size={20} color={colors.primary.main} />
                            : <Mail size={20} color={colors.primary.main} />
                          }
                          returnKeyType="next"
                        />

                        {/* Password Input */}
                        <Input
                          label="Password"
                          placeholder="Enter your password"
                          value={password}
                          onChangeText={handlePasswordChange}
                          secureTextEntry={!showPassword}
                          autoComplete="password"
                          disabled={loading}
                          error={passwordError}
                          leftIcon={<Lock size={20} color={colors.primary.main} />}
                          rightIcon={
                            showPassword
                              ? <EyeOff size={20} color={colors.text.tertiary} />
                              : <Eye size={20} color={colors.text.tertiary} />
                          }
                          onRightIconPress={() => setShowPassword(!showPassword)}
                          returnKeyType="go"
                          onSubmitEditing={handleLogin}
                        />

                        {/* Forgot Password - above button for better UX */}
                        <TouchableOpacity
                          onPress={handleForgotPassword}
                          style={[styles.forgotButton, { marginBottom: spacing.sm }]}
                          disabled={loading}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Body
                            weight="semibold"
                            style={{ color: colors.primary.main, fontSize: 13 }}
                          >
                            Forgot Password?
                          </Body>
                        </TouchableOpacity>

                        {/* Login Button */}
                        <TouchableOpacity
                          onPress={handleLogin}
                          disabled={isButtonDisabled}
                          style={[styles.loginButton, {
                            borderRadius: borderRadius.xl,
                            opacity: isButtonDisabled ? 0.5 : 1,
                            ...shadows.md,
                          }]}
                          activeOpacity={0.85}
                        >
                          <LinearGradient
                            colors={isButtonDisabled ? disabledButtonColors : buttonGradientColors}
                            style={styles.loginButtonInner}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                          >
                            {loading ? (
                              <View style={styles.loadingRow}>
                                <ActivityIndicator color={colors.text.inverse} size="small" />
                                <Body color="inverse" weight="semibold" style={{ marginLeft: spacing.sm }}>
                                  Signing in...
                                </Body>
                              </View>
                            ) : (
                              <Heading level={5} color="inverse" style={{ letterSpacing: 0.5 }}>
                                Sign In
                              </Heading>
                            )}
                          </LinearGradient>
                        </TouchableOpacity>
                      </Stack>
                    </View>
                  </Animated.View>

                  {/* Footer */}
                  <Animated.View style={[styles.footer, { opacity: footerOpacity }]}>
                    <Caption color="tertiary" align="center">
                      Krishnaveni Talent School, Boduppal
                    </Caption>
                  </Animated.View>
                </View>
              </Container>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </LinearGradient>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  contentWrapper: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 24,
    minHeight: '100%',
  },
  // Decorative background
  decorContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  decorCircle: {
    position: 'absolute',
    borderRadius: 999,
  },
  decorCircle1: {
    width: 300,
    height: 300,
    top: -80,
    right: -60,
  },
  decorCircle2: {
    width: 200,
    height: 200,
    bottom: 60,
    left: -60,
  },
  decorCircle3: {
    width: 150,
    height: 150,
    top: '45%',
    right: -40,
  },
  // Logo
  logoSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logoContainer: {
    width: 110,
    height: 110,
    borderRadius: 55,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  logoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 52,
  },
  logoRing: {
    position: 'absolute',
    width: 134,
    height: 134,
    borderRadius: 67,
    borderWidth: 2,
    top: -12,
    zIndex: 1,
  },
  loadingLogoContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingLogo: {
    width: '100%',
    height: '100%',
    borderRadius: 42,
  },
  // Header
  headerSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  taglineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  taglineLine: {
    height: 1.5,
    width: 32,
    borderRadius: 1,
  },
  // Card
  cardWrapper: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modeToggleContainer: {
    flexDirection: 'row',
    padding: 4,
    marginBottom: 4,
  },
  modeToggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  errorBanner: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 4,
  },
  forgotButton: {
    alignSelf: 'flex-end',
  },
  // Button
  loginButton: {
    overflow: 'hidden',
  },
  loginButtonInner: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Footer
  footer: {
    marginTop: 32,
    alignItems: 'center',
    paddingBottom: 16,
  },
});
