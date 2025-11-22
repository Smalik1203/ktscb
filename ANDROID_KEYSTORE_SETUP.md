# Android Keystore Setup Guide

## 🔑 What is an Android Keystore?

An Android keystore is a file that contains cryptographic keys used to sign your Android app. It's required for:
- Publishing to Google Play Store
- Ensuring app updates work correctly
- Maintaining app security and integrity

## ✅ EAS Automatic Keystore Management

**Good News**: EAS can automatically generate and manage your Android keystore for you!

### Benefits:
- ✅ No manual setup required
- ✅ Securely stored on EAS servers
- ✅ Automatically used for all builds
- ✅ You don't need to download or manage the keystore file

## 🚀 How to Generate Keystore (First Build)

When you run your first Android build, EAS will ask:

```
Generate a new Android Keystore?
```

### Answer: **YES** (or **Y**)

This will:
1. Generate a new keystore automatically
2. Store it securely on EAS servers
3. Use it for all future Android builds
4. Never ask you again (it's saved)

## 📝 Step-by-Step

### Option 1: Interactive Build (Recommended)

Run the build command in your terminal:

```bash
npm run build:android
```

When prompted:
- **"Generate a new Android Keystore?"** → Type `y` or `yes` and press Enter
- EAS will generate the keystore automatically
- The build will continue

### Option 2: Pre-configure Credentials

You can set up credentials before building:

```bash
npx eas-cli credentials
```

Then:
1. Select **Android**
2. Select **Set up credentials for production**
3. Choose **Generate a new keystore**
4. EAS will create it automatically

## ⚠️ Important Notes

### For New Projects
- **Always answer YES** to generate a new keystore
- This is a one-time setup
- EAS will manage it for you

### For Existing Projects
- If you already have a keystore, you can:
  - Use the existing one (answer NO)
  - Or generate a new one (answer YES)
- **Warning**: Changing keystores means you can't update existing apps on Play Store

### Keystore Security
- ✅ Keystore is encrypted and stored securely on EAS servers
- ✅ Only you (and your team) can access it
- ✅ EAS handles all signing automatically
- ✅ You don't need to download or backup the keystore file

## 🔍 Verify Keystore Status

Check if a keystore is already configured:

```bash
npx eas-cli credentials
```

Then select:
- **Android** → **View credentials**

You'll see:
- ✅ **"Keystore: Managed by Expo"** - If keystore exists
- ❌ **"No credentials found"** - If you need to generate one

## 🎯 Quick Start

**For your first build, simply:**

1. Run:
   ```bash
   npm run build:android
   ```

2. When asked: **"Generate a new Android Keystore?"**
   - Type: `y`
   - Press: Enter

3. That's it! EAS handles everything else.

## 📚 Additional Resources

- [EAS Credentials Documentation](https://docs.expo.dev/app-signing/managed-credentials/)
- [Android App Signing Guide](https://docs.expo.dev/build/android-app-signing/)

---

**Remember**: Answer **YES** when EAS asks to generate a keystore on your first build! 🚀

