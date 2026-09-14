import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jugaadvisuals.app',
  appName: 'Jugaad Visuals',
  webDir: 'dist',
  backgroundColor: '#050505',
  android: {
    allowMixedContent: true,
    backgroundColor: '#050505',
  },
  server: {
    androidScheme: 'https',
    hostname: 'jugaadvision.vercel.app',
    cleartext: true,
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
