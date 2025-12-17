# Fix App Crash After Installation

## Problem
The app crashes immediately after installation because required environment variables are missing.

## Required Environment Variables
- `EXPO_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous key

## Solution: Set Up EAS Secrets

### Option 1: Use the Setup Script (Recommended)

```bash
./setup-eas-secrets.sh
```

This will prompt you for:
1. Supabase URL (defaults to: https://mvvzqouqxrtyzuzqbeud.supabase.co)
2. Supabase Anon Key (required)
3. OpenAI API Key (optional)

### Option 2: Manual Setup

Set each secret individually:

```bash
# Set Supabase URL
npx eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://your-project.supabase.co"

# Set Supabase Anon Key
npx eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "your-anon-key-here"
```

### Option 3: Using EAS Environment Variables

You can also set environment variables for specific build profiles in `eas.json`:

```json
{
  "build": {
    "preview": {
      "env": {
        "EXPO_PUBLIC_SUPABASE_URL": "https://your-project.supabase.co",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "your-anon-key"
      }
    }
  }
}
```

⚠️ **Note**: This is less secure as values are visible in the config file. Use secrets for production.

## Verify Secrets Are Set

```bash
npx eas env:list
```

## Rebuild the App

After setting secrets, rebuild:

```bash
npm run build:android:apk
# or
npx eas-cli build --platform android --profile preview
```

## Get Your Supabase Credentials

1. Go to your Supabase project: https://supabase.com/dashboard
2. Select your project
3. Go to Settings → API
4. Copy:
   - **Project URL** → `EXPO_PUBLIC_SUPABASE_URL`
   - **anon/public key** → `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## Common Crash Causes

1. ✅ **Missing environment variables** (most common)
2. Missing native dependencies
3. Asset loading issues
4. Code errors

## Debug the Crash

To see the actual error:

1. **Android Logcat**:
   ```bash
   adb logcat | grep -i "react\|expo\|error"
   ```

2. **Check Expo Dashboard**:
   - Go to: https://expo.dev/accounts/krishnaveni-talent-school/projects/kts-mobile
   - Check build logs for errors

3. **Enable Remote Debugging**:
   - Shake device or press Cmd+M (iOS) / Cmd+M (Android)
   - Select "Debug Remote JS"

## Next Steps

1. Set up EAS secrets (use Option 1 above)
2. Rebuild the app
3. Test the new build
4. If still crashing, check logs for specific errors

