import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Animated, AppState, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const BOTTOM_NAV_HEIGHT = 95; // BottomNavBar height:70 + bottom:25

const UndoContext = createContext(null);
export const useUndoToast = () => useContext(UndoContext);

export function UndoToastProvider({ children }) {
  const insets = useSafeAreaInsets();
  const counter = useRef(0);
  const pending = useRef({});  // id → { message, commit, onUndo, timer }
  const ids = useRef([]);      // insertion order, newest last
  const anim = useRef(new Animated.Value(0)).current;
  const [displayed, setDisplayed] = useState(null); // { id, message } | null
  const displayedRef = useRef(null);

  const animIn = useCallback(() => {
    Animated.timing(anim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, [anim]);

  const animOut = useCallback(() => {
    Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start(({ finished }) => {
      if (finished) {
        setDisplayed(null);
        displayedRef.current = null;
      }
    });
  }, [anim]);

  const updateDisplay = useCallback(() => {
    const latestId = ids.current[ids.current.length - 1] ?? null;
    if (!latestId) {
      animOut();
    } else {
      const entry = pending.current[latestId];
      const next = { id: latestId, message: entry.message };
      const wasShowing = displayedRef.current !== null;
      displayedRef.current = next;
      setDisplayed(next);
      if (!wasShowing) {
        anim.setValue(0);
        animIn();
      }
    }
  }, [anim, animIn, animOut]);

  const fireCommit = useCallback(async (id) => {
    const entry = pending.current[id];
    if (!entry) return;
    clearTimeout(entry.timer);
    delete pending.current[id];
    ids.current = ids.current.filter((x) => x !== id);
    await entry.commit();
    if (displayedRef.current?.id === id) updateDisplay();
  }, [updateDisplay]);

  const showUndo = useCallback(({ message, commit, onUndo, duration = 5000 }) => {
    const id = String(++counter.current);
    const timer = setTimeout(() => fireCommit(id), duration);
    pending.current[id] = { message, commit, onUndo, timer };
    ids.current.push(id);
    updateDisplay();
  }, [fireCommit, updateDisplay]);

  const handleUndo = useCallback(() => {
    const disp = displayedRef.current;
    if (!disp) return;
    const entry = pending.current[disp.id];
    if (!entry) return;
    clearTimeout(entry.timer);
    delete pending.current[disp.id];
    ids.current = ids.current.filter((x) => x !== disp.id);
    entry.onUndo?.();
    updateDisplay();
  }, [updateDisplay]);

  // Background/inactive → flush all pending commits immediately
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "background" && state !== "inactive") return;
      Object.values(pending.current).forEach((entry) => {
        clearTimeout(entry.timer);
        entry.commit();
      });
      pending.current = {};
      ids.current = [];
      anim.stopAnimation();
      anim.setValue(0);
      setDisplayed(null);
      displayedRef.current = null;
    });
    return () => sub.remove();
  }, [anim]);

  // Unmount → flush
  useEffect(() => {
    return () => {
      Object.values(pending.current).forEach((entry) => {
        clearTimeout(entry.timer);
        entry.commit();
      });
    };
  }, []);

  const bottom = insets.bottom + BOTTOM_NAV_HEIGHT + 12;

  const animStyle = {
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
  };

  return (
    <UndoContext.Provider value={{ showUndo }}>
      {children}
      <View
        pointerEvents="box-none"
        style={{ position: "absolute", left: 16, right: 16, bottom, zIndex: 1000 }}
      >
        {displayed && (
          <Animated.View
            style={[
              {
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "#0F172A",
                borderRadius: 14,
                paddingVertical: 14,
                paddingLeft: 16,
                paddingRight: 8,
                shadowColor: "#000",
                shadowOpacity: 0.25,
                shadowRadius: 20,
                shadowOffset: { width: 0, height: 8 },
                elevation: 8,
              },
              animStyle,
            ]}
          >
            <Text style={{ flex: 1, fontSize: 14, fontWeight: "600", color: "#fff" }} numberOfLines={1}>
              {displayed.message}
            </Text>
            <TouchableOpacity onPress={handleUndo} hitSlop={10} style={{ paddingHorizontal: 14, paddingVertical: 7 }}>
              <Text style={{ fontSize: 15, fontWeight: "700", color: "#34d399" }}>Undo</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>
    </UndoContext.Provider>
  );
}
