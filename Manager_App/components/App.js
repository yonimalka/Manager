import React, { useEffect } from "react";
import { I18nManager } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Updates from "expo-updates";
import { PostHogProvider } from "posthog-react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import MainApp from "./MainApp";
import { UndoToastProvider } from "./UndoToast";
import { usePostHogBridge } from "../utils/analytics";
import useNotificationTracking from "../utils/useNotificationTracking";
import * as Notifications from "expo-notifications";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const PostHogBridge = () => {
  usePostHogBridge();
  return null;
};

const App = () => {
  // ONE-TIME RTL RESET — undoes prior forced RTL on existing devices
  // Safe to remove after ~2 weeks once all users have run it once
  useEffect(() => {
    (async () => {
      try {
        if (I18nManager.isRTL) {
          I18nManager.allowRTL(false);
          I18nManager.forceRTL(false);
          await AsyncStorage.removeItem("maggo_rtl_forced");
          await Updates.reloadAsync();
        }
      } catch (e) {
        console.warn("[RTL Reset] failed:", e?.message);
      }
    })();
  }, []);

  useNotificationTracking();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <UndoToastProvider>
          <PostHogProvider
            apiKey="phc_wnUfWr7fZ5W27DR6uDQm7NV9XoQSNEDBtCdVxtnCLwye"
            options={{
              host: "https://us.i.posthog.com",
              enableSessionReplay: true,
              captureAppLifecycleEvents: true,
              errorTracking: { autocapture: true },
            }}
            autocapture={{
              captureTouches: true,
              captureLifecycleEvents: true,
              captureScreens: true,
            }}
          >
            <PostHogBridge />
            <MainApp />
          </PostHogProvider>
        </UndoToastProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

export default App;