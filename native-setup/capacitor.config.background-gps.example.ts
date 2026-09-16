import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.datscogo.app",
  appName: "DatscoGo",
  webDir: "dist/public",
  android: {
    // Required by @capacitor-community/background-geolocation so Android
    // does not stop the background watcher after a few minutes.
    useLegacyBridge: true,
  },
};

export default config;
