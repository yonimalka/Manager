import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
} from "react-native";
import api from "../services/api";

const WORK_TYPES = [
  { key: "freelancer", label: "Freelancer",        emoji: "🧑‍💻" },
  { key: "agency",     label: "Agency / Studio",   emoji: "🏢"   },
  { key: "trades",     label: "Trades & Services", emoji: "🔧"   },
  { key: "other",      label: "Something else",    emoji: "✦"    },
];

const WelcomeModal = ({ visible, onComplete, onEnter = () => {} }) => {
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);

  const slideAnim = useRef(new Animated.Value(500)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, bounciness: 4, speed: 14, useNativeDriver: true }),
      ]).start();
    } else {
      slideAnim.setValue(500);
      fadeAnim.setValue(0);
    }
  }, [visible]);

  const handleContinue = async () => {
    if (!selected || saving) return;
    setSaving(true);
    try {
      await api.post("/updateUser", { userType: selected });
    } catch (e) {
      console.error("WelcomeModal save error:", e);
    } finally {
      setSaving(false);
      onComplete(selected);
    }
  };

  return (
    <Modal visible={visible} animationType="none" transparent statusBarTranslucent>
      {/* Dim overlay — fades in */}
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]} />

      {/* Sheet — slides up */}
      <View style={styles.screenContainer}>
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>

          {/* Handle */}
          <View style={styles.handle} />

          {/* Question */}
          <Text style={styles.title}>What kind of work{"\n"}do you do?</Text>
          <Text style={styles.subtitle}>We'll set Maggo up to match</Text>

          {/* 2×2 tile grid */}
          <View style={styles.grid}>
            {WORK_TYPES.map((type) => {
              const isActive = selected === type.key;
              return (
                <TouchableOpacity
                  key={type.key}
                  style={[styles.tile, isActive && styles.tileActive]}
                  onPress={() => setSelected(type.key)}
                  activeOpacity={0.8}
                >
                  {/* Emoji + radio row */}
                  <View style={styles.tileTop}>
                    <Text style={styles.tileEmoji}>{type.emoji}</Text>
                    <View style={[styles.radio, isActive && styles.radioActive]}>
                      {isActive && <View style={styles.radioDot} />}
                    </View>
                  </View>
                  <Text style={[styles.tileLabel, isActive && styles.tileLabelActive]}>
                    {type.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* CTA */}
          <TouchableOpacity
            style={[styles.button, (!selected || saving) && styles.buttonDisabled]}
            onPress={handleContinue}
            disabled={!selected || saving}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.buttonText}>Let's go →</Text>
            }
          </TouchableOpacity>

        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
  },
  screenContainer: {
    flex: 1, justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 22, paddingTop: 10, paddingBottom: 44,
    shadowColor: "#000", shadowOpacity: 0.18,
    shadowRadius: 24, shadowOffset: { width: 0, height: -6 },
    elevation: 20,
  },
  handle: {
    width: 32, height: 4, borderRadius: 2,
    backgroundColor: "#D1D5DB",
    alignSelf: "center", marginBottom: 20,
  },
  title: {
    fontSize: 20, fontWeight: "800", color: "#111827",
    letterSpacing: -0.3, marginBottom: 4, lineHeight: 26,
  },
  subtitle: {
    fontSize: 13, color: "#9CA3AF",
    marginBottom: 18,
  },
  grid: {
    flexDirection: "row", flexWrap: "wrap",
    gap: 8, marginBottom: 16,
  },
  tile: {
    width: "48.5%",
    borderWidth: 1.5, borderColor: "#F1F5F9",
    backgroundColor: "#FAFAFA",
    borderRadius: 14, padding: 14,
    gap: 9,
  },
  tileActive: {
    borderColor: "#111827", backgroundColor: "#111827",
  },
  tileTop: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
  },
  tileEmoji: {
    fontSize: 22, lineHeight: 26,
  },
  radio: {
    width: 17, height: 17, borderRadius: 9,
    borderWidth: 1.5, borderColor: "#D1D5DB",
    alignItems: "center", justifyContent: "center",
  },
  radioActive: {
    borderColor: "#fff",
  },
  radioDot: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: "#fff",
  },
  tileLabel: {
    fontSize: 13, fontWeight: "700",
    color: "#1C1917", lineHeight: 17,
  },
  tileLabelActive: {
    color: "#fff",
  },
  button: {
    width: "100%", paddingVertical: 15,
    backgroundColor: "#111827",
    borderRadius: 13, alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.22,
  },
  buttonText: {
    color: "#fff", fontSize: 15, fontWeight: "700",
  },
});

export default WelcomeModal;
