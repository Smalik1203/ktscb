#!/bin/bash
# Build APK script that handles EAS interactive prompts

echo "Starting EAS build for Android APK..."
echo "When prompted 'Generate a new Android Keystore?', answer: n (no)"
echo ""

# Use expect-like behavior with a timeout
timeout 300 bash -c '
  echo "n" | npx eas-cli build --platform android --profile preview
' || npx eas-cli build --platform android --profile preview

