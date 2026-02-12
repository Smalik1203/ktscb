import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

// Static colors for ErrorBoundary (renders outside ThemeProvider)
const ERROR_COLORS = {
  background: '#F5F7FA',
  textPrimary: '#2A2A2A',
  textSecondary: '#6b7280',
  textTertiary: '#9ca3af',
  error: '#ef4444',
  errorLight: '#fef2f2',
  primary: '#1E4EB8',
  white: '#FFFFFF',
  neutral100: '#F5F7FA',
};

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    this.logErrorToService(error, errorInfo);
  }

  private logErrorToService = (error: Error, errorInfo: ErrorInfo) => {
    // Always log in dev
    if (__DEV__) {
      console.error('Error Boundary caught error:', {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
      });
    }
    
    // Log to Sentry in production (non-blocking)
    if (!__DEV__) {
      try {
        const { captureError } = require('../lib/sentry');
        captureError(error, {
          componentStack: errorInfo.componentStack,
          errorBoundary: true,
        });
      } catch (sentryError) {
        // Sentry logging failed - don't crash the app
        console.error('Failed to log error to Sentry:', sentryError);
      }
    }
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.container}>
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <MaterialIcons name="error" size={80} color={ERROR_COLORS.error} />
            </View>
            
            <Text style={styles.title}>
              Oops! Something went wrong
            </Text>
            
            <Text style={styles.message}>
              The app encountered an unexpected error. Don&apos;t worry, your data is safe.
            </Text>

            {__DEV__ && this.state.error && (
              <View style={styles.errorDetails}>
                <Text style={styles.errorDetailsTitle}>
                  Error Details (Dev Only):
                </Text>
                <Text style={styles.errorDetailsText}>
                  {this.state.error.toString()}
                </Text>
                {this.state.errorInfo && (
                  <Text style={styles.errorStack}>
                    {this.state.errorInfo.componentStack}
                  </Text>
                )}
              </View>
            )}

            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.button}
                onPress={this.handleReset}
                activeOpacity={0.8}
              >
                <Text style={styles.buttonText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

// Static styles - ErrorBoundary renders outside ThemeProvider
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ERROR_COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  content: {
    alignItems: 'center',
    maxWidth: 400,
  },
  iconContainer: {
    marginBottom: 32,
  },
  title: {
    color: ERROR_COLORS.textPrimary,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  message: {
    color: ERROR_COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  errorDetails: {
    width: '100%',
    backgroundColor: ERROR_COLORS.neutral100,
    borderRadius: 16,
    padding: 16,
    marginBottom: 32,
    maxHeight: 200,
  },
  errorDetailsTitle: {
    color: ERROR_COLORS.error,
    fontWeight: '600',
    marginBottom: 8,
  },
  errorDetailsText: {
    color: ERROR_COLORS.error,
    fontSize: 11,
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  errorStack: {
    color: ERROR_COLORS.textTertiary,
    fontSize: 11,
    fontFamily: 'monospace',
  },
  actions: {
    width: '100%',
  },
  button: {
    backgroundColor: ERROR_COLORS.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonText: {
    color: ERROR_COLORS.white,
    fontSize: 17,
    fontWeight: '600',
  },
});

export default ErrorBoundary;
