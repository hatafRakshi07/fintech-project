import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.shreekrishna.association',
  appName: 'Shree Krishna Association',
  webDir: 'dist/public',
  server: {
    androidScheme: 'https'
  }
};

export default config;
