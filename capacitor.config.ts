import type { CapacitorConfig } from '@capacitor/cli'
const config: CapacitorConfig = {
  appId: 'com.mailivewars.app',
  appName: 'Mai Live Wars',
  webDir: 'dist',
  bundledWebRuntime: false,
  ios: { contentInset: 'automatic' },
  android: { allowMixedContent: false },
}
export default config
