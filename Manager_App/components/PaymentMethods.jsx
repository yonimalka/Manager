import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api from "../services/api";
import { track } from "../utils/analytics";
import { useAuth } from "./useAuth";

const METHODS = [
  {
    key: "paypalMe",
    label: "PayPal",
    icon: "wallet-outline",
    iconBg: "#EFF6FF",
    iconColor: "#1D4ED8",
    prefix: "paypal.me/",
    placeholder: "yourname",
  },
  {
    key: "venmo",
    label: "Venmo",
    icon: "at-circle-outline",
    iconBg: "#ECFEFF",
    iconColor: "#0E7490",
    prefix: "@",
    placeholder: "handle",
  },
  {
    key: "cashApp",
    label: "Cash App",
    icon: "cash-outline",
    iconBg: "#F0FDF4",
    iconColor: "#15803D",
    prefix: "$",
    placeholder: "cashtag",
  },
  {
    key: "zelle",
    label: "Zelle",
    icon: "flash-outline",
    iconBg: "#F5F3FF",
    iconColor: "#6D28D9",
    prefix: null,
    placeholder: "Email or phone",
  },
  {
    key: "bank",
    label: "Bank transfer",
    icon: "business-outline",
    iconBg: "#F8FAFC",
    iconBgBorder: "#E2E8F0",
    iconColor: "#334155",
    prefix: null,
    placeholder: "Account + routing, or sort code + account",
    multiline: true,
    bankNote: true,
  },
];

const METHOD_LABELS = {
  paypalMe: "PayPal",
  venmo: "Venmo",
  cashApp: "Cash App",
  zelle: "Zelle",
  bank: "Bank",
};

const EMPTY = { paypalMe: "", venmo: "", cashApp: "", zelle: "", bank: "" };

// Strip stored prefix so the input only shows the handle portion
function stripPrefix(key, raw) {
  if (!raw) return "";
  const v = raw.trim();
  if (key === "paypalMe") {
    return v
      .replace(/^https?:\/\/paypal\.me\/?/, "")
      .replace(/^paypal\.me\//, "")
      .replace(/^@/, "");
  }
  if (key === "venmo") return v.replace(/^@/, "");
  if (key === "cashApp") return v.replace(/^\$/, "");
  return v;
}

// Convert what the user typed back to the canonical stored value
function toStored(key, input) {
  const v = input.trim();
  if (!v) return "";
  if (key === "paypalMe") {
    return v
      .replace(/^https?:\/\/paypal\.me\/?/, "")
      .replace(/^paypal\.me\//, "")
      .replace(/^@/, "");
  }
  if (key === "venmo") return v.replace(/^@/, "");
  if (key === "cashApp") return "$" + v.replace(/^\$/, "");
  return v;
}

// Human-readable version of the stored value shown in the row
function displayValue(key, stored) {
  if (!stored) return "";
  const v = stored.trim();
  if (key === "paypalMe") {
    const handle = v
      .replace(/^https?:\/\/paypal\.me\/?/, "")
      .replace(/^paypal\.me\//, "")
      .replace(/^@/, "");
    return "paypal.me/" + handle;
  }
  if (key === "venmo") return "@" + v.replace(/^@/, "");
  return v;
}

export default function PaymentMethods() {
  const navigation = useNavigation();
  const { top } = useSafeAreaInsets();
  const { userDetails } = useAuth();

  const [values, setValues] = useState(EMPTY);
  const [expandedKey, setExpandedKey] = useState(null);
  const [editBuffer, setEditBuffer] = useState("");
  const [saving, setSaving] = useState(false);

  const inputRef = useRef(null);

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

  const toggleExpand = useCallback(
    (key) => {
      if (expandedKey === key) {
        setExpandedKey(null);
        return;
      }
      setExpandedKey(key);
      setEditBuffer(stripPrefix(key, values[key]));
      setTimeout(() => inputRef.current?.focus(), 80);
    },
    [expandedKey, values]
  );

  const commitEdit = useCallback(() => {
    if (!expandedKey) return;
    const stored = toStored(expandedKey, editBuffer);
    setValues((prev) => ({ ...prev, [expandedKey]: stored }));
    setExpandedKey(null);
  }, [expandedKey, editBuffer]);

  const removeMethod = useCallback(() => {
    if (!expandedKey) return;
    setValues((prev) => ({ ...prev, [expandedKey]: "" }));
    setExpandedKey(null);
  }, [expandedKey]);

  const handleSave = async () => {
    // Commit any open row before saving
    let finalValues = { ...values };
    if (expandedKey) {
      finalValues[expandedKey] = toStored(expandedKey, editBuffer);
    }
    setSaving(true);
    try {
      await api.patch("/users/payment-methods", finalValues);
      const count = Object.values(finalValues).filter(Boolean).length;
      track("payment_methods_saved", { count });
      navigation.goBack();
    } catch {
      Alert.alert("Error", "Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const savedMethods = METHODS.filter((m) => !!values[m.key]);
  const saveCount = savedMethods.length;
  const displayName = (userDetails?.businessName || userDetails?.name || "").trim();
  const firstName = displayName.split(/\s+/)[0] || "You";

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#F8FAFC" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ paddingTop: top + 8, paddingHorizontal: 16, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#0F172A" />
          </TouchableOpacity>
        </View>

        <Text style={s.headerTitle}>How clients pay you</Text>
        <Text style={s.headerBody}>
          Pick what you use. Each one becomes a button on your pay links.
        </Text>

        {/* Preview card */}
        <View style={s.previewCard}>
          <Text style={s.previewLabel}>YOUR CLIENT SEES</Text>
          <View style={s.previewInner}>
            <Text style={s.previewLine}>
              {"Pay "}
              <Text style={{ fontWeight: "700" }}>{firstName}</Text>
              {"  "}
              <Text style={{ fontWeight: "800", color: "#0F172A" }}>$200.00</Text>
            </Text>
            {savedMethods.length === 0 ? (
              <View style={s.previewPlaceholder}>
                <Text style={s.previewPlaceholderText}>Your payment buttons appear here</Text>
              </View>
            ) : (
              <View style={s.previewBtnRow}>
                {savedMethods.map((m, i) => (
                  <View
                    key={m.key}
                    style={[s.previewBtn, i === 0 ? s.previewBtnDark : s.previewBtnOutline]}
                  >
                    <Text style={[s.previewBtnText, i !== 0 && s.previewBtnTextOutline]}>
                      {METHOD_LABELS[m.key]}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Methods card */}
        <View style={s.methodsCard}>
          {METHODS.map((m, i) => {
            const isExpanded = expandedKey === m.key;
            const hasValue = !!values[m.key];
            const dispVal = displayValue(m.key, values[m.key]);

            return (
              <View key={m.key} style={[s.methodRow, i > 0 && s.methodRowBorder]}>
                {/* Main row */}
                <View style={s.methodMain}>
                  <View
                    style={[
                      s.methodIcon,
                      { backgroundColor: m.iconBg },
                      m.iconBgBorder && { borderWidth: 1, borderColor: m.iconBgBorder },
                    ]}
                  >
                    <Ionicons name={m.icon} size={18} color={m.iconColor} />
                  </View>

                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.methodLabel}>{m.label}</Text>
                    {!hasValue ? (
                      <Text style={s.methodNotAdded}>
                        {m.bankNote ? "Not added · shown with a Copy button" : "Not added"}
                      </Text>
                    ) : (
                      <Text numberOfLines={1} style={s.methodValue}>{dispVal}</Text>
                    )}
                  </View>

                  <TouchableOpacity onPress={() => toggleExpand(m.key)} style={s.addEditBtn}>
                    <Text style={s.addEditText}>{hasValue ? "Edit" : "+ Add"}</Text>
                  </TouchableOpacity>
                </View>

                {/* Expanded input */}
                {isExpanded && (
                  <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
                    <View style={[s.inputRow, m.multiline && s.inputRowMulti]}>
                      {m.prefix && (
                        <View style={s.prefixBox}>
                          <Text style={s.prefixText}>{m.prefix}</Text>
                        </View>
                      )}
                      <TextInput
                        ref={inputRef}
                        value={editBuffer}
                        onChangeText={setEditBuffer}
                        placeholder={m.placeholder}
                        placeholderTextColor="#94A3B8"
                        autoCapitalize="none"
                        autoCorrect={false}
                        multiline={m.multiline}
                        numberOfLines={m.multiline ? 2 : 1}
                        style={[
                          s.inputField,
                          !m.prefix && { paddingLeft: 14 },
                          m.multiline && s.inputFieldMulti,
                        ]}
                      />
                      <TouchableOpacity onPress={commitEdit} style={s.doneBtn}>
                        <Text style={s.doneBtnText}>Done</Text>
                      </TouchableOpacity>
                    </View>
                    {hasValue && (
                      <TouchableOpacity onPress={removeMethod} style={{ marginTop: 8, alignSelf: "flex-start" }}>
                        <Text style={s.removeText}>Remove</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Sticky footer */}
      <View style={[s.footer, { paddingBottom: Platform.OS === "ios" ? 28 : 16 }]}>
        <TouchableOpacity
          style={[s.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={s.saveBtnText}>
            {saving
              ? "Saving…"
              : saveCount === 0
              ? "Save"
              : `Save · ${saveCount} way${saveCount !== 1 ? "s" : ""} to pay`}
          </Text>
        </TouchableOpacity>
        <Text style={s.footerCaption}>Maggo never touches the money.</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#0F172A",
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  headerBody: {
    fontSize: 15,
    color: "#475569",
    lineHeight: 22,
    marginBottom: 20,
  },

  previewCard: {
    backgroundColor: "#EEF2F7",
    borderRadius: 20,
    padding: 12,
    marginBottom: 16,
  },
  previewLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: "#475569",
    marginBottom: 8,
  },
  previewInner: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  previewLine: { fontSize: 14, color: "#475569" },
  previewBtnRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  previewBtn: {
    height: 34,
    borderRadius: 10,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  previewBtnDark: { backgroundColor: "#0F172A" },
  previewBtnOutline: { borderWidth: 1.5, borderColor: "#0F172A" },
  previewBtnText: { fontSize: 13, fontWeight: "600", color: "#FFFFFF" },
  previewBtnTextOutline: { color: "#0F172A" },
  previewPlaceholder: {
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    borderStyle: "dashed",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  previewPlaceholderText: { fontSize: 13, color: "#94A3B8" },

  methodsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
    marginBottom: 16,
  },
  methodRow: { minHeight: 60 },
  methodRowBorder: { borderTopWidth: 1, borderTopColor: "#F1F5F9" },
  methodMain: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  methodIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  methodLabel: { fontSize: 15, fontWeight: "600", color: "#0F172A" },
  methodNotAdded: { fontSize: 13, color: "#64748B", marginTop: 1 },
  methodValue: { fontSize: 13, color: "#047857", marginTop: 1 },
  addEditBtn: { paddingLeft: 4 },
  addEditText: { fontSize: 15, fontWeight: "600", color: "#2563EB" },

  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 48,
    borderWidth: 1.5,
    borderColor: "#0F172A",
    borderRadius: 12,
    overflow: "hidden",
  },
  inputRowMulti: {
    height: undefined,
    minHeight: 52,
    alignItems: "flex-start",
    paddingVertical: 4,
  },
  prefixBox: {
    backgroundColor: "#F1F5F9",
    alignSelf: "stretch",
    paddingHorizontal: 12,
    justifyContent: "center",
    borderRightWidth: 1.5,
    borderRightColor: "#0F172A",
  },
  prefixText: { fontSize: 16, fontWeight: "600", color: "#475569" },
  inputField: {
    flex: 1,
    fontSize: 16,
    color: "#0F172A",
    paddingHorizontal: 12,
    paddingVertical: 0,
  },
  inputFieldMulti: {
    paddingTop: 8,
    textAlignVertical: "top",
  },
  doneBtn: {
    height: 36,
    marginRight: 6,
    marginTop: 6,
    paddingHorizontal: 14,
    borderRadius: 9,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    alignSelf: "flex-start",
  },
  doneBtnText: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
  removeText: { fontSize: 13, fontWeight: "600", color: "#B91C1C" },

  footer: {
    backgroundColor: "#F8FAFC",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  saveBtn: {
    height: 56,
    borderRadius: 18,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  saveBtnText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
  footerCaption: { fontSize: 13, color: "#64748B", textAlign: "center" },
});
