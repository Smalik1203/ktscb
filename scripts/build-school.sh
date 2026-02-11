#!/bin/bash

# White-Label Build Script
# Usage: ./scripts/build-school.sh <school_code> <profile>
# Example: ./scripts/build-school.sh kts preview
#          ./scripts/build-school.sh kts production

set -e

SCHOOL_CODE=$1
PROFILE=${2:-preview}

if [ -z "$SCHOOL_CODE" ]; then
    echo "❌ Error: School code is required"
    echo ""
    echo "Usage: ./scripts/build-school.sh <school_code> <profile>"
    echo ""
    echo "Available schools:"
    ls -d schools/*/ 2>/dev/null | xargs -n1 basename | grep -v _template || echo "  No schools configured yet"
    echo ""
    echo "Profiles: development, preview, production"
    exit 1
fi

SCHOOL_CODE_LOWER=$(echo "$SCHOOL_CODE" | tr '[:upper:]' '[:lower:]')
CONFIG_FILE="schools/${SCHOOL_CODE_LOWER}/config.json"

if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ Error: School config not found: $CONFIG_FILE"
    echo ""
    echo "To add a new school:"
    echo "  1. Copy schools/_template to schools/${SCHOOL_CODE_LOWER}"
    echo "  2. Update config.json with school details"
    echo "  3. Add school assets (icon, splash, etc.)"
    echo "  4. Add google-services.json for Firebase"
    exit 1
fi

# Read school name from config
SCHOOL_NAME=$(cat "$CONFIG_FILE" | grep '"appName"' | sed 's/.*: *"\(.*\)".*/\1/')

echo "🏫 Building for: $SCHOOL_NAME"
echo "📦 Profile: $PROFILE"
echo "🔧 School code: $SCHOOL_CODE"
echo ""

# Export school for app.config.js
export SCHOOL=$SCHOOL_CODE_LOWER

# Check if school-specific EAS profile exists
if grep -q "\"${SCHOOL_CODE_LOWER}:${PROFILE}\"" eas.json; then
    PROFILE_NAME="${SCHOOL_CODE_LOWER}:${PROFILE}"
    echo "✅ Using school-specific profile: $PROFILE_NAME"
else
    echo "⚠️  No school-specific profile found, using base profile: $PROFILE"
    PROFILE_NAME=$PROFILE
fi

echo ""
echo "🚀 Starting EAS build..."
echo "   Command: SCHOOL=$SCHOOL_CODE_LOWER eas build --profile $PROFILE_NAME --platform android"
echo ""

# Run the build
SCHOOL=$SCHOOL_CODE_LOWER eas build --profile "$PROFILE_NAME" --platform android

echo ""
echo "✅ Build submitted for $SCHOOL_NAME"
