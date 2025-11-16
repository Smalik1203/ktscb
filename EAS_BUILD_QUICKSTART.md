# EAS Build Quick Start Guide for ClassBridge

## ✅ Current Status

- **EAS Account**: Logged in as `shoaib1203` ✓
- **Project ID**: `0ef0da41-8d21-45f7-ade7-fca22e8e5436` ✓
- **Build Configuration**: Ready ✓
- **Android**: Configured for AAB (Play Store) ✓
- **iOS**: Ready for App Store ✓

## 🚀 Quick Build Commands

### Build for Android (Play Store)
```bash
npm run build:android
```
or
```bash
npx eas build --platform android --profile production
```

### Build for iOS (App Store)
```bash
npm run build:ios
```
or
```bash
npx eas build --platform ios --profile production
```

### Build for Both Platforms
```bash
npm run build:all
```
or
```bash
npx eas build --platform all --profile production
```

## 📱 Build Profiles

Your project has 3 build profiles configured:

### 1. **development** - Development Client
- For testing with Expo Go features
- Includes development tools
- Distribution: Internal

### 2. **preview** - Preview/Testing Builds
- APK for Android (for testing)
- Distribution: Internal
- Good for beta testing

### 3. **production** - Store-Ready Builds
- **Android**: AAB (Android App Bundle) for Play Store
- **iOS**: IPA for App Store
- Auto-increments version code
- Distribution: Store

## 🔨 Building Your First Production App

### Step 1: Build Android AAB for Play Store
```bash
npm run build:android
```

**What happens:**
1. EAS will validate your project
2. Upload your code to EAS servers
3. Build the Android App Bundle (AAB)
4. Sign it automatically with EAS-managed credentials
5. Provide download link (takes ~15-30 minutes)

**You'll be asked:**
- Build profile: Choose `production`
- Platform: Choose `android` (or `all` for both)

### Step 2: Monitor Build Progress
```bash
npx eas build:list
```

Or check the EAS dashboard:
- Web: https://expo.dev/accounts/shoaib1203/projects/classbridge-mobile/builds

### Step 3: Download Your Build
After build completes:
```bash
npx eas build:download
```
Or download from the EAS dashboard.

## 📤 Submitting to Stores

### Android (Play Store)
```bash
npm run submit:android
```
or
```bash
npx eas submit --platform android --profile production
```

**Requirements:**
- Google Play Developer account ($25 one-time)
- Google Play Console API credentials (for automatic submission)
- Or manually upload AAB to Play Console

### iOS (App Store)
```bash
npm run submit:ios
```
or
```bash
npx eas submit --platform ios --profile production
```

**Requirements:**
- Apple Developer account ($99/year)
- App Store Connect API key (for automatic submission)
- Or manually upload via Xcode/Transporter

## 🔍 Useful Commands

### Check Build Status
```bash
npx eas build:list
```

### View Build Details
```bash
npx eas build:view [BUILD_ID]
```

### View Project Info
```bash
npx eas project:info
```

### Configure Credentials
```bash
npx eas credentials
```

### Update Build Configuration
```bash
npx eas build:configure
```

## 📋 Pre-Build Checklist

Before building, ensure:

- [ ] All code is committed to git
- [ ] TypeScript compiles: `npm run typecheck`
- [ ] No linting errors: `npm run lint`
- [ ] App version is correct in `app.json`
- [ ] Environment variables are set (if needed)
- [ ] App icon is properly configured
- [ ] All dependencies are installed: `npm install`

## 🎯 Build Configuration Files

### `eas.json`
- Build profiles and settings
- Auto-increment version codes
- Environment variables

### `app.json`
- App metadata
- Package/bundle identifiers
- Icons and permissions
- Version information

## 🔐 Credentials Management

EAS automatically manages:
- ✅ Android signing keys (keystore)
- ✅ iOS certificates and provisioning profiles

**You don't need to manually manage credentials!** EAS handles everything.

## 📊 Version Management

- **Version Name**: `app.json` → `version` (e.g., "1.0.0")
- **Android Version Code**: `app.json` → `android.versionCode` (starts at 1)
- **Auto-increment**: Enabled in `eas.json` - version code increases automatically

## 🐛 Troubleshooting

### Build Fails
1. Check build logs: `npx eas build:view [BUILD_ID]`
2. Verify TypeScript: `npm run typecheck`
3. Check linting: `npm run lint`
4. Review `eas.json` configuration

### Credentials Issues
```bash
npx eas credentials
```
- View current credentials
- Reset if needed
- Configure manually if required

### Project Not Found
```bash
npx eas project:info
```
- Verify project ID matches `app.json`
- Re-link if needed: `npx eas init`

## 📚 Next Steps

1. **Build your first production app:**
   ```bash
   npm run build:android
   ```

2. **Test the build:**
   - Download the AAB
   - Install on a test device
   - Verify everything works

3. **Submit to Play Store:**
   - See `PLAY_STORE_GUIDE.md` for detailed instructions
   - Or use: `npm run submit:android`

## 🔗 Resources

- EAS Build Docs: https://docs.expo.dev/build/introduction/
- EAS Submit Docs: https://docs.expo.dev/submit/introduction/
- EAS Dashboard: https://expo.dev
- Play Store Guide: See `PLAY_STORE_GUIDE.md`

---

**Ready to build?** Run: `npm run build:android` 🚀

