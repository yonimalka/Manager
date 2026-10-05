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
      style={[styles.card, { backgroundColor: accent.background, borderColor: accent.border }]}
      onPress={onPress}
    >
      <View style={[styles.iconWrap, { backgroundColor: accent.border }]}>
        <Ionicons
          name={active ? "sparkles" : "lock-closed"}
          size={16}
          color={accent.text}
        />
      </View>

      <View style={styles.copy}>
        <Text style={[styles.label, { color: accent.text }]}>{label}</Text>
        <Text style={[styles.caption, { color: accent.text }]} numberOfLines={1}>
          {active ? "Premium features active" : "Upgrade to unlock all features"}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={14} color={accent.text} style={{ opacity: 0.5 }} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.75,
  },
  copy: {
    flex: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 1,
  },
  caption: {
    fontSize: 11,
    opacity: 0.7,
  },
});
