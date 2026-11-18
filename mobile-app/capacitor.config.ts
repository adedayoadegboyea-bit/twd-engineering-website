import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.twdengineeringconsult.app',
  appName: 'TW&D Engineering',
  webDir: 'www',
  server: {
    // Keep pages, sign-in, and media on the same origin as the public site.
    url: 'https://twdengineeringconsult.com/',
    cleartext: false
  }
};

export default config;
