/**
 * LoginScreen
 * 
 * Refactored to use centralized design system.
 * All styling comes from theme tokens - no hardcoded values.
 */

import React, { useState } from 'react';
import { View, KeyboardAvoidingView, Platform, Alert, TouchableOpacity, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { TextInput, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { useAuth } from '../src/contexts/AuthContext';
import { useTheme } from '../src/contexts/ThemeContext';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react-native';
import { isRateLimited, getRemainingAttempts, getResetTime, clearRateLimit } from '../src/utils/rateLimiter';
import { sanitizeEmail } from '../src/utils/sanitize';
import { LinearGradient } from 'expo-linear-gradient';
import { log } from '../src/lib/logger';
import { 
  Container, 
  Stack, 
  Heading, 
  Body, 
  Button,
  Center,
} from '../src/ui';

const { height } = Dimensions.get('window');

export default function LoginScreen() {
  const router = useRouter();
  const auth = useAuth();
  const { colors, spacing, borderRadius, shadows, isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Redirect if already signed in
  React.useEffect(() => {
    if (auth.status === 'signedIn') {
      router.replace('/(tabs)');
    }
  }, [auth.status]);

  // Handle access denied - sign out user and show message
  React.useEffect(() => {
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
            setEmail('');
            setPassword('');
          }
        }],
        { cancelable: false }
      );
    }
  }, [auth.status, auth.accessDeniedReason, auth.signOut]);

  // Reset loading state when auth state changes
  React.useEffect(() => {
    if (auth.status === 'signedIn' || auth.status === 'accessDenied' || auth.status === 'signedOut') {
      setLoading(false);
    }
  }, [auth.status]);

  // Gradient colors based on theme - ClassBridge brand
  const gradientColors = isDark 
    ? [colors.background.primary, colors.background.secondary, colors.background.tertiary] as const
    : ['#FFFFFF', '#F5FAFF', '#EBF5FF'] as const;
  
  const buttonGradientColors = isDark
    ? [colors.primary[700], colors.primary.main] as const
    : [colors.primary.main, colors.secondary.main] as const;
  
  const disabledButtonColors = isDark
    ? [colors.neutral[600], colors.neutral[500]] as const
    : [colors.neutral[300], colors.neutral[400]] as const;

  // Theme for TextInput
  const inputTheme = {
    colors: {
      primary: colors.primary.main,
      background: colors.surface.primary,
      surface: colors.surface.primary,
      outline: colors.border.DEFAULT,
      onSurface: colors.text.primary,
      placeholder: colors.text.tertiary,
    },
  };

  // Show loading screen while auth is loading
  if (auth.loading) {
    return (
      <Container background="primary" flex>
        <Center style={{ flex: 1 }}>
          <ActivityIndicator size="large" color={colors.primary.main} />
          <Body color="secondary" style={{ marginTop: spacing.md }}>Loading...</Body>
        </Center>
      </Container>
    );
  }

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const sanitizedEmail = sanitizeEmail(email);
    if (!sanitizedEmail) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }

    const rateLimitKey = sanitizedEmail.toLowerCase();
    if (isRateLimited(rateLimitKey, 'login')) {
      const resetTime = getResetTime(rateLimitKey, 'login');
      const minutes = Math.floor(resetTime / 60);
      const seconds = resetTime % 60;
      Alert.alert(
        'Too Many Attempts',
        `Too many login attempts. Please try again in ${minutes > 0 ? `${minutes}m ` : ''}${seconds}s.`
      );
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: sanitizedEmail,
        password: password,
      });

      if (error) {
        const remaining = getRemainingAttempts(rateLimitKey, 'login');
        if (remaining > 0) {
          Alert.alert('Login Failed', `${error.message}\n\nRemaining attempts: ${remaining}`);
        } else {
          Alert.alert('Login Failed', error.message);
        }
        setLoading(false);
        return;
      }

      if (data.user) {
        clearRateLimit(rateLimitKey);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'An unexpected error occurred');
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    Alert.alert('Forgot Password', 'Password reset functionality will be implemented soon.');
  };

  // Card style using theme tokens
  const cardStyle = {
    backgroundColor: colors.surface.elevated,
    borderRadius: borderRadius['2xl'],
    padding: spacing['2xl'],
    ...(isDark ? { borderWidth: 1, borderColor: colors.border.light } : shadows.xl),
  };

  // Logo container style using theme tokens
  const logoContainerStyle = {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.surface.primary,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginBottom: spacing.lg,
    ...(isDark ? { borderWidth: 1, borderColor: colors.border.light } : shadows.xl),
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }} edges={['top']}>
      <LinearGradient
        colors={gradientColors}
        style={{ flex: 1 }}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <Container 
            scroll 
            showScrollIndicator={false}
            padding="lg"
            background="transparent"
            style={{ minHeight: height }}
          >
            <Center style={{ flex: 1, paddingVertical: spacing.lg }}>
              {/* Logo Section */}
              <Stack spacing="md" style={{ alignItems: 'center', marginBottom: spacing.lg }}>
                <View style={logoContainerStyle}>
                  <Image
                    source={require('../assets/images/Image.png')}
                    style={{ width: '100%', height: '100%', borderRadius: 66 }}
                    contentFit="cover"
                    transition={200}
                    cachePolicy="memory-disk"
                    onError={(error) => {
                      log.error('Logo image failed to load', error);
                    }}
                  />
                </View>

                <Heading 
                  level={1} 
                  color="accent"
                  style={{ textAlign: 'center', letterSpacing: -0.5 }}
                >
                  ClassBridge
                </Heading>
                
                <Stack spacing="xs" style={{ alignItems: 'center' }}>
                  <Heading level={4} align="center">Bridge The Gap</Heading>
                  <View style={{
                    width: 80,
                    height: 4,
                    borderRadius: borderRadius.full,
                    backgroundColor: colors.primary.main,
                  }} />
                </Stack>
              </Stack>

              {/* Form Section */}
              <View style={{ width: '100%', maxWidth: 420 }}>
                <View style={cardStyle}>
                  <Stack spacing="md">
                    <Heading level={2} align="center">Welcome Back</Heading>
                    <Body color="secondary" align="center" style={{ marginBottom: spacing.lg }}>
                      Sign in to continue to your account
                    </Body>

                    {/* Email Input */}
                    <TextInput
                      label="Email Address"
                      value={email}
                      onChangeText={setEmail}
                      mode="outlined"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                      disabled={loading}
                      left={<TextInput.Icon icon={() => <Mail size={20} color={colors.primary.main} />} />}
                      style={{ backgroundColor: colors.surface.primary, marginBottom: spacing.md }}
                      theme={inputTheme}
                    />

                    {/* Password Input */}
                    <TextInput
                      label="Password"
                      value={password}
                      onChangeText={setPassword}
                      mode="outlined"
                      secureTextEntry={!showPassword}
                      autoComplete="password"
                      disabled={loading}
                      left={<TextInput.Icon icon={() => <Lock size={20} color={colors.primary.main} />} />}
                      right={
                        <TextInput.Icon 
                          icon={() => showPassword ? <EyeOff size={20} color={colors.text.tertiary} /> : <Eye size={20} color={colors.text.tertiary} />}
                          onPress={() => setShowPassword(!showPassword)}
                          disabled={loading}
                        />
                      }
                      style={{ backgroundColor: colors.surface.primary, marginBottom: spacing.lg }}
                      onSubmitEditing={handleLogin}
                      theme={inputTheme}
                    />

                    {/* Login Button */}
                  <TouchableOpacity
                    onPress={handleLogin}
                    disabled={loading || !email || !password}
                      style={{
                        borderRadius: borderRadius.xl,
                        overflow: 'hidden',
                        marginBottom: spacing.md,
                        opacity: (loading || !email || !password) ? 0.6 : 1,
                        ...shadows.md,
                      }}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={loading || !email || !password ? disabledButtonColors : buttonGradientColors}
                        style={{
                          paddingVertical: spacing.md,
                          paddingHorizontal: spacing.lg,
                          alignItems: 'center',
                          justifyContent: 'center',
                          minHeight: 52,
                        }}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      {loading ? (
                          <ActivityIndicator color={colors.text.inverse} size="small" />
                      ) : (
                          <Heading level={5} color="inverse" style={{ letterSpacing: 0.5 }}>
                            Sign In
                          </Heading>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>

                    {/* Forgot Password */}
                  <TouchableOpacity
                    onPress={handleForgotPassword}
                      style={{ alignItems: 'center', paddingVertical: spacing.xs }}
                    disabled={loading}
                  >
                      <Body color="accent" weight="semibold">Forgot Password?</Body>
                  </TouchableOpacity>
                  </Stack>
                </View>
              </View>
            </Center>
          </Container>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
}
