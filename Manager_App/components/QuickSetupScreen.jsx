import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import api from "../services/api";

const CURRENCIES = [
  { code: "USD", locale: "en-US", label: "🇺🇸 USD" },
  { code: "GBP", locale: "en-GB", label: "🇬🇧 GBP" },
  { code: "EUR", locale: "de-DE", label: "🇪🇺 EUR" },
  { code: "ILS", locale: "he-IL", label: "🇮🇱 ILS" },
];

const QuickSetupScreen = () => {
  const navigation = useNavigation();
  const [businessName, setBusinessName] = useState("");
  const [selectedCurrency, setSelectedCurrency] = useState("USD");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleContinue = async () => {
    if (!selectedCurrency) {
      setError("Please select your currency.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const selected = CURRENCIES.find((c) => c.code === selectedCurrency);
      await api.post("/updateUser", {
        businessName: businessName.trim(),
        currency: selected.code,
        locale: selected.locale,
      });

      navigation.reset({ index: 0, routes: [{ name: "HomeScreen" }] });
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    navigation.reset({ index: 0, routes: [{ name: "HomeScreen" }] });
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Skip */}
        <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Ionicons name="rocket-outline" size={36} color="#3B82F6" />
          </View>
          <Text style={styles.title}>Quick setup</Text>
          <Text style={styles.subtitle}>
            Two things and you're in. You can change these any time from your profile.
          </Text>
        </View>

        {/* Card */}
        <View style={styles.card}>

          {/* Business Name */}
          <View style={styles.field}>
            <Text style={styles.label}>Business Name</Text>
            <Text style={styles.hint}>What should appear on your invoices?</Text>
            <TextInput
              style={styles.input}
              value={businessName}
              onChangeText={setBusinessName}
              placeholder="e.g. Johnson Electrical"
              placeholderTextColor="#9CA3AF"
              returnKeyType="done"
            />
          </View>

          {/* Currency */}
          <View style={styles.field}>
            <Text style={styles.label}>Currency</Text>
            <Text style={styles.hint}>Used across invoices and cash flow.</Text>
            <View style={styles.chips}>
              {CURRENCIES.map((item) => {
                const active = selectedCurrency === item.code;
                return (
                  <Pressable
                    key={item.code}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setSelectedCurrency(item.code)}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {error ? (
            <Text style={styles.error}>{error}</Text>
          ) : null}

          {/* Continue Button */}
          <TouchableOpacity
            onPress={handleContinue}
            activeOpacity={0.88}
            disabled={loading}
            style={styles.btnWrapper}
          >
            <LinearGradient
              colors={loading ? ["#93C5FD", "#93C5FD"] : ["#3B82F6", "#2563EB"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.btn}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.btnText}>Let's go</Text>
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FAFBFF",
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === "ios" ? 70 : 50,
    paddingBottom: 40,
  },
  skipBtn: {
    alignSelf: "flex-end",
    paddingVertical: 6,
    paddingHorizontal: 4,
    marginBottom: 32,
  },
  skipText: {
    fontSize: 15,
    color: "#9CA3AF",
    fontWeight: "600",
  },

  // Header
  header: {
    alignItems: "center",
    marginBottom: 36,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 24,
  },

  // Card
  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },

  // Fields
  field: {
    marginBottom: 28,
  },
  label: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  hint: {
    fontSize: 13,
    color: "#9CA3AF",
    marginBottom: 12,
  },
  input: {
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    paddingVertical: 15,
    paddingHorizontal: 16,
    fontSize: 15,
    color: "#111827",
  },

  // Currency chips
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
  },
  chipActive: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },
  chipText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  chipTextActive: {
    color: "#fff",
  },

  error: {
    color: "#EF4444",
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 16,
    textAlign: "center",
  },

  // Button
  btnWrapper: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#3B82F6",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 17,
    borderRadius: 16,
  },
  btnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});

export default QuickSetupScreen;
