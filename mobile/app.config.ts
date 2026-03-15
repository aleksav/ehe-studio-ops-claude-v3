import { ExpoConfig, ConfigContext } from 'expo/config';
import { execSync } from 'child_process';

let commitHash = 'unknown';
try {
  commitHash = execSync('git rev-parse --short HEAD').toString().trim();
} catch {
  // fallback
}

const buildDate = new Date().toISOString().split('T')[0];

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'EHEStudio Ops',
  slug: 'ehestudio-ops',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#FFFFFF',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.ehestudio.ops',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#E91E8C',
    },
    package: 'com.ehestudio.ops',
  },
  updates: {
    url: 'https://u.expo.dev/16878605-797e-4c4c-8c2e-b2b517f0ed57',
  },
  runtimeVersion: '1.0.0',
  extra: {
    commitHash,
    buildDate,
    eas: {
      projectId: '16878605-797e-4c4c-8c2e-b2b517f0ed57',
    },
  },
  owner: 'thestartupfactorytech',
  plugins: ['expo-secure-store', 'expo-system-ui'],
});
