#!/bin/bash
#
# 🏫 ClassBridge — Add a New White-Label School
#
# Interactive mode:  ./scripts/add-school.sh
# Non-interactive:   ./scripts/add-school.sh --code ABC --name "ABC School" --color "#E53935"
#
set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SCHOOLS_DIR="$ROOT_DIR/schools"

# ─── Colors ─────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

echo ""
echo -e "${CYAN}${BOLD}🏫 ClassBridge — Add New School${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ─── Parse flags ────────────────────────────────────────────────────
SCHOOL_CODE="" SCHOOL_NAME="" PRIMARY_COLOR="" BUNDLE_ID="" EXPO_OWNER="" EAS_PROJECT_ID=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --code)   SCHOOL_CODE="$2"; shift 2 ;;
    --name)   SCHOOL_NAME="$2"; shift 2 ;;
    --color)  PRIMARY_COLOR="$2"; shift 2 ;;
    --bundle) BUNDLE_ID="$2"; shift 2 ;;
    --owner)  EXPO_OWNER="$2"; shift 2 ;;
    --eas-id) EAS_PROJECT_ID="$2"; shift 2 ;;
    *) echo -e "${RED}Unknown flag: $1${NC}"; exit 1 ;;
  esac
done

# ─── Interactive prompts ────────────────────────────────────────────
prompt() {
  local var_name="$1" prompt_text="$2" default="$3"
  if [ -z "${!var_name}" ]; then
    if [ -n "$default" ]; then
      read -rp "$(echo -e "  ${BOLD}$prompt_text${NC} [$default]: ")" input
      eval "$var_name=\"${input:-$default}\""
    else
      read -rp "$(echo -e "  ${BOLD}$prompt_text${NC}: ")" input
      eval "$var_name=\"$input\""
    fi
  fi
}

prompt SCHOOL_CODE   "School code (uppercase, e.g. GWD)"
prompt SCHOOL_NAME   "Full school name"
prompt PRIMARY_COLOR "Primary brand color (hex)" "#6B3FA0"
prompt BUNDLE_ID     "Android/iOS bundle ID" "com.${SCHOOL_CODE,,}"
prompt EXPO_OWNER    "Expo account owner" "krishnaveni-talent-school"
prompt EAS_PROJECT_ID "EAS Project ID (or press Enter to skip)" "SKIP"

if [ -z "$SCHOOL_CODE" ] || [ -z "$SCHOOL_NAME" ]; then
  echo -e "\n${RED}❌ School code and name are required.${NC}"; exit 1
fi

SCHOOL_DIR_NAME="${SCHOOL_CODE,,}"
SCHOOL_DIR="$SCHOOLS_DIR/$SCHOOL_DIR_NAME"

if [ -d "$SCHOOL_DIR" ]; then
  echo -e "\n${RED}❌ School already exists: schools/$SCHOOL_DIR_NAME/${NC}"; exit 1
fi

# ─── Create directory + config ──────────────────────────────────────
echo ""
echo -e "${YELLOW}⚙  Setting up ${BOLD}$SCHOOL_NAME${NC}${YELLOW} ($SCHOOL_CODE)...${NC}"

mkdir -p "$SCHOOL_DIR/assets"

EAS_ID_VALUE="$EAS_PROJECT_ID"
[ "$EAS_PROJECT_ID" = "SKIP" ] && EAS_ID_VALUE=""

cat > "$SCHOOL_DIR/config.json" << EOF
{
  "schoolCode": "${SCHOOL_CODE^^}",
  "appName": "$SCHOOL_NAME",
  "appSlug": "$SCHOOL_DIR_NAME-mobile",
  "bundleId": "$BUNDLE_ID",
  "scheme": "$SCHOOL_DIR_NAME",
  "owner": "$EXPO_OWNER",

  "branding": {
    "primaryColor": "$PRIMARY_COLOR",
    "secondaryColor": "#4A90D9",
    "accentColor": "#F59E0B",
    "backgroundColor": "#FFFFFF",
    "tagline": ""
  },

  "assets": {
    "icon": "./schools/$SCHOOL_DIR_NAME/assets/icon.png",
    "adaptiveIcon": "./schools/$SCHOOL_DIR_NAME/assets/adaptive-icon.png",
    "splash": "./schools/$SCHOOL_DIR_NAME/assets/splash.png",
    "notificationIcon": "./schools/$SCHOOL_DIR_NAME/assets/notification-icon.png"
  },

  "firebase": {
    "projectId": "",
    "googleServicesFile": "./schools/$SCHOOL_DIR_NAME/google-services.json"
  },

  "stores": {
    "playStoreUrl": null,
    "appStoreUrl": null
  },

  "easProjectId": "$EAS_ID_VALUE"
}
EOF
echo -e "  ${GREEN}✓${NC} Created config.json"

# ─── Copy default assets as placeholders ────────────────────────────
for asset in icon.png notification-icon.png; do
  src="$ROOT_DIR/assets/images/$asset"
  if [ -f "$src" ]; then
    cp "$src" "$SCHOOL_DIR/assets/$asset"
    [ "$asset" = "icon.png" ] && cp "$src" "$SCHOOL_DIR/assets/adaptive-icon.png" && cp "$src" "$SCHOOL_DIR/assets/splash.png"
  fi
done
echo -e "  ${GREEN}✓${NC} Copied placeholder assets"

# ─── Auto-inject EAS build profiles ────────────────────────────────
EAS_FILE="$ROOT_DIR/eas.json"
if [ -f "$EAS_FILE" ] && command -v node &> /dev/null; then
  # Use Node to safely modify JSON (no jq dependency needed)
  node -e "
    const fs = require('fs');
    const eas = JSON.parse(fs.readFileSync('$EAS_FILE', 'utf8'));
    const code = '$SCHOOL_DIR_NAME';
    const previewKey = code + ':preview';
    const prodKey = code + ':production';
    if (!eas.build[previewKey]) {
      eas.build[previewKey] = {
        extends: 'preview',
        env: { SCHOOL: code, EXPO_PUBLIC_NEW_ARCH_ENABLED: '1' }
      };
    }
    if (!eas.build[prodKey]) {
      eas.build[prodKey] = {
        extends: 'production',
        env: { SCHOOL: code, EXPO_PUBLIC_NEW_ARCH_ENABLED: '1' }
      };
    }
    fs.writeFileSync('$EAS_FILE', JSON.stringify(eas, null, 2) + '\n');
  " 2>/dev/null && echo -e "  ${GREEN}✓${NC} Added EAS build profiles to eas.json" \
    || echo -e "  ${YELLOW}⚠${NC} Could not auto-update eas.json — add profiles manually"
else
  echo -e "  ${YELLOW}⚠${NC} eas.json not found — add build profiles manually"
fi

# ─── Summary ────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}✅ School created successfully!${NC}"
echo ""
echo -e "  📁  schools/$SCHOOL_DIR_NAME/"
echo -e "  🎨  Primary: $PRIMARY_COLOR"
echo -e "  📦  Bundle:  $BUNDLE_ID"
echo ""
echo -e "${CYAN}${BOLD}Next steps:${NC}"
echo -e "  1. ${BOLD}Replace assets${NC} in schools/$SCHOOL_DIR_NAME/assets/"
echo -e "     • icon.png (1024×1024)  •  splash.png (1284×2778)"
echo -e "     • notification-icon.png (96×96, white on transparent)"
echo ""
echo -e "  2. ${BOLD}Add Firebase${NC}: copy google-services.json → schools/$SCHOOL_DIR_NAME/"
echo ""
echo -e "  3. ${BOLD}Dev:${NC}   SCHOOL=$SCHOOL_DIR_NAME npx expo start"
echo -e "     ${BOLD}Build:${NC} eas build --profile $SCHOOL_DIR_NAME:preview --platform android"
echo ""
