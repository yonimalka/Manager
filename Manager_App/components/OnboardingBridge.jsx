import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const TYPE_CONFIG = {
  freelancer: {
    icon: "person-outline",
    sentence: "Maggo is built for freelancers like you. Here's your workspace.",
  },
  agency: {
    icon: "business-outline",
    sentence: "Maggo helps agencies manage clients, campaigns, and cash — in one place.",
  },
  trades: {
    icon: "construct-outline",
    sentence: "Maggo helps trades pros track jobs, expenses, and invoices — all in one place.",
  },
  other: {
    icon: "ellipsis-horizontal-outline",
    sentence: "Maggo keeps your business organized from day one. Here's your workspace.",
  },
};

const FEATURE_PILLS = [
  { icon: "briefcase-outline",  label: "Projects",  desc: "Track your jobs"   },
  { icon: "receipt-outline",    label: "Expenses",  desc: "Log receipts"      },
  { icon: "cash-outline",       label: "Invoices",  desc: "Get paid faster"   },
];

const OnboardingBridge = ({ visible, userType, onEnter }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const config = TYPE_CONFIG[userType] || TYPE_CONFIG.other;

  useEffect(() => {
    if (visible) {
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 320,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <View style={styles.backdrop}> 
        <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
          {/* Work type icon */}
          <View style={styles.iconCircle}>
            <Ionicons name={config.icon} size={36} color="#3B82F6" />
          </View>

          {/* Contextual sentence */}
          {/* <Text style={styles.sentence}>{config.sentence}</Text> */}

          {/* Feature pills */}
          {/* <View style={styles.pillsRow}>
            {FEATURE_PILLS.map((pill) => (
              <View key={pill.label} style={styles.pill}>
                <View style={styles.pillIconWrap}>
                  <Ionicons name={pill.icon} size={18} color="#3B82F6" />
                </View>
                <Text style={styles.pillLabel}>{pill.label}</Text>
                <Text style={styles.pillDesc}>{pill.desc}</Text>
              </View>
            ))}
          </View> */}

          {/* CTA */}
          {/* <TouchableOpacity style={styles.button} onPress={onEnter} activeOpacity={0.85}>
            <Text style={styles.buttonText}>Take me in</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />
          </TouchableOpacity> */}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    width: "88%",
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  sentence: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 28,
    paddingHorizontal: 4,
  },
  pillsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 28,
    width: "100%",
  },
  pill: {
    flex: 1,
    backgroundColor: "#F8FAFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E0EAFF",
    padding: 12,
    alignItems: "center",
    gap: 6,
  },
  pillIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  pillLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },
  pillDesc: {
    fontSize: 10,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 14,
  },
  button: {
    width: "100%",
    backgroundColor: "#3B82F6",
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#3B82F6",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
});

export default OnboardingBridge;
