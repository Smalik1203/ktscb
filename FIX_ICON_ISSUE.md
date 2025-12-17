# Fix: Wrong Logo Showing in App

## Problem
The app is showing a different logo than `Image.png` because the native Android project has pre-generated icon files that override the `app.json` configuration.

## Solution: Regenerate Icons

When you have a native `android/` folder, Expo uses the native icon files instead of generating new ones from `app.json`. We need to regenerate them.

### Option 1: Regenerate Icons with Expo Prebuild (Recommended)

```bash
# This will regenerate all native icons from app.json
npx expo prebuild --clean --platform android
```

⚠️ **Warning**: This will regenerate the entire native Android project. Make sure you have your changes committed.

### Option 2: Manual Fix (Quick)

Since `Image.png` is already in `app.json`, we can force Expo to regenerate icons:

1. **Delete the old icon files**:
   ```bash
   rm -rf android/app/src/main/res/mipmap-*/
   ```

2. **Regenerate with prebuild**:
   ```bash
   npx expo prebuild --platform android
   ```

### Option 3: Use EAS Build (Easiest)

EAS Build will automatically use the icon from `app.json` when building:

```bash
npm run build:android:apk
```

EAS Build generates fresh native projects, so it will use `Image.png` correctly.

## Why This Happens

- Native projects (`android/` and `ios/` folders) have pre-generated icon files
- These files take precedence over `app.json` configuration
- Local builds use native files, EAS builds regenerate from `app.json`

## Recommended Solution

**Use EAS Build** - it will automatically use the correct icon from `app.json`:

```bash
npm run build:android:apk
```

This is the easiest solution and ensures the icon matches `Image.png`.

