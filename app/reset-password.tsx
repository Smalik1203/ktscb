import React, { useEffect, useState } from 'react';
import {
  View,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { TextInput, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { useTheme } from '../src/contexts/ThemeContext';
import { Lock, Eye, EyeOff, CheckCircle } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Container,
  Stack,
  Heading,
  Body,
  Center,
} from '../src/ui';

const { height } = Dimensions.get('window');

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { colors, spacing, borderRadius, shadows, isDark } = useTheme();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  /* ------------------------------------------------------------------
     IMPORTANT:
     - Mobile app NEVER handles recovery tokens
     - Supabase recovery token is already consumed on the web
     - We only check if a valid session exists
  ------------------------------------------------------------------ */

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();

      if (!data?.session) {
        setSessionError(
          'This reset link has expired. Please request a new password reset.'
        );
      }

      setCheckingSession(false);
    };

    checkSession();
  }, []);

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(pwd)) return 'Password must include an uppercase letter';
    if (!/[a-z]/.test(pwd)) return 'Password must include a lowercase letter';
    if (!/[0-9]/.test(pwd)) return 'Password must include a number';
    return null;
  };

  const handleResetPassword = async () => {
    if (!password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    const validationError = validatePassword(password);
    if (validationError) {
      Alert.alert('Invalid Password', validationError);
      return;
    }

    setLoading(true);

    const { data } = await supabase.auth.getSession();
    if (!data?.session) {
      Alert.alert(
        'Session Expired',
        'Please request a new password reset.',
        [{ text: 'OK', onPress: () => router.replace('/forgot-password') }]
      );
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      Alert.alert(
        'Error',
        'Unable to reset password. Please request a new reset link.',
        [{ text: 'OK', onPress: () => router.replace('/forgot-password') }]
      );
      setLoading(false);
      return;
    }

    await supabase.auth.signOut();
    setSuccess(true);

    setTimeout(() => {
      router.replace('/login');
    }, 1200);
  };

  /* -------------------- UI STATES -------------------- */

  if (checkingSession) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
        <Center style={{ flex: 1 }}>
          <ActivityIndicator size="large" color={colors.primary.main} />
        </Center>
      </SafeAreaView>
    );
  }

  if (sessionError) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
        <Center style={{ flex: 1, padding: spacing.lg }}>
          <Stack spacing="md" style={{ alignItems: 'center' }}>
            <Heading level={2}>Reset Link Expired</Heading>
            <Body align="center" color="secondary">{sessionError}</Body>

            <TouchableOpacity
              onPress={() => router.replace('/forgot-password')}
              style={{ marginTop: spacing.md }}
            >
              <Heading level={5} color="accent">Request New Reset</Heading>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.replace('/login')}
              style={{ marginTop: spacing.sm }}
            >
              <Body color="secondary">Back to Login</Body>
            </TouchableOpacity>
          </Stack>
        </Center>
      </SafeAreaView>
    );
  }

  if (success) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
        <Center style={{ flex: 1 }}>
          <CheckCircle size={64} color={colors.success?.main || colors.primary.main} />
          <Heading level={2} style={{ marginTop: spacing.md }}>
            Password Reset Successful
          </Heading>
        </Center>
      </SafeAreaView>
    );
  }

  /* -------------------- MAIN FORM -------------------- */

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <Container padding="lg">
          <Center style={{ flex: 1 }}>
            <View style={{ width: '100%', maxWidth: 420 }}>
              <Stack spacing="md">
                <Heading level={2} align="center">Set New Password</Heading>

                <TextInput
                  label="New Password"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  left={<TextInput.Icon icon={() => <Lock size={20} />} />}
                  right={
                    <TextInput.Icon
                      icon={() => showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      onPress={() => setShowPassword(!showPassword)}
                    />
                  }
                />

                <TextInput
                  label="Confirm Password"
                  secureTextEntry={!showConfirmPassword}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  left={<TextInput.Icon icon={() => <Lock size={20} />} />}
                  right={
                    <TextInput.Icon
                      icon={() => showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    />
                  }
                />

                <TouchableOpacity
                  onPress={handleResetPassword}
                  disabled={loading}
                >
                  <Heading level={5} align="center">
                    {loading ? 'Resetting...' : 'Reset Password'}
                  </Heading>
                </TouchableOpacity>
              </Stack>
            </View>
          </Center>
        </Container>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
