#!/bin/bash

# Add New School Script
# Usage: ./scripts/add-school.sh <school_code>
# Example: ./scripts/add-school.sh greenwood

set -e

SCHOOL_CODE=$1

if [ -z "$SCHOOL_CODE" ]; then
    echo "❌ Error: School code is required"
    echo ""
    echo "Usage: ./scripts/add-school.sh <school_code>"
    echo "Example: ./scripts/add-school.sh greenwood"
    exit 1
fi

SCHOOL_CODE_LOWER=$(echo "$SCHOOL_CODE" | tr '[:upper:]' '[:lower:]')
SCHOOL_DIR="schools/${SCHOOL_CODE_LOWER}"

if [ -d "$SCHOOL_DIR" ]; then
    echo "❌ Error: School already exists: $SCHOOL_DIR"
    exit 1
fi

echo "🏫 Adding new school: $SCHOOL_CODE_LOWER"
echo ""

# Create school directory
mkdir -p "$SCHOOL_DIR/assets"

# Copy template config
cp "schools/_template/config.json" "$SCHOOL_DIR/config.json"

# Replace placeholders
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s/SCHOOL_CODE/${SCHOOL_CODE^^}/g" "$SCHOOL_DIR/config.json"
    sed -i '' "s/schoolname/${SCHOOL_CODE_LOWER}/g" "$SCHOOL_DIR/config.json"
else
    # Linux
    sed -i "s/SCHOOL_CODE/${SCHOOL_CODE^^}/g" "$SCHOOL_DIR/config.json"
    sed -i "s/schoolname/${SCHOOL_CODE_LOWER}/g" "$SCHOOL_DIR/config.json"
fi

# Add EAS profiles for the school
echo ""
echo "📝 Adding EAS build profiles..."

# Check if school profiles already exist
if ! grep -q "\"${SCHOOL_CODE_LOWER}:preview\"" eas.json; then
    # Add school-specific profiles to eas.json
    # This is a simple approach - for complex cases, use jq
    echo ""
    echo "⚠️  Please manually add these profiles to eas.json:"
    echo ""
    echo "    \"${SCHOOL_CODE_LOWER}:preview\": {"
    echo "      \"extends\": \"preview\","
    echo "      \"env\": {"
    echo "        \"SCHOOL\": \"${SCHOOL_CODE_LOWER}\","
    echo "        \"EXPO_PUBLIC_NEW_ARCH_ENABLED\": \"1\""
    echo "      }"
    echo "    },"
    echo "    \"${SCHOOL_CODE_LOWER}:production\": {"
    echo "      \"extends\": \"production\","
    echo "      \"env\": {"
    echo "        \"SCHOOL\": \"${SCHOOL_CODE_LOWER}\","
    echo "        \"EXPO_PUBLIC_NEW_ARCH_ENABLED\": \"1\""
    echo "      }"
    echo "    }"
fi

echo ""
echo "✅ School directory created: $SCHOOL_DIR"
echo ""
echo "📋 Next steps:"
echo "   1. Edit $SCHOOL_DIR/config.json with school details:"
echo "      - appName: School display name"
echo "      - bundleId: com.schoolname (unique per school)"
echo "      - branding: colors, tagline"
echo "      - easProjectId: Create new EAS project for this school"
echo ""
echo "   2. Add school assets:"
echo "      - $SCHOOL_DIR/assets/icon.png (1024x1024)"
echo "      - $SCHOOL_DIR/assets/adaptive-icon.png (1024x1024)"
echo "      - $SCHOOL_DIR/assets/splash.png"
echo "      - $SCHOOL_DIR/assets/notification-icon.png (96x96, white)"
echo ""
echo "   3. Add Firebase config:"
echo "      - $SCHOOL_DIR/google-services.json"
echo ""
echo "   4. Add EAS build profiles to eas.json (see above)"
echo ""
echo "   5. Create EAS project and update easProjectId:"
echo "      npx eas init"
echo ""
echo "   6. Build:"
echo "      ./scripts/build-school.sh ${SCHOOL_CODE_LOWER} preview"
