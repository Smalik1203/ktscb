#!/bin/bash
# Verification script for Android signing configuration
# Run this to check package name consistency and identify issues

set -e

echo "🔍 Android Signing Configuration Verification"
echo "=============================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# Expected package name
EXPECTED_PACKAGE="com.ktsboduppal"

echo "📦 Checking Package Name Consistency"
echo "-----------------------------------"

# Check app.json
echo -n "Checking app.json... "
APP_JSON_PACKAGE=$(grep -A 2 '"android"' app.json | grep '"package"' | sed 's/.*"package": *"\([^"]*\)".*/\1/')
if [ "$APP_JSON_PACKAGE" = "$EXPECTED_PACKAGE" ]; then
    echo -e "${GREEN}✓${NC} $APP_JSON_PACKAGE"
else
    echo -e "${RED}✗${NC} Found: $APP_JSON_PACKAGE (Expected: $EXPECTED_PACKAGE)"
    ((ERRORS++))
fi

# Check build.gradle applicationId
echo -n "Checking build.gradle applicationId... "
BUILD_GRADLE_ID=$(grep "applicationId" android/app/build.gradle | head -1 | sed "s/.*applicationId *'\([^']*\)'.*/\1/")
if [ "$BUILD_GRADLE_ID" = "$EXPECTED_PACKAGE" ]; then
    echo -e "${GREEN}✓${NC} $BUILD_GRADLE_ID"
else
    echo -e "${RED}✗${NC} Found: $BUILD_GRADLE_ID (Expected: $EXPECTED_PACKAGE)"
    ((ERRORS++))
fi

# Check build.gradle namespace
echo -n "Checking build.gradle namespace... "
BUILD_GRADLE_NS=$(grep "namespace" android/app/build.gradle | head -1 | sed "s/.*namespace *'\([^']*\)'.*/\1/")
if [ "$BUILD_GRADLE_NS" = "$EXPECTED_PACKAGE" ]; then
    echo -e "${GREEN}✓${NC} $BUILD_GRADLE_NS"
else
    echo -e "${RED}✗${NC} Found: $BUILD_GRADLE_NS (Expected: $EXPECTED_PACKAGE)"
    ((ERRORS++))
fi

# Check MainActivity.kt package
echo -n "Checking MainActivity.kt package... "
MAIN_ACTIVITY_PKG=$(grep "^package" android/app/src/main/java/com/ktsboduppal/MainActivity.kt | sed 's/package *\(.*\)/\1/')
if [ "$MAIN_ACTIVITY_PKG" = "$EXPECTED_PACKAGE" ]; then
    echo -e "${GREEN}✓${NC} $MAIN_ACTIVITY_PKG"
else
    echo -e "${RED}✗${NC} Found: $MAIN_ACTIVITY_PKG (Expected: $EXPECTED_PACKAGE)"
    ((ERRORS++))
fi

# Check MainApplication.kt package
echo -n "Checking MainApplication.kt package... "
MAIN_APP_PKG=$(grep "^package" android/app/src/main/java/com/ktsboduppal/MainApplication.kt | sed 's/package *\(.*\)/\1/')
if [ "$MAIN_APP_PKG" = "$EXPECTED_PACKAGE" ]; then
    echo -e "${GREEN}✓${NC} $MAIN_APP_PKG"
else
    echo -e "${RED}✗${NC} Found: $MAIN_APP_PKG (Expected: $EXPECTED_PACKAGE)"
    ((ERRORS++))
fi

echo ""
echo "🔑 Checking EAS Configuration"
echo "-----------------------------"

# Check if EAS CLI is available
if command -v eas &> /dev/null || command -v npx &> /dev/null; then
    echo -e "${GREEN}✓${NC} EAS CLI available"
    
    # Check project ID
    echo -n "Checking EAS project ID... "
    PROJECT_ID=$(grep -A 3 '"eas"' app.json | grep '"projectId"' | sed 's/.*"projectId": *"\([^"]*\)".*/\1/')
    if [ -n "$PROJECT_ID" ]; then
        echo -e "${GREEN}✓${NC} $PROJECT_ID"
    else
        echo -e "${YELLOW}⚠${NC} No project ID found"
        ((WARNINGS++))
    fi
else
    echo -e "${YELLOW}⚠${NC} EAS CLI not found. Install with: npm install -g eas-cli"
    ((WARNINGS++))
fi

echo ""
echo "📱 Checking for Old Package References"
echo "--------------------------------------"

# Check for old package name references
OLD_PACKAGE="com.kts.mobile"
echo -n "Searching for '$OLD_PACKAGE' references... "
OLD_REFS=$(grep -r "$OLD_PACKAGE" app.json android/ ios/ 2>/dev/null | grep -v ".git" | wc -l | tr -d ' ')
if [ "$OLD_REFS" -eq 0 ]; then
    echo -e "${GREEN}✓${NC} No old package references found"
else
    echo -e "${YELLOW}⚠${NC} Found $OLD_REFS references to old package name"
    echo "   Locations:"
    grep -r "$OLD_PACKAGE" app.json android/ ios/ 2>/dev/null | grep -v ".git" | sed 's/^/   - /'
    ((WARNINGS++))
fi

echo ""
echo "📋 Summary"
echo "----------"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Verify EAS credentials match Google Play expectations:"
    echo "   eas credentials --platform android"
    echo "2. Check Google Play Console for package name registration"
    echo "3. Build and test: eas build --platform android --profile production"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠ Configuration has $WARNINGS warning(s) but no errors${NC}"
    echo ""
    echo "Review the warnings above and fix as needed."
    exit 0
else
    echo -e "${RED}✗ Found $ERRORS error(s) and $WARNINGS warning(s)${NC}"
    echo ""
    echo "Please fix the errors before proceeding with builds."
    exit 1
fi
