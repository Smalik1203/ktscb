# Fix: API KEY INVALID Error in APK

## Problem
You're getting "API KEY INVALID" error in the installed APK because environment variables weren't included in the build.

## Solution

### Option 1: Rebuild with Updated Configuration (Recommended)

The environment variables are now in `eas.json`, but you need to rebuild:

```bash
npm run build:android:apk
```

**Important**: Make sure you're using the `preview` profile which has the environment variables configured.

### Option 2: Verify Environment Variables in Build

Check if the build includes the environment variables by looking at the build logs. You should see:
```
Environment variables loaded from the "preview" build profile "env" configuration: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, EXPO_PUBLIC_OPENAI_API_KEY
```

### Option 3: Use EAS Environment Variables (Alternative)

If the `eas.json` approach doesn't work, you can try using EAS environment variables:

1. Go to EAS Dashboard: https://expo.dev/accounts/shoaib1203/projects/classbridge/environment-variables
2. Add the variables there (but note: EAS doesn't allow "PUBLIC" in secret names)

## Current Configuration

Your `eas.json` has environment variables set for the `preview` profile:
- ✅ `EXPO_PUBLIC_SUPABASE_URL`
- ✅ `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- ✅ `EXPO_PUBLIC_OPENAI_API_KEY`

## Steps to Fix

1. **Rebuild the APK**:
   ```bash
   npm run build:android:apk
   ```

2. **Wait for build to complete** (~15-30 minutes)

3. **Download and install the new APK**

4. **Test the login** - it should work now

## Why This Happened

The APK you installed was likely built before we added the environment variables to `eas.json`. EAS builds need the environment variables to be:
- Either in `eas.json` (which we've done)
- Or set as EAS secrets (but EAS doesn't allow "PUBLIC" in names)

## Verification

After rebuilding, the app should:
- ✅ Load without "API KEY INVALID" error
- ✅ Connect to Supabase successfully
- ✅ Allow login

---

**Action Required**: Rebuild the APK with `npm run build:android:apk`

