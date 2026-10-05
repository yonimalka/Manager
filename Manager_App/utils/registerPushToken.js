import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import api from "../services/api";
import { track } from "./analytics";

let hasRegisteredThisSession = false;

export async function registerPushToken() {
  if (hasRegisteredThisSession) return;

  if (!Device.isDevice) {
    console.log("[PUSH] Skipping — simulator detected");
    return;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    track("push_permission_denied");
    console.log("[PUSH] Permission denied");
    return;
  }
  track("push_permission_granted");

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
  const token = tokenData.data;

  try {
    await api.post("/user/push-token", { token });
    console.log("[PUSH] Token saved:", token);
  } catch (err) {
    console.error("[PUSH] Failed to save token:", err.message);
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  hasRegisteredThisSession = true;
}
