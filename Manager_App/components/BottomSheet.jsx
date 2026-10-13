import React, { useEffect, useRef } from "react";
import { Modal, View, Pressable, Animated, Platform, KeyboardAvoidingView, ScrollView } from "react-native";

export default function BottomSheet({ visible, onClose, children }) {
  const y = useRef(new Animated.Value(600)).current;
  useEffect(() => {
    if (visible) {
      y.setValue(600);
      Animated.spring(y, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220, mass: 0.9 }).start();
    }
  }, [visible]);
  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>
          <Animated.View style={{ transform: [{ translateY: y }], backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: Platform.OS === "ios" ? 44 : 28, paddingHorizontal: 22 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "#E5E7EB", alignSelf: "center", marginTop: 12, marginBottom: 20 }} />
            <ScrollView keyboardShouldPersistTaps="handled" bounces={false} style={{ maxHeight: "100%" }}>
              {children}
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
