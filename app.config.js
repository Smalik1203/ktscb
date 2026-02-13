/**
 * Dynamic Expo Configuration for White-Label Builds
 * 
 * Usage:
 *   SCHOOL=kts npx expo start
 *   SCHOOL=kts eas build --profile preview
 * 
 * Each school has its own config in ./schools/{school_code}/config.json
 */

const fs = require('fs');
const path = require('path');

// Get school from environment variable, default to 'kts'
const SCHOOL = process.env.SCHOOL || 'kts';

// Load school configuration
function loadSchoolConfig(schoolCode) {
  const configPath = path.join(__dirname, 'schools', schoolCode.toLowerCase(), 'config.json');
  
  if (!fs.existsSync(configPath)) {
    // If already trying the default and it doesn't exist, throw instead of infinite recursion
    if (schoolCode.toLowerCase() === 'kts') {
      throw new Error(
        `Default school config not found at ${configPath}. ` +
        `Create schools/kts/config.json or set SCHOOL env to a valid school code.`
      );
    }
    console.warn(`⚠️  School config not found: ${configPath}`);
    console.warn(`   Using default school: kts`);
    return loadSchoolConfig('kts');
  }
  
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  console.log(`📱 Building for: ${config.appName} (${config.schoolCode})`);
  return config;
}

const school = loadSchoolConfig(SCHOOL);

// Resolve asset paths - use school-specific if exists, otherwise default
function resolveAsset(assetPath) {
  if (!assetPath) return null;
  
  // If path starts with ./schools/, check if it exists
  if (assetPath.startsWith('./schools/')) {
    if (fs.existsSync(path.join(__dirname, assetPath.substring(2)))) {
      return assetPath;
    }
    // Fallback to default assets
    const filename = path.basename(assetPath);
    return `./assets/images/${filename}`;
  }
  
  return assetPath;
}

// Resolve Firebase config file
function resolveFirebaseConfig() {
  const schoolPath = `./schools/${SCHOOL.toLowerCase()}/google-services.json`;
  if (fs.existsSync(path.join(__dirname, schoolPath.substring(2)))) {
    return schoolPath;
  }
  return './google-services.json';
}

module.exports = {
  expo: {
    name: school.appName,
    slug: school.appSlug,
    version: "1.0.0",
    orientation: "default",
    scheme: school.scheme,
    icon: resolveAsset(school.assets?.icon) || "./assets/images/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    
    splash: {
      image: resolveAsset(school.assets?.splash) || "./assets/images/Image.png",
      resizeMode: "contain",
      backgroundColor: school.branding?.backgroundColor || "#FFFFFF"
    },
    
    ios: {
      supportsTablet: true,
      bundleIdentifier: school.bundleId,
      jsEngine: "hermes",
      icon: resolveAsset(school.assets?.icon) || "./assets/images/icon.png",
      infoPlist: {
        NSLocationWhenInUseUsageDescription: "This app needs your location to track the school bus during a trip.",
        NSLocationAlwaysAndWhenInUseUsageDescription: "This app needs background location access to continue tracking the school bus when the app is minimised.",
        NSLocationAlwaysUsageDescription: "This app needs background location access to continue tracking the school bus when the app is minimised.",
        UIBackgroundModes: ["location"],
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: false,
          NSExceptionDomains: {
            localhost: {
              NSExceptionAllowsInsecureHTTPLoads: true,
              NSIncludesSubdomains: false
            }
          }
        },
        UISupportedInterfaceOrientations: [
          "UIInterfaceOrientationPortrait",
          "UIInterfaceOrientationPortraitUpsideDown",
          "UIInterfaceOrientationLandscapeLeft",
          "UIInterfaceOrientationLandscapeRight"
        ],
        "UISupportedInterfaceOrientations~ipad": [
          "UIInterfaceOrientationPortrait",
          "UIInterfaceOrientationPortraitUpsideDown",
          "UIInterfaceOrientationLandscapeLeft",
          "UIInterfaceOrientationLandscapeRight"
        ]
      }
    },
    
    android: {
      package: school.bundleId,
      googleServicesFile: resolveFirebaseConfig(),
      versionCode: 1,
      jsEngine: "hermes",
      edgeToEdgeEnabled: true,
      adaptiveIcon: {
        foregroundImage: resolveAsset(school.assets?.adaptiveIcon) || "./assets/images/adaptive-icon.png",
        backgroundColor: school.branding?.primaryColor || "#6B3FA0"
      },
      icon: resolveAsset(school.assets?.icon) || "./assets/images/icon.png",
      // Google Maps API key for the transport live map (optional)
      config: process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ? {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY
        }
      } : undefined,
      permissions: [
        "INTERNET",
        "ACCESS_NETWORK_STATE",
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "FOREGROUND_SERVICE",
        "FOREGROUND_SERVICE_LOCATION"
      ],
      playStoreUrl: school.stores?.playStoreUrl || undefined
    },
    
    web: {
      bundler: "metro",
      output: "single"
    },
    
    plugins: [
      "expo-router",
      "expo-font",
      "expo-secure-store",
      [
        "expo-splash-screen",
        {
          image: resolveAsset(school.assets?.splash) || "./assets/images/Image.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: school.branding?.backgroundColor || "#FFFFFF"
        }
      ],
      [
        "expo-system-ui",
        {
          userInterfaceStyle: "light"
        }
      ],
      "expo-asset",
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission: "This app needs background location access to track the school bus during a trip.",
          locationAlwaysPermission: "This app needs background location access to track the school bus when minimised.",
          locationWhenInUsePermission: "This app needs your location to track the school bus during a trip.",
          isAndroidBackgroundLocationEnabled: true,
          isAndroidForegroundServiceEnabled: true
        }
      ],
      "expo-video",
      [
        "expo-notifications",
        {
          icon: resolveAsset(school.assets?.notificationIcon) || "./assets/images/notification-icon.png",
          color: school.branding?.primaryColor || "#6B3FA0",
          sounds: []
        }
      ],
      "@react-native-community/datetimepicker",
      // Sentry: only include when SENTRY_ORG is configured to avoid
      // invalid native config that can crash the app at launch.
      ...(process.env.SENTRY_ORG
        ? [["@sentry/react-native/expo", {
            organization: process.env.SENTRY_ORG,
            project: process.env.SENTRY_PROJECT || "classbridge-mobile",
          }]]
        : []),
    ],
    
    experiments: {
      typedRoutes: true
    },
    
    extra: {
      router: {},
      eas: {
        projectId: school.easProjectId
      },
      // Pass school config to runtime
      school: {
        code: school.schoolCode,
        name: school.appName,
        branding: school.branding
      }
    },
    
    owner: school.owner
  }
};
