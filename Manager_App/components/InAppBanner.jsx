import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  DeviceEventEmitter,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { track } from "../utils/analytics";

export default function InAppBanner() {
  const { top } = useSafeAreaInsets();
  const [banner, setBanner] = useState(null);

  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity    = useRef(new Animated.Value(0)).current;
  const timerRef   = useRef(null);
  const visibleRef = useRef(false);
  // Stable mutable refs so PanResponder (created once) always calls the latest fn
  const hideRef   = useRef(null);
  const bannerRef = useRef(null); // mirrors state for tap handler

  const hide = useCallback(() => {
    if (!visibleRef.current) return;
    visibleRef.current = false;
    clearTimeout(timerRef.current);
    Animated.parallel([
      Animated.timing(translateY, { toValue: -120, duration: 200, useNativeDriver: true }),
      Animated.timing(opacity,    { toValue: 0,    duration: 200, useNativeDriver: true }),
    ]).start(() => setBanner(null));
  }, [translateY, opacity]);

  hideRef.current = hide;

  const show = useCallback((payload) => {
    clearTimeout(timerRef.current);
    bannerRef.current = payload;
    setBanner(payload);
    visibleRef.current = true;
    translateY.setValue(-120);
    opacity.setValue(0);
    Animated.parallel([
      Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(opacity,    { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    timerRef.current = setTimeout(() => hideRef.current?.(), 5000);
  }, [translateY, opacity]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("maggo:in-app-banner", show);
    return () => { sub.remove(); clearTimeout(timerRef.current); };
  }, [show]);

  const panResponder = useRef(
    PanResponder.create({
      // Only steal the gesture when the user clearly swipes up
      onMoveShouldSetPanResponder: (_, { dy, dx }) => dy < -5 && Math.abs(dy) > Math.abs(dx),
      onPanResponderMove: (_, { dy }) => {
        if (dy < 0) translateY.setValue(dy);
      },
      onPanResponderRelease: (_, { dy }) => {
        if (dy < -30) {
          hideRef.current?.();
        } else {
          Animated.spring(translateY, {
            toValue: 0, useNativeDriver: true, damping: 20, stiffness: 300,
          }).start();
        }
      },
    })
  ).current;

  // Tap the card → route action then hide (reads bannerRef for stability)
  const handleTap = useCallback(() => {
    const b = bannerRef.current;
    if (!b) return;
    const type = b.data?.type || "unknown";
    track("in_app_banner_tapped", { type });
    if (type === "payment_claimed") {
      DeviceEventEmitter.emit("maggo:open-claim", b.data?.invoiceId ?? null);
    }
    hideRef.current?.();
  }, []);

  if (!banner) return null;

  return (
    <Animated.View
      style={[styles.container, { top: top + 8 }, { transform: [{ translateY }], opacity }]}
      {...panResponder.panHandlers}
    >
      <TouchableOpacity activeOpacity={0.95} onPress={handleTap} style={styles.card}>
        <View style={styles.tile}>
          <Text style={styles.tileText}>M</Text>
        </View>
        <View style={{ flex: 1 }}>
          {!!banner.title && (
            <Text style={styles.title} numberOfLines={1}>{banner.title}</Text>
          )}
          {!!banner.body && (
            <Text style={styles.body} numberOfLines={2}>{banner.body}</Text>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 1000,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#0F172A",
    shadowOpacity: 0.12,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  tile: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  tileText: { fontSize: 15, fontWeight: "800", color: "#34D399" },
  title:    { fontSize: 14, fontWeight: "700", color: "#0F172A", marginBottom: 2 },
  body:     { fontSize: 14, lineHeight: 20, color: "#1E293B" },
});
