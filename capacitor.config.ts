import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jugaadvisuals.app',
  appName: 'Jugaad Visuals',
  webDir: 'dist',
  backgroundColor: '#050505',
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#050505',
      showSpinner: false,
    },
    Keyboard: {
      resizeOnFullScreen: true,
    },
  },
};

export default config;
