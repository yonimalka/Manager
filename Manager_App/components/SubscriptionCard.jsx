import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  getSubscriptionAccent,
  getSubscriptionLabel,
  hasProAccess,
} from "../services/subscription";

export default function SubscriptionCard({ subscription, onPress }) {
  const accent = getSubscriptionAccent(subscription);
  const label = getSubscriptionLabel(subscription);
  const active = hasProAccess(subscription);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={[
        styles.card,
        {
          backgroundColor: accent.background,
          borderColor: accent.border,
        },
      ]}
      onPress={onPress}
    >
      <View style={styles.left}>
        <View style={styles.iconWrap}>
          <Ionicons
            name={active ? "sparkles" : "lock-closed"}
            size={20}
            color={accent.text}
          />
        </View>
        <View style={styles.copy}>
          <Text style={[styles.title, { color: accent.text }]}>Maggo Pro</Text>
          <Text style={[styles.status, { color: accent.text }]}>{label}</Text>
          <Text style={styles.caption}>
            {active
              ? "Your premium features are ready to use."
              : "Start a 30-day trial and unlock premium features."}
          </Text>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={18} color={accent.text} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  left: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 2,
  },
  status: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4,
  },
  caption: {
    color: "#475569",
    fontSize: 12,
    lineHeight: 18,
  },
});
