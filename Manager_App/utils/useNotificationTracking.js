import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { track } from "./analytics";

const LAST_KEY = "maggo_last_notification_response";

const props = (n, extra = {}) => {
  const data = n?.request?.content?.data || {};
  return { type: data.type || "unknown", invoiceId: data.invoiceId || null, ...extra };
};

export default function useNotificationTracking() {
  useEffect(() => {
    // Tap that launched the app from a closed state (dedupe: this API keeps returning the last response)
    Notifications.getLastNotificationResponseAsync().then(async (res) => {
      if (!res) return;
      const id = res.notification?.request?.identifier;
      const seen = await AsyncStorage.getItem(LAST_KEY);
      if (id && id !== seen) {
        await AsyncStorage.setItem(LAST_KEY, id);
        track("notification_opened", props(res.notification, { coldStart: true }));
      }
    }).catch(() => {});

    // Tap while the app is running or in the background
    const tapSub = Notifications.addNotificationResponseReceivedListener((res) => {
      const id = res.notification?.request?.identifier;
      if (id) AsyncStorage.setItem(LAST_KEY, id);
      track("notification_opened", props(res.notification, { coldStart: false }));
    });

    // Arrived while the app was open
    const recvSub = Notifications.addNotificationReceivedListener((n) => {
      track("notification_received_foreground", props(n));
    });

    return () => { tapSub.remove(); recvSub.remove(); };
  }, []);
}
