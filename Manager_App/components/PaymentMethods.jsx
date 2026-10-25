import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api from "../services/api";
import { track } from "../utils/analytics";
import { useAuth } from "./useAuth";

const METHODS = [
  { key: "paypalMe", label: "PayPal.me", placeholder: "paypal.me/yourname" },
  { key: "venmo",    label: "Venmo",     placeholder: "@handle" },
  { key: "cashApp",  label: "Cash App",  placeholder: "$cashtag" },
  { key: "zelle",    label: "Zelle",     placeholder: "Email or phone" },
  { key: "bank",     label: "Bank",      placeholder: "Account + routing, or sort code + account" },
];

const EMPTY = { paypalMe: "", venmo: "", cashApp: "", zelle: "", bank: "" };

export default function PaymentMethods() {
  const navigation = useNavigation();
  const route = useRoute();
  const { top } = useSafeAreaInsets();
  const { userDetails } = useAuth();
  const fromReminder = route.params?.fromReminder;

  const [values, setValues] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const pm = userDetails?.paymentMethods;
    if (pm) {
      setValues({
        paypalMe: pm.paypalMe || "",
        venmo:    pm.venmo    || "",
        cashApp:  pm.cashApp  || "",
        zelle:    pm.zelle    || "",
        bank:     pm.bank     || "",
      });
    }
  }, [userDetails]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch("/users/payment-methods", values);
      const count = Object.values(values).filter(Boolean).length;
      track("payment_methods_saved", { count });
      navigation.goBack();
    } catch {
      Alert.alert("Error", "Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#F8FAFC" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ paddingTop: top + 16, paddingHorizontal: 22, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 24 }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0", alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons name="arrow-back" size={20} color="#0F172A" />
          </TouchableOpacity>
          {fromReminder && (
            <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginLeft: "auto" }}>
              <Text style={{ fontSize: 15, color: "#64748B" }}>Skip</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={{ fontSize: 26, fontWeight: "700", color: "#0F172A", marginBottom: 8, letterSpacing: -0.5 }}>
          How do clients pay you?
        </Text>
        <Text style={{ fontSize: 16, color: "#64748B", lineHeight: 24, marginBottom: 28 }}>
          Add at least one. It shows on your pay links. Maggo never touches the money.
        </Text>

        <View style={{ backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#E2E8F0", overflow: "hidden", marginBottom: 28 }}>
          {METHODS.map((m, i) => (
            <View
              key={m.key}
              style={[
                { flexDirection: "row", alignItems: "center", minHeight: 58, paddingHorizontal: 16 },
                i > 0 && { borderTopWidth: 1, borderTopColor: "#F1F5F9" },
              ]}
            >
              <Text style={{ width: 92, fontSize: 15, fontWeight: "600", color: "#0F172A" }}>{m.label}</Text>
              <TextInput
                value={values[m.key]}
                onChangeText={(t) => setValues((prev) => ({ ...prev, [m.key]: t }))}
                placeholder={m.placeholder}
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                autoCorrect={false}
                style={{ flex: 1, fontSize: 16, color: "#0F172A", paddingVertical: 10 }}
              />
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={{
            height: 56,
            borderRadius: 18,
            backgroundColor: saving ? "#94A3B8" : "#0F172A",
            alignItems: "center",
            justifyContent: "center",
          }}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#fff" }}>
            {saving ? "Saving…" : "Save"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
