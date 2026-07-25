import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.shreekrishna.collector',
  appName: 'SK Association Collector',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
