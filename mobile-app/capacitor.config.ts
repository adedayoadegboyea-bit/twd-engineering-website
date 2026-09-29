import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.twdengineeringconsult.app',
  appName: 'TW&D Engineering',
  webDir: 'www',
  bundledWebRuntime: false,
  server: {
    cleartext: false
  }
};

export default config;
