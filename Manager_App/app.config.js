import 'dotenv/config';

const version = "1.0.1";

export default {
  expo: {
    name: "Maggo",
    slug: "Manager",  
    version: version,
    orientation: "portrait",
    icon: "./assets/mago-logo-transparent.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/mago-logo-transparent.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.yonatanmalka.Manager",
      usesAppleSignIn: true,
      buildNumber: "4",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
         NSCameraUsageDescription: "This app needs access to your camera to take receipts.",
        NSPhotoLibraryUsageDescription: "This app needs access to your photo library to select receipts."
      }
    },
    android: {
      package: "com.yonatanmalka.Manager",
      versionCode: 2,
      permissions: ["INTERNET"],
      usesCleartextTraffic: false,
      adaptiveIcon: {
        foregroundImage: "./assets/mago-logo-transparent.png",
        backgroundColor: "#ffffff"
      }
    },
    web: {
      favicon: "./assets/mago-logo-transparent.png"
    },
    extra: {
      SERVER_URL: process.env.SERVER_URL,
      eas: {
        projectId: "a0b72a58-39e1-4ed6-8402-837f500c13e3"
      },
      projectId: "a0b72a58-39e1-4ed6-8402-837f500c13e3"
    },
    plugins: [
      "expo-apple-authentication",
      "expo-web-browser",
      [
        "@react-native-google-signin/google-signin",
        {
          "iosUrlScheme": "com.googleusercontent.apps.717125560385-pg4scnvjueo0d674ha1epbal1v8f2ihv.apps.googleusercontent.com"
        }
      ]
    ],
    
    runtimeVersion: version,
    updates: {
      url: "https://u.expo.dev/a0b72a58-39e1-4ed6-8402-837f500c13e3"
    },
    
  }
};
