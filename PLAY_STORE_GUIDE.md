# Play Store Submission Guide for ClassBridge

## ✅ Configuration Complete

Your app is now configured for Play Store submission. Here's what was set up:

### Changes Made:
1. **eas.json** - Changed build type from `apk` to `aab` (Android App Bundle) for Play Store
2. **app.json** - Added `versionCode` for Android versioning

## 📋 Prerequisites

Before building for Play Store, you need:

### 1. Google Play Console Account
- Create a Google Play Developer account ($25 one-time fee)
- Go to: https://play.google.com/console
- Complete the registration process

### 2. EAS Account Setup
- Make sure you're logged into EAS CLI:
  ```bash
  npx eas login
  ```

### 3. App Signing Key (Automatic)
- EAS will automatically generate and manage your signing key
- No manual keystore setup needed!

## 🚀 Build Steps

### Step 1: Build Production AAB
```bash
eas build --platform android --profile production
```

This will:
- Build an Android App Bundle (AAB) file
- Automatically sign it with EAS-managed credentials
- Upload it to EAS servers
- Take approximately 15-30 minutes

### Step 2: Download the Build
After the build completes:
```bash
eas build:list
```
Then download the AAB file from the EAS dashboard or use:
```bash
eas build:download
```

### Step 3: Submit to Play Store

#### Option A: Automatic Submission (Recommended)
```bash
eas submit --platform android --profile production
```

This will:
- Automatically upload your AAB to Play Store
- Requires Google Play Console API credentials (see below)

#### Option B: Manual Submission
1. Go to Google Play Console: https://play.google.com/console
2. Create a new app (if first time)
3. Go to "Production" → "Create new release"
4. Upload the AAB file downloaded from EAS
5. Fill in release notes
6. Review and publish

## 🔑 Google Play Console API Setup (for automatic submission)

If you want to use `eas submit`, you need to set up API access:

1. **Create Service Account:**
   - Go to Google Cloud Console: https://console.cloud.google.com
   - Create a new project or select existing
   - Enable "Google Play Android Developer API"
   - Create a Service Account
   - Download the JSON key file

2. **Link Service Account to Play Console:**
   - Go to Play Console → Settings → API access
   - Link the service account
   - Grant "Release apps" permission

3. **Configure EAS:**
   ```bash
   eas submit:configure
   ```
   - Upload the JSON key file when prompted

## 📱 Play Store Listing Requirements

Before submitting, prepare:

### Required:
- ✅ **App Name**: ClassBridge (already set)
- ✅ **Package Name**: com.classbridge.app (already set)
- ⚠️ **App Icon**: 512x512px PNG (check your icon meets requirements)
- ⚠️ **Feature Graphic**: 1024x500px PNG
- ⚠️ **Screenshots**: At least 2 (phone: 16:9 or 9:16, tablet: 16:9 or 9:16)
- ⚠️ **Short Description**: 80 characters max
- ⚠️ **Full Description**: 4000 characters max
- ⚠️ **Privacy Policy URL**: Required for apps that collect data

### Recommended:
- App category
- Content rating questionnaire
- Store listing graphics (banner, screenshots)
- Promotional text

## 📝 Version Management

Your app uses automatic version incrementing:
- **Version Name**: Set in `app.json` → `version` (currently "1.0.0")
- **Version Code**: Set in `app.json` → `android.versionCode` (currently 1)
- **Auto-increment**: Enabled in `eas.json` - version code increments automatically

To update version manually:
1. Update `version` in `app.json` (e.g., "1.0.1")
2. EAS will auto-increment `versionCode` on each build

## 🔍 Testing Before Release

### Internal Testing Track (Recommended First Step)
```bash
eas build --platform android --profile preview
```

Then:
1. Upload to Play Console → Testing → Internal testing
2. Add testers via email
3. Test the app thoroughly
4. Promote to Production when ready

## 📊 Build Profiles Explained

- **development**: Development client builds (for testing)
- **preview**: APK builds for internal testing
- **production**: AAB builds for Play Store submission

## 🛠️ Troubleshooting

### Build Fails
- Check EAS build logs: `eas build:view`
- Ensure all dependencies are compatible
- Check for TypeScript/linting errors: `npm run typecheck && npm run lint`

### Submission Fails
- Verify Google Play Console API is set up correctly
- Check that app is created in Play Console
- Ensure service account has correct permissions

### Version Code Issues
- EAS auto-increments, but you can manually set in `app.json`
- Version code must always increase for each release

## 📚 Additional Resources

- EAS Build Docs: https://docs.expo.dev/build/introduction/
- EAS Submit Docs: https://docs.expo.dev/submit/introduction/
- Play Console Help: https://support.google.com/googleplay/android-developer

## 🎯 Quick Start Checklist

- [ ] Google Play Developer account created ($25)
- [ ] EAS account logged in (`npx eas login`)
- [ ] App icon is 512x512px PNG
- [ ] Privacy policy URL ready (if needed)
- [ ] Build production AAB: `eas build --platform android --profile production`
- [ ] Test the AAB on a device (download and install)
- [ ] Create app in Play Console
- [ ] Submit: `eas submit --platform android --profile production` OR manual upload
- [ ] Complete Play Store listing (screenshots, descriptions, etc.)
- [ ] Submit for review

---

**Need Help?** Check EAS build status: `eas build:list`

