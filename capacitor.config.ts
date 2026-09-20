import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jugaadvisuals.app',
  appName: 'Jugaad Visuals',
  webDir: 'dist',
  backgroundColor: '#050505',
  android: {
    allowMixedContent: true,
    backgroundColor: '#050505',
    captureInput: true,
  },
  server: {
    androidScheme: 'https',
    hostname: 'localhost',
    cleartext: true,
    allowNavigation: ['*'],
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: '#050505',
      showSpinner: false,
    },
    Keyboard: {
      resizeOnFullScreen: true,
    },
  },
} as const;

export default config;
