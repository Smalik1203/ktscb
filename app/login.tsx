import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, Alert, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { TextInput, Text, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { useAuth } from '../src/contexts/AuthContext';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react-native';
import { typography, spacing, borderRadius, shadows } from '../lib/design-system';
import { isRateLimited, getRemainingAttempts, getResetTime, clearRateLimit } from '../src/utils/rateLimiter';
import { sanitizeEmail } from '../src/utils/sanitize';
import { LinearGradient } from 'expo-linear-gradient';

const { height } = Dimensions.get('window');

export default function LoginScreen() {
  const router = useRouter();
  const auth = useAuth();
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
      // Sign out the user automatically
      auth.signOut().catch((err) => {
        console.error('Failed to sign out after access denied:', err);
      });
      
      Alert.alert(
        'Access Denied',
        auth.accessDeniedReason || 'No profile found in system. Please contact administrator.',
        [{ 
          text: 'OK', 
          onPress: () => {
            // Clear the form after showing the error
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

  // Show loading screen while auth is loading
  if (auth.loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#1E4EB8" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    // Sanitize email input
    const sanitizedEmail = sanitizeEmail(email);
    if (!sanitizedEmail) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }

    // Check rate limiting
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
        // Clear rate limit on successful login
        clearRateLimit(rateLimitKey);
        // Don't set loading to false here - let the auth context handle the flow
        // The auth context will either redirect to main app or show access denied
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'An unexpected error occurred');
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    Alert.alert('Forgot Password', 'Password reset functionality will be implemented soon.');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient
        colors={['#FFFFFF', '#F8FAFE', '#F0F5FF']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView 
            contentContainerStyle={styles.scrollContent} 
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={styles.formContainer}>
              {/* Logo Section */}
              <View style={styles.logoSection}>
                <View style={styles.logoContainer}>
                  <Image
                    source={require('../assets/images/Image.png')}
                    style={styles.logoImage}
                    contentFit="cover"
                    transition={200}
                    cachePolicy="memory-disk"
                    onError={(error) => {
                      console.error('Logo image failed to load:', error);
                    }}
                    onLoad={() => {
                      console.log('Logo image loaded successfully');
                    }}
                  />
                </View>

                <Text style={styles.title}>ClassBridge</Text>
                <View style={styles.taglineContainer}>
                  <Text style={styles.taglineText}>Bridge The Gap</Text>
                  <View style={styles.taglineUnderline} />
                </View>
              </View>

              {/* Form Section */}
              <View style={styles.formSection}>
                <View style={styles.card}>
                  <Text style={styles.welcomeText}>Welcome Back</Text>
                  <Text style={styles.subtitleText}>Sign in to continue to your account</Text>

                  <View style={styles.inputContainer}>
                    <View style={styles.inputWrapper}>
                      <View style={styles.inputIcon}>
                        <Mail size={22} color="#1E4EB8" />
                      </View>
                      <TextInput
                        label="Email Address"
                        value={email}
                        onChangeText={setEmail}
                        mode="outlined"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoComplete="email"
                        disabled={loading}
                        style={styles.input}
                        contentStyle={styles.inputContent}
                        theme={{
                          colors: {
                            primary: '#1E4EB8',
                            background: '#FFFFFF',
                            surface: '#FFFFFF',
                            outline: '#E0E0E0',
                            onSurface: '#1A1A1A',
                            placeholder: '#9E9E9E',
                          },
                        }}
                      />
                    </View>

                    <View style={styles.inputWrapper}>
                      <View style={styles.inputIcon}>
                        <Lock size={22} color="#1E4EB8" />
                      </View>
                      <TextInput
                        label="Password"
                        value={password}
                        onChangeText={setPassword}
                        mode="outlined"
                        secureTextEntry={!showPassword}
                        autoComplete="password"
                        disabled={loading}
                        style={styles.input}
                        contentStyle={styles.inputContent}
                        onSubmitEditing={handleLogin}
                        theme={{
                          colors: {
                            primary: '#1E4EB8',
                            background: '#FFFFFF',
                            surface: '#FFFFFF',
                            outline: '#E0E0E0',
                            onSurface: '#1A1A1A',
                            placeholder: '#9E9E9E',
                          },
                        }}
                      />
                      <TouchableOpacity
                        style={styles.passwordToggle}
                        onPress={() => setShowPassword(!showPassword)}
                        disabled={loading}
                      >
                        {showPassword ? (
                          <EyeOff size={22} color="#666666" />
                        ) : (
                          <Eye size={22} color="#666666" />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={handleLogin}
                    disabled={loading || !email || !password}
                    style={[
                      styles.loginButton,
                      (loading || !email || !password) && styles.loginButtonDisabled
                    ]}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={loading || !email || !password ? ['#CCCCCC', '#AAAAAA'] : ['#1E4EB8', '#4FA3FF']}
                      style={styles.loginButtonGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      {loading ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <Text style={styles.loginButtonText}>Sign In</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleForgotPassword}
                    style={styles.forgotPassword}
                    disabled={loading}
                  >
                    <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  gradient: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: spacing['8'],
    minHeight: height,
  },
  formContainer: {
    paddingHorizontal: spacing['6'],
    alignItems: 'center',
    width: '100%',
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: spacing['8'],
    width: '100%',
  },
  logoContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing['8'],
    ...shadows.xl,
    borderWidth: 0,
  },
  logoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 66,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#1E4EB8',
    marginBottom: spacing['4'],
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  taglineContainer: {
    marginTop: spacing['2'],
    width: '100%',
    alignItems: 'center',
    position: 'relative',
  },
  taglineText: {
    color: '#2A2A2A',
    fontSize: typography.fontSize.xl,
    fontWeight: '600',
    letterSpacing: 0.3,
    textAlign: 'center',
    marginBottom: spacing['2'],
  },
  taglineUnderline: {
    width: 80,
    height: 4,
    borderRadius: borderRadius.full,
    backgroundColor: '#1E4EB8',
    marginTop: spacing['1'],
  },
  formSection: {
    width: '100%',
    maxWidth: 420,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius['2xl'],
    padding: spacing['8'],
    ...shadows.xl,
    borderWidth: 0,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: spacing['2'],
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subtitleText: {
    fontSize: typography.fontSize.base,
    color: '#6b7280',
    marginBottom: spacing['8'],
    textAlign: 'center',
    lineHeight: 22,
  },
  inputContainer: {
    marginBottom: spacing['6'],
  },
  inputWrapper: {
    position: 'relative',
    marginBottom: spacing['5'],
  },
  inputIcon: {
    position: 'absolute',
    left: spacing['4'],
    top: spacing['5'],
    zIndex: 10,
    backgroundColor: '#FFFFFF',
    padding: spacing['1'],
  },
  input: {
    paddingLeft: spacing['12'],
    backgroundColor: '#FFFFFF',
  },
  inputContent: {
    fontSize: typography.fontSize.base,
  },
  passwordToggle: {
    position: 'absolute',
    right: spacing['4'],
    top: spacing['5'],
    zIndex: 10,
    padding: spacing['1'],
    backgroundColor: '#FFFFFF',
  },
  loginButton: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    marginBottom: spacing['4'],
    ...shadows.md,
  },
  loginButtonGradient: {
    paddingVertical: spacing['4'],
    paddingHorizontal: spacing['6'],
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.lg,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  forgotPassword: {
    alignItems: 'center',
    paddingVertical: spacing['2'],
  },
  forgotPasswordText: {
    color: '#1E4EB8',
    fontSize: typography.fontSize.base,
    fontWeight: '600',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing['4'],
    color: '#666666',
    fontSize: typography.fontSize.base,
  },
});
