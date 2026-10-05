import React, { useEffect } from "react";
import { I18nManager } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Updates from "expo-updates";
import * as Notifications from "expo-notifications";
import { PostHogProvider } from "posthog-react-native";
import MainApp from "./MainApp";
import { usePostHogBridge, track } from "../utils/analytics";

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

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(() => {
      track("notification_tapped");
    });
    return () => sub.remove();
  }, []);

  return (
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
  );
};

export default App;