#!/bin/bash

# Build APK using EAS
# This script will build an APK for the KTS Mobile app

echo "🚀 Starting APK build for Krishnaveni Talent School..."
echo "📱 Project: kts-mobile"
echo ""

# Check if EAS CLI is installed
if ! command -v eas &> /dev/null; then
    echo "Installing EAS CLI..."
    npm install -g eas-cli
fi

# Check if logged in
echo "Checking EAS login status..."
eas whoami || {
    echo "❌ Not logged in to EAS. Please run: eas login"
    exit 1
}

# Start the build
echo ""
echo "🏗️  Starting build process..."
echo "This will create an APK file that you can download from Expo dashboard"
echo ""

eas build --platform android --profile preview

echo ""
echo "✅ Build started! Check your build status at:"
echo "https://expo.dev/accounts/krishnaveni-talent-school/projects/kts-mobile/builds"
echo ""
echo "Once the build completes, you can download the APK from the Expo dashboard."

