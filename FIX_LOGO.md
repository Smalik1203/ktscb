# Fix App Logo/Icon

## Current Configuration
The app is currently using: `./assets/images/Image.png` for all icons

## Icon Requirements

### Main App Icon
- **Size**: 1024x1024 pixels
- **Format**: PNG
- **Shape**: Square
- **Background**: Can be transparent (iOS) or solid (Android adaptive icon)

### Android Adaptive Icon
- **Foreground**: 1024x1024 pixels (should be centered, with safe area)
- **Background Color**: Solid color (currently set to `#6B3FA0`)

### iOS Icon
- **Size**: 1024x1024 pixels
- **Format**: PNG
- **No transparency** (will be automatically rounded)

## Steps to Fix Logo

### Option 1: Replace the Image File

1. **Prepare your logo**:
   - Create a 1024x1024 PNG file
   - Make sure it's square
   - For Android: Leave padding around edges (safe area)
   - Save as: `assets/images/icon.png`

2. **Update app.json**:
   ```json
   {
     "expo": {
       "icon": "./assets/images/icon.png",
       "ios": {
         "icon": "./assets/images/icon.png"
       },
       "android": {
         "adaptiveIcon": {
           "foregroundImage": "./assets/images/icon.png",
           "backgroundColor": "#6B3FA0"  // Your brand color
         }
       }
     }
   }
   ```

### Option 2: Use favicon.png (if it's the correct logo)

If `favicon.png` is your correct logo:

1. **Check the file**:
   - Make sure `assets/images/favicon.png` is 1024x1024
   - If not, resize it

2. **Update app.json** to use favicon.png:
   ```json
   {
     "expo": {
       "icon": "./assets/images/favicon.png",
       "ios": {
         "icon": "./assets/images/favicon.png"
       },
       "android": {
         "adaptiveIcon": {
           "foregroundImage": "./assets/images/favicon.png",
           "backgroundColor": "#6B3FA0"
         }
       }
     }
   }
   ```

### Option 3: Generate Icons Automatically

Use Expo's icon generator:

1. **Install expo-cli** (if not already):
   ```bash
   npm install -g expo-cli
   ```

2. **Generate icons**:
   ```bash
   npx expo install @expo/configure-splash-screen
   ```

3. **Or use an online tool**:
   - Upload your logo to: https://www.appicon.co/
   - Download the generated icons
   - Place the 1024x1024 icon in `assets/images/icon.png`

## After Updating

1. **Clear cache**:
   ```bash
   npx expo start -c
   ```

2. **Rebuild the app**:
   ```bash
   npm run build:android:apk
   ```

## Quick Fix (If you have the correct logo file)

If you have the correct logo file ready:

1. **Replace the file**:
   - Place your logo as: `assets/images/icon.png` (1024x1024 PNG)

2. **Update app.json** (I can do this for you)

3. **Rebuild**

## Common Issues

- ❌ **Icon too small**: Must be at least 1024x1024
- ❌ **Not square**: Icons must be square
- ❌ **Wrong format**: Must be PNG
- ❌ **Transparency on Android**: Android adaptive icons need solid background color

## Need Help?

Tell me:
1. Do you have the correct logo file?
2. What's the file name/path?
3. What size is it currently?

I can help update the configuration once you have the correct logo file.

