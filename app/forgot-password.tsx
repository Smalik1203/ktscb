import React, { useState } from 'react';
import { View, KeyboardAvoidingView, Platform, Alert, TouchableOpacity, Dimensions } from 'react-native';
import { TextInput, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { useTheme } from '../src/contexts/ThemeContext';
import { Mail, ArrowLeft } from 'lucide-react-native';
import { isRateLimited, getResetTime } from '../src/utils/rateLimiter';
import { sanitizeEmail } from '../src/utils/sanitize';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  Container, 
  Stack, 
  Heading, 
  Body, 
  Center,
} from '../src/ui';

const { height } = Dimensions.get('window');

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { colors, spacing, borderRadius, shadows, isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const gradientColors = isDark 
    ? [colors.background.primary, colors.background.secondary, colors.background.tertiary] as const
    : ['#FFFFFF', '#FAF8FC', '#F5F0FA'] as const;
  
  const buttonGradientColors = isDark
    ? [colors.primary[700], colors.primary.main] as const
    : [colors.primary.main, colors.secondary.main] as const;
  
  const disabledButtonColors = isDark
    ? [colors.neutral[600], colors.neutral[500]] as const
    : [colors.neutral[300], colors.neutral[400]] as const;

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

  const handleResetPassword = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    const sanitizedEmail = sanitizeEmail(email);
    if (!sanitizedEmail) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }

    const rateLimitKey = sanitizedEmail.toLowerCase();
    if (isRateLimited(rateLimitKey, 'passwordReset')) {
      const resetTime = getResetTime(rateLimitKey, 'passwordReset');
      const minutes = Math.floor(resetTime / 60);
      const seconds = resetTime % 60;
      Alert.alert(
        'Too Many Attempts',
        `Too many password reset attempts. Please try again in ${minutes > 0 ? `${minutes}m ` : ''}${seconds}s.`
      );
      return;
    }

    setLoading(true);
    try {
      // Use web URL - web app will verify token and redirect to mobile with session tokens
      // Format: https://app.classbridge.in/reset-password
      // Web app should redirect to: kts://reset-password?access_token=xxx&refresh_token=yyy
      const redirectTo = 'https://app.classbridge.in/reset-password';
      const { error } = await supabase.auth.resetPasswordForEmail(sanitizedEmail, {
        redirectTo,
      });

      if (error) {
        let errorMessage = error.message || 'Failed to send password reset email.';
        let errorTitle = 'Error';
        
        if (error.status === 500 || error.status === '500') {
          errorTitle = 'Service Unavailable';
          errorMessage = 'Password reset service is currently unavailable. Please contact support.';
        } else if (error.message?.includes('recovery email') || error.message?.includes('sending') || error.message?.includes('email')) {
          errorTitle = 'Email Sending Failed';
          errorMessage = 'Unable to send password reset email. Please try again later or contact support.';
        }
        
        Alert.alert(errorTitle, errorMessage, [{ text: 'OK' }]);
        setLoading(false);
        return;
      }

      Alert.alert(
        'Check Your Email',
        'If an account with this email exists, we\'ve sent a password reset link to your email address. Please check your inbox and click the link to reset your password.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'An unexpected error occurred');
      setLoading(false);
    }
  };

  const cardStyle = {
    backgroundColor: colors.surface.elevated,
    borderRadius: borderRadius['2xl'],
    padding: spacing['2xl'],
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
              <TouchableOpacity
                onPress={() => router.back()}
                style={{
                  position: 'absolute',
                  top: spacing.lg,
                  left: spacing.lg,
                  zIndex: 10,
                  padding: spacing.sm,
                }}
              >
                <ArrowLeft size={24} color={colors.text.primary} />
              </TouchableOpacity>

              <View style={{ width: '100%', maxWidth: 420 }}>
                <View style={cardStyle}>
                  <Stack spacing="md">
                    <Heading level={2} align="center">Reset Password</Heading>
                    <Body color="secondary" align="center" style={{ marginBottom: spacing.lg }}>
                      Enter your email address and we'll send you a link to reset your password.
                    </Body>

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
                      style={{ backgroundColor: colors.surface.primary, marginBottom: spacing.lg }}
                      theme={inputTheme}
                      onSubmitEditing={handleResetPassword}
                    />

                    <TouchableOpacity
                      onPress={handleResetPassword}
                      disabled={loading || !email}
                      style={{
                        borderRadius: borderRadius.xl,
                        overflow: 'hidden',
                        marginBottom: spacing.md,
                        opacity: (loading || !email) ? 0.6 : 1,
                        ...shadows.md,
                      }}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={loading || !email ? disabledButtonColors : buttonGradientColors}
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
                            Send Reset Link
                          </Heading>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => router.back()}
                      style={{ alignItems: 'center', paddingVertical: spacing.xs }}
                      disabled={loading}
                    >
                      <Body color="accent" weight="semibold">Back to Login</Body>
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

