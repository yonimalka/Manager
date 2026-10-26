import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet } from "react-native";

const TRACK_W = 51;
const TRACK_H = 31;
const THUMB = 27;
const INSET = 2;
// How far the thumb travels from left-inset to right-inset
const TRAVEL = TRACK_W - THUMB - INSET * 2; // 20

export default function Toggle({ value, onValueChange, disabled, accessibilityLabel }) {
  const thumbX = useRef(new Animated.Value(value ? TRAVEL : 0)).current;
  const colorProg = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(thumbX, {
      toValue: value ? TRAVEL : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
    Animated.timing(colorProg, {
      toValue: value ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [value]);

  const trackBg = colorProg.interpolate({
    inputRange: [0, 1],
    outputRange: ["#CBD5E1", "#15803D"],
  });

  return (
    <Pressable
      onPress={() => !disabled && onValueChange?.(!value)}
      hitSlop={8}
      accessibilityRole="switch"
      accessibilityState={{ checked: !!value, disabled: !!disabled }}
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View style={[styles.track, { backgroundColor: trackBg }]}>
        <Animated.View
          style={[styles.thumb, { transform: [{ translateX: thumbX }] }]}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    paddingHorizontal: INSET,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000000",
    shadowOpacity: 0.2,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
});
