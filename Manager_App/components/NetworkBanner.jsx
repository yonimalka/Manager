import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, DeviceEventEmitter, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NETWORK_BANNER_SHOW, NETWORK_BANNER_HIDE } from "../services/api";

export default function NetworkBanner() {
  const { top } = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const translateY = useRef(new Animated.Value(-60)).current;

  const show = useCallback(() => {
    setVisible(true);
    Animated.timing(translateY, {
      toValue: 0,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [translateY]);

  const hide = useCallback(() => {
    Animated.timing(translateY, {
      toValue: -60,
      duration: 220,
      useNativeDriver: true,
    }).start(() => setVisible(false));
  }, [translateY]);

  useEffect(() => {
    const s1 = DeviceEventEmitter.addListener(NETWORK_BANNER_SHOW, show);
    const s2 = DeviceEventEmitter.addListener(NETWORK_BANNER_HIDE, hide);
    return () => { s1.remove(); s2.remove(); };
  }, [show, hide]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[styles.banner, { top, transform: [{ translateY }] }]}
      pointerEvents="none"
    >
      <Text style={styles.text}>You're offline. Retrying…</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 2000,
    backgroundColor: "#1E293B",
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  text: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
});
