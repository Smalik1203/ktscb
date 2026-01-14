#!/bin/bash
# Setup EAS Secrets for ClassBridge Production Build
# Run this script to set up all required environment variables as EAS secrets

echo "🔐 Setting up EAS Secrets for ClassBridge"
echo ""

# Check if EAS CLI is available
if ! command -v eas &> /dev/null && ! command -v npx &> /dev/null; then
    echo "❌ Error: EAS CLI not found. Please install it first:"
    echo "   npm install -g eas-cli"
    exit 1
fi

echo "📋 This script will set up the following secrets:"
echo "   1. EXPO_PUBLIC_SUPABASE_URL"
echo "   2. EXPO_PUBLIC_SUPABASE_ANON_KEY"
echo ""
echo "📝 Note: OpenAI API key is now stored in Supabase secrets (server-side)"
echo "   To set it up, run: supabase secrets set OPENAI_API_KEY=sk-..."
echo ""

# Check if user is logged in
echo "Checking EAS login status..."
if ! eas whoami &> /dev/null; then
    echo "⚠️  Not logged in to EAS. Please login first:"
    echo "   eas login"
    exit 1
fi

echo "✅ Logged in to EAS"
echo ""

# Get values from user or environment
read -p "Enter Supabase URL (or press Enter to use default): " SUPABASE_URL
SUPABASE_URL=${SUPABASE_URL:-"https://mvvzqouqxrtyzuzqbeud.supabase.co"}

read -p "Enter Supabase Anon Key: " SUPABASE_ANON_KEY
if [ -z "$SUPABASE_ANON_KEY" ]; then
    echo "❌ Error: Supabase Anon Key is required"
    exit 1
fi

echo ""
echo "🚀 Creating EAS secrets..."

# Create Supabase URL secret
echo "Creating EXPO_PUBLIC_SUPABASE_URL..."
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "$SUPABASE_URL" --force 2>&1 | grep -v "password" || echo "✅ EXPO_PUBLIC_SUPABASE_URL set"

# Create Supabase Anon Key secret
echo "Creating EXPO_PUBLIC_SUPABASE_ANON_KEY..."
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "$SUPABASE_ANON_KEY" --force 2>&1 | grep -v "password" || echo "✅ EXPO_PUBLIC_SUPABASE_ANON_KEY set"

echo ""
echo "✅ EAS secrets setup complete!"
echo ""
echo "📋 Verify secrets:"
echo "   eas secret:list"
echo ""
echo "🔑 Don't forget to set the OpenAI key in Supabase:"
echo "   supabase secrets set OPENAI_API_KEY=sk-your-key-here"
echo ""
echo "🚀 You can now build:"
echo "   npm run build:android:apk"

