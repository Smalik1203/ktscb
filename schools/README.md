# White-Label School Configuration

This folder contains configurations for each school that uses the ERP/LMS platform.

## Directory Structure

```
schools/
├── _template/           # Template for new schools
│   └── config.json
├── kts/                 # Krishnaveni Talent School (default)
│   └── config.json
├── schoolname/          # Each school has its own folder
│   ├── config.json      # School configuration
│   ├── assets/          # School-specific assets
│   │   ├── icon.png
│   │   ├── adaptive-icon.png
│   │   ├── splash.png
│   │   └── notification-icon.png
│   └── google-services.json  # Firebase config for this school
└── README.md
```

## Adding a New School

### Quick Start

```bash
# 1. Run the add-school script
./scripts/add-school.sh greenwood

# 2. Follow the prompts to configure the school
```

### Manual Setup

1. **Create school folder**
   ```bash
   mkdir -p schools/greenwood/assets
   cp schools/_template/config.json schools/greenwood/
   ```

2. **Edit `config.json`**
   ```json
   {
     "schoolCode": "GREENWOOD",
     "appName": "Greenwood Academy",
     "appSlug": "greenwood-academy",
     "bundleId": "com.greenwoodacademy",
     "scheme": "greenwood",
     "owner": "your-expo-account",
     
     "branding": {
       "primaryColor": "#2E7D32",
       "secondaryColor": "#FFA726",
       "accentColor": "#D32F2F",
       "backgroundColor": "#FFFFFF",
       "tagline": "Excellence in Education"
     },
     
     "assets": {
       "icon": "./schools/greenwood/assets/icon.png",
       "adaptiveIcon": "./schools/greenwood/assets/adaptive-icon.png",
       "splash": "./schools/greenwood/assets/splash.png",
       "notificationIcon": "./schools/greenwood/assets/notification-icon.png"
     },
     
     "firebase": {
       "projectId": "greenwood-academy-app",
       "googleServicesFile": "./schools/greenwood/google-services.json"
     },
     
     "stores": {
       "playStoreUrl": null,
       "appStoreUrl": null
     },
     
     "easProjectId": "your-eas-project-id"
   }
   ```

3. **Add assets** (required dimensions)
   - `icon.png` - 1024x1024px (App Store/Play Store icon)
   - `adaptive-icon.png` - 1024x1024px (Android adaptive icon foreground)
   - `splash.png` - 1284x2778px recommended (Splash screen)
   - `notification-icon.png` - 96x96px, white silhouette on transparent

4. **Set up Firebase**
   - Create new Firebase project for the school
   - Download `google-services.json` and place in school folder
   - Enable Cloud Messaging API

5. **Create EAS project**
   ```bash
   # Set school env var
   export SCHOOL=greenwood
   
   # Initialize EAS (creates new project)
   npx eas init
   
   # Copy the project ID to config.json
   ```

6. **Add EAS build profiles** to `eas.json`:
   ```json
   "greenwood:preview": {
     "extends": "preview",
     "env": {
       "SCHOOL": "greenwood",
       "EXPO_PUBLIC_NEW_ARCH_ENABLED": "1"
     }
   },
   "greenwood:production": {
     "extends": "production",
     "env": {
       "SCHOOL": "greenwood",
       "EXPO_PUBLIC_NEW_ARCH_ENABLED": "1"
     }
   }
   ```

## Building for a School

### Preview Build (APK for testing)
```bash
./scripts/build-school.sh greenwood preview
```

### Production Build (App Bundle for Play Store)
```bash
./scripts/build-school.sh greenwood production
```

### Local Development
```bash
SCHOOL=greenwood npx expo start
```

## Database Setup

When adding a new school, also update the database:

```sql
INSERT INTO schools (
  school_code,
  school_name,
  school_address,
  school_email,
  school_phone,
  is_active,
  app_name,
  app_slug,
  bundle_id,
  deep_link_scheme,
  primary_color,
  secondary_color,
  accent_color,
  logo_url,
  tagline
) VALUES (
  'GREENWOOD',
  'Greenwood Academy',
  '123 Education Lane, City',
  'info@greenwood.edu',
  '+91 98765 43210',
  true,
  'Greenwood Academy',
  'greenwood-academy',
  'com.greenwoodacademy',
  'greenwood',
  '#2E7D32',
  '#FFA726',
  '#D32F2F',
  'https://your-storage.com/greenwood/logo.png',
  'Excellence in Education'
);
```

## Configuration Reference

| Field | Description | Example |
|-------|-------------|---------|
| `schoolCode` | Unique identifier (uppercase) | `"GREENWOOD"` |
| `appName` | Display name in app stores | `"Greenwood Academy"` |
| `appSlug` | URL-safe identifier | `"greenwood-academy"` |
| `bundleId` | iOS/Android package ID (unique globally) | `"com.greenwoodacademy"` |
| `scheme` | Deep link URL scheme | `"greenwood"` |
| `owner` | Expo account username | `"your-expo-account"` |
| `branding.primaryColor` | Main brand color (hex) | `"#2E7D32"` |
| `branding.secondaryColor` | Secondary color (hex) | `"#FFA726"` |
| `branding.accentColor` | Accent/highlight color (hex) | `"#D32F2F"` |
| `easProjectId` | EAS project ID from `eas init` | `"abc123-..."` |

## Troubleshooting

### Build fails with "school config not found"
- Ensure `schools/{school}/config.json` exists
- Check the SCHOOL env var matches the folder name (lowercase)

### Colors not applying
- Verify hex colors are valid (e.g., `"#FF0000"`)
- Rebuild the app after changing colors

### Assets not loading
- Check asset paths in config.json
- Ensure assets exist at the specified paths
- For school-specific assets, use full path: `./schools/greenwood/assets/icon.png`

### Firebase notifications not working

- Verify `google-services.json` is in the correct location
- Ensure Firebase project has Cloud Messaging API enabled
- Upload FCM credentials via `eas credentials`


