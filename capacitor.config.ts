import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.nakedstories.reader',
  appName: 'Naked Stories',
  webDir: 'dist',
  server: {
    // Match how the WebView loads bundled assets (avoids mixed-content quirks)
    androidScheme: 'https',
  },
}

export default config
