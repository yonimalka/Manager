import { useEffect } from "react";
import { usePostHog } from "posthog-react-native";

// PostHog is now provided by <PostHogProvider> in App.js.
// Use these helpers to interact with it from anywhere in the tree.

let posthogInstance = null;

export const setPostHogInstance = (instance) => {
  posthogInstance = instance;
};

export const track = (event, properties = {}) => {
  if (!posthogInstance) {
    console.warn("[Analytics] posthog not initialized — event dropped:", event);
    return;
  }
  console.log("[Analytics] capturing:", event, properties);
  try {
    posthogInstance.capture(event, properties);
  } catch (e) {
    console.warn("[Analytics] capture failed:", e?.message);
  }
};

export const identifyUser = (userId, traits = {}) => {
  if (!posthogInstance || !userId) return;
  try {
    posthogInstance.identify(userId, traits);
  } catch (e) {
    console.warn("[Analytics] identify failed:", e?.message);
  }
};

export const resetAnalytics = () => {
  if (!posthogInstance) return;
  try {
    posthogInstance.reset();
  } catch (e) {
    console.warn("[Analytics] reset failed:", e?.message);
  }
};

// Mount once inside <PostHogProvider> tree to sync the instance into helpers above
export const usePostHogBridge = () => {
  const posthog = usePostHog();

  useEffect(() => {
    if (posthog) {
      setPostHogInstance(posthog);
      console.log("[Analytics] Bridge captured PostHog instance");
    } else {
      console.log("[Analytics] Bridge waiting — PostHog still null");
    }
  }, [posthog]);

  return posthog;
};
