# Setup Native PDF Viewer (Recommended)

## Why You Need This

Expo Go **cannot** run native modules like `react-native-pdf`. To get fast, high-quality PDF viewing, you need a development build.

## One-Time Setup (5 minutes)

### Step 1: Install react-native-pdf
```bash
npm install react-native-pdf react-native-blob-util
```

### Step 2: Add plugin to app.json
Already done! ✅

### Step 3: Create development build

**Option A: Build locally (faster)**
```bash
# iOS
npx expo run:ios

# Android  
npx expo run:android
```

**Option B: Build with EAS (recommended)**
```bash
# Install EAS CLI if you haven't
npm install -g eas-cli

# Login to Expo
eas login

# Create development build
eas build --profile development --platform ios
# or
eas build --profile development --platform android
```

### Step 4: Install the build on your device

After the build completes:
- **iOS**: Download from link and install via TestFlight or direct install
- **Android**: Download APK and install directly

### Step 5: Run your app
```bash
npx expo start --dev-client
```

## What You Get

✅ **Fast native PDF rendering** (PDFKit on iOS, PdfRenderer on Android)
✅ **No file size limits** - Handle 100MB+ PDFs
✅ **Pinch-to-zoom** - Native gestures (1x-3x)
✅ **Page navigation** - Swipe between pages
✅ **Offline caching** - View PDFs offline after first load
✅ **High quality** - Crystal clear text and graphics

## I've Already Prepared Everything

The production-ready PDF viewer is in:
`src/components/resources/PDFViewer.tsx`

It includes:
- Native PDF rendering
- Page counter
- Zoom controls
- Navigation buttons
- Error handling
- Loading states
- Full TypeScript support

## Quick Alternative (If You Can't Build Now)

For now, keep using the WebView version. When you're ready to build:

1. Uncomment the native PDF viewer code (already written)
2. Run `npx expo run:ios` or `npx expo run:android`
3. Done!

## Need Help?

Check the Expo docs:
https://docs.expo.dev/develop/development-builds/introduction/
