import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Full Circle FM',
  slug: 'fcfm-map-app',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  scheme: 'fcfm',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#ed7332',
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.fullcirclefm.mapstore',
    config: {
      googleMapsApiKey: process.env.GOOGLE_MAPS_IOS_KEY,
    },
    infoPlist: {
      NSCameraUsageDescription: 'Used to capture before/after photos at job sites.',
      NSPhotoLibraryUsageDescription: 'Used to attach existing photos to job records.',
      NSLocationWhenInUseUsageDescription: 'Used to show your position on the map.',
    },
  },
  android: {
    package: 'com.fullcirclefm.mapstore',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ed7332',
    },
    permissions: ['CAMERA', 'ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION'],
    config: {
      googleMaps: { apiKey: process.env.GOOGLE_MAPS_ANDROID_KEY },
    },
  },
  plugins: ['expo-camera', 'expo-image-picker', 'expo-secure-store'],
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001',
    eas: { projectId: process.env.EAS_PROJECT_ID ?? '' },
  },
};

export default config;
