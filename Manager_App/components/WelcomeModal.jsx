import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../services/api";

const WORK_TYPES = [
  {
    key: "freelancer",
    label: "Freelancer",
    icon: "person-outline",
    description: "Independent contractor or solo professional",
  },
  {
    key: "agency",
    label: "Agency / Studio",
    icon: "business-outline",
    description: "Team-based creative or digital agency",
  },
  {
    key: "trades",
    label: "Trades & Services",
    icon: "construct-outline",
    description: "Construction, renovation, or skilled trades",
  },
  {
    key: "other",
    label: "Other",
    icon: "ellipsis-horizontal-outline",
    description: "Something else entirely",
  },
];

const WelcomeModal = ({ visible, onComplete }) => {
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleContinue = async () => {
    if (!selected || saving) return;
    setSaving(true);
    try {
      await AsyncStorage.setItem("maggo_user_type", selected);
      await AsyncStorage.setItem("maggo_onboarding_complete", "true");
      await api.post("/updateUser", { userType: selected });
    } catch (e) {
      console.error("WelcomeModal save error:", e);
    } finally {
      setSaving(false);
      onComplete(selected);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.iconCircle}>
            <Ionicons name="briefcase-outline" size={34} color="#3B82F6" />
          </View>
          <Text style={styles.title}>Welcome to Maggo</Text>
          <Text style={styles.subtitle}>What kind of work do you do?</Text>

          {/* Options */}
          <View style={styles.optionsList}>
            {WORK_TYPES.map((type) => {
              const isActive = selected === type.key;
              return (
                <TouchableOpacity
                  key={type.key}
                  style={[styles.option, isActive && styles.optionActive]}
                  onPress={() => setSelected(type.key)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.optionIcon, isActive && styles.optionIconActive]}>
                    <Ionicons
                      name={type.icon}
                      size={22}
                      color={isActive ? "#fff" : "#6B7280"}
                    />
                  </View>
                  <View style={styles.optionText}>
                    <Text style={[styles.optionLabel, isActive && styles.optionLabelActive]}>
                      {type.label}
                    </Text>
                    <Text style={styles.optionDesc}>{type.description}</Text>
                  </View>
                  {isActive && (
                    <Ionicons name="checkmark-circle" size={22} color="#3B82F6" />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* CTA */}
          <TouchableOpacity
            style={[styles.button, (!selected || saving) && styles.buttonDisabled]}
            onPress={handleContinue}
            disabled={!selected || saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.buttonText}>Let's go</Text>
            )}
          </TouchableOpacity>
        </View>
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
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 6,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 24,
  },
  optionsList: {
    width: "100%",
    gap: 10,
    marginBottom: 24,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    gap: 12,
  },
  optionActive: {
    borderColor: "#3B82F6",
    backgroundColor: "#EFF6FF",
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  optionIconActive: {
    backgroundColor: "#3B82F6",
  },
  optionText: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 2,
  },
  optionLabelActive: {
    color: "#1D4ED8",
  },
  optionDesc: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  button: {
    width: "100%",
    backgroundColor: "#3B82F6",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: "#3B82F6",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  buttonDisabled: {
    backgroundColor: "#93C5FD",
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
});

export default WelcomeModal;
