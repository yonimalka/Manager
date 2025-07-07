import 'dotenv/config';

export default {
  expo: {
    name: "Manager",
    slug: "Manager",
    version: "1.0.1",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.yonatanmalka.Manager",
      buildNumber: "4",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false
      }
    },
    android: {
      package: "com.yonatanmalka.Manager",
      versionCode: 2,
      permissions: ["INTERNET"],
      usesCleartextTraffic: false,
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      }
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    extra: {
      SERVER_URL: process.env.SERVER_URL,
      eas: {
        projectId: "a0b72a58-39e1-4ed6-8402-837f500c13e3"
      },
      projectId: "a0b72a58-39e1-4ed6-8402-837f500c13e3"
    },
    runtimeVersion: {
        android: "1.0.1",
        ios: "1.0.1",
    },
    updates: {
      url: "https://u.expo.dev/a0b72a58-39e1-4ed6-8402-837f500c13e3"
    }
  }
};