import type { CapacitorConfig } from '@capacitor/cli'
const config: CapacitorConfig = {
  appId: 'com.maicorp.lifewars',
  appName: 'MAI Life Wars',
  webDir: 'dist',
  bundledWebRuntime: false,
  ios: { contentInset: 'automatic' },
  android: { allowMixedContent: false },
}
export default config
