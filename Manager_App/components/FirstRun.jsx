import React, { useEffect, useState } from "react";
import {
  Alert,
  InputAccessoryView,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import api from "../services/api";
import { formatCurrency } from "../services/formatCurrency";
import { track } from "../utils/analytics";
import { registerPushToken, registerPushTokenIfGranted } from "../utils/registerPushToken";
import { useAuth } from "./useAuth";
import { toIntl } from "./OwedSection";

// ── Helpers ──────────────────────────────────────────────────────────────────

const DUE_OPTIONS = [
  { key: "late",   label: "Already late" },
  { key: "week",   label: "This week" },
  { key: "two",    label: "2 weeks" },
  { key: "thirty", label: "30 days" },
];

const buildMsg = ({ client, amount, description, dueDate }, userName, currency, locale) => {
  const clientFirst = (client || "there").trim().split(/\s+/)[0];
  const userFirst   = (userName || "").trim().split(/\s+/)[0] || "";
  const amt         = formatCurrency(amount || 0, currency, locale);
  const descPart    = description ? ` for ${description}` : "";
  const due         = dueDate ? new Date(dueDate) : null;
  const future      = due && due > new Date();
  const dateStr     = due ? due.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
  const timePart    = future ? `is due ${dateStr}` : "is now due";
  return `Hi ${clientFirst}, a friendly reminder that the ${amt}${descPart} ${timePart}. Thanks, ${userFirst}`;
};

const buildWaUrl = (phone, msg, region) => {
  const intl    = toIntl(phone, region);
  const encoded = encodeURIComponent(msg);
  return intl ? `https://wa.me/${intl}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function FirstRun({ visible, userName, onDone }) {
  const { userDetails } = useAuth();
  const { top }        = useSafeAreaInsets();

  const currency = userDetails?.currency        || "USD";
  const locale   = userDetails?.locale          || "en-US";
  const region   = userDetails?.address?.country || "US";
  const symbol   = userDetails?.currencySymbol  || "$";
  const firstName = (userName || "").trim().split(/\s+/)[0] || "";

  const [screen,      setScreen]      = useState("ask");
  const [amount,      setAmount]      = useState("");
  const [client,      setClient]      = useState("");
  const [description, setDescription] = useState("");
  const [phone,       setPhone]       = useState("");
  const [due,         setDue]         = useState("late");
  const [saving,      setSaving]      = useState(false);
  const [invoice,     setInvoice]     = useState(null);
  const [pushStatus,  setPushStatus]  = useState(null);

  useEffect(() => {
    if (visible) {
      track("first_run_viewed");
      setScreen("ask");
      setAmount(""); setClient(""); setDescription(""); setPhone(""); setDue("late");
      setInvoice(null); setSaving(false); setPushStatus(null);
    }
  }, [visible]);

  useEffect(() => {
    if (screen === "remind") {
      Notifications.getPermissionsAsync().then(({ status }) => setPushStatus(status));
    }
  }, [screen]);

  const fmt = (n) => formatCurrency(n || 0, currency, locale);

  const dueBody = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    switch (due) {
      case "late":   return { dueDate: yesterday.toISOString() };
      case "week":   return { dueDays: 7 };
      case "two":    return { dueDays: 14 };
      case "thirty": return { dueDays: 30 };
      default:       return { dueDate: yesterday.toISOString() };
    }
  };

  const handleAdd = async () => {
    if (!amount || !client.trim()) return;
    setSaving(true);
    try {
      const body = {
        client:  client.trim(),
        amount:  Number(amount),
        ...dueBody(),
        ...(phone.trim()       ? { clientPhone:  phone.trim()        } : {}),
        ...(description.trim() ? { description:  description.trim()  } : {}),
      };
      const res   = await api.post("/invoices", body);
      const saved = res.data?.invoice || res.data;
      setInvoice(saved);
      track("first_run_owed_added", { amount: Number(amount), due });
      setScreen("remind");
    } catch (_) {
      Alert.alert("Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleWhatsApp = async () => {
    const msg = buildMsg(
      { client, amount: Number(amount), description, dueDate: invoice?.dueDate },
      userName, currency, locale
    );
    const url = buildWaUrl(phone, msg, region);
    try {
      await Linking.openURL(url);
      try { await api.patch(`/invoices/${invoice._id}/remind`); } catch (_) {}
      track("first_run_reminder_sent");
    } catch (_) {
      Alert.alert("Couldn't open WhatsApp", "Make sure it's installed.");
    }
  };

  const scheduleLocalNotif = async () => {
    const trigger = new Date();
    trigger.setDate(trigger.getDate() + 3);
    trigger.setHours(9, 0, 0, 0);
    const invoiceId = invoice?._id || null;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Has ${client.trim().split(/\s+/)[0]} paid?`,
        body:  `${fmt(Number(amount))} for ${description.trim() || "your job"} is still open in Maggo.`,
        data:  { type: "owed_nudge", invoiceId },
      },
      trigger,
    });
    track("notification_scheduled", { type: "owed_nudge", invoiceId, inDays: 3 });
  };

  const handlePush = async () => {
    const statusBefore = pushStatus;

    if (statusBefore === "denied") {
      await Linking.openSettings();
      return;
    }

    if (statusBefore === "granted") {
      try { await scheduleLocalNotif(); } catch (_) {}
      try { await registerPushTokenIfGranted(); } catch (_) {}
      track("first_run_push", { status_before: statusBefore, granted: true });
      onDone("owed_added");
      return;
    }

    // undetermined (or null while still loading)
    await registerPushToken();
    const { status } = await Notifications.getPermissionsAsync();
    const granted = status === "granted";
    track("first_run_push", { status_before: statusBefore, granted });
    if (granted) { try { await scheduleLocalNotif(); } catch (_) {} }
    onDone("owed_added");
  };

  // ── Ask screen ─────────────────────────────────────────────────────────────
  const renderAsk = () => (
    <ScrollView
      contentContainerStyle={[s.screen, { paddingTop: top + 24 }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={s.bodySection}>
        <Text style={s.eyebrow}>Welcome{firstName ? `, ${firstName}` : ""}</Text>
        <Text style={s.title}>Does a client owe you money right now?</Text>
        <Text style={s.bodyText}>
          Most people we ask have at least one. Add it and Maggo reminds you, and them, until it's paid.
        </Text>

        <View style={s.exampleCard}>
          <View style={s.exampleTop}>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={s.exampleName}>Kitchen job, Mr. Cohen</Text>
              <Text style={s.exampleLate}>5 days late</Text>
            </View>
            <Text style={s.exampleAmount}>$1,800</Text>
          </View>
          <View style={s.exampleStrip}>
            <Ionicons name="logo-whatsapp" size={14} color="#166534" />
            <Text style={s.exampleStripText}>Reminder sent on WhatsApp</Text>
          </View>
          <Text style={s.exampleCaption}>Example of what you'll see</Text>
        </View>
      </View>

      <View style={s.bottomActions}>
        <TouchableOpacity
          style={s.primaryBtn}
          onPress={() => { track("first_run_answer", { answer: "yes" }); setScreen("add"); }}
        >
          <Text style={s.primaryBtnText}>Yes, add who owes me</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.ghostBtn}
          onPress={() => { track("first_run_answer", { answer: "no" }); onDone("skipped"); }}
        >
          <Text style={s.ghostBtnText}>Not right now</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  // ── Add screen ─────────────────────────────────────────────────────────────
  const renderAdd = () => (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {Platform.OS === "ios" && (
        <InputAccessoryView nativeID="acc-firstrun">
          <View style={s.accBar}>
            <TouchableOpacity onPress={Keyboard.dismiss} style={s.accDoneBtn}>
              <Text style={s.accDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </InputAccessoryView>
      )}
      <ScrollView
        contentContainerStyle={[s.screen, { paddingTop: top + 16 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={s.navRow}>
          <TouchableOpacity style={s.backBtn} onPress={() => setScreen("ask")}>
            <Ionicons name="arrow-back" size={20} color="#0F172A" />
          </TouchableOpacity>
          <Text style={s.stepLabel}>Step 1 of 2</Text>
        </View>

        <Text style={s.title}>Who owes you, and how much?</Text>

        <View style={s.amountRow}>
          <Text style={s.amountSymbol}>{symbol}</Text>
          <TextInput
            style={s.amountInput}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor="#CBD5E1"
            inputAccessoryViewID="acc-firstrun"
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
          />
        </View>
        <Text style={s.amountCaption}>Amount they owe</Text>

        <View style={s.fieldsCard}>
          {[
            { label: "Client", placeholder: "Required",  value: client,      set: setClient,      hint: null,            kb: "default"   },
            { label: "For",    placeholder: "Optional",  value: description, set: setDescription, hint: null,            kb: "default"   },
            { label: "Phone",  placeholder: "Optional",  value: phone,       set: setPhone,       hint: "for reminders", kb: "phone-pad" },
          ].map((f, i, arr) => (
            <View key={f.label} style={[s.fieldRow, i < arr.length - 1 && s.fieldRowBorder]}>
              <Text style={s.fieldLabel}>{f.label}</Text>
              <TextInput
                style={s.fieldInput}
                value={f.value}
                onChangeText={f.set}
                placeholder={f.placeholder}
                placeholderTextColor="#94A3B8"
                keyboardType={f.kb}
                inputAccessoryViewID="acc-firstrun"
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />
              {!!f.hint && <Text style={s.fieldHint}>{f.hint}</Text>}
            </View>
          ))}
        </View>

        <Text style={s.dueLabel}>When was it due?</Text>
        <View style={s.chipRow}>
          {DUE_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[s.chip, due === opt.key && s.chipActive]}
              onPress={() => setDue(opt.key)}
            >
              <Text style={[s.chipText, due === opt.key && s.chipTextActive]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[s.primaryBtn, (!amount || !client.trim() || saving) && s.primaryBtnDisabled]}
          onPress={handleAdd}
          disabled={!amount || !client.trim() || saving}
        >
          <Text style={s.primaryBtnText}>{saving ? "Adding…" : "Add to Owed to You"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  // ── Remind screen ──────────────────────────────────────────────────────────
  const renderRemind = () => {
    const numAmount = Number(amount);
    const msg = buildMsg(
      { client, amount: numAmount, description, dueDate: invoice?.dueDate },
      userName, currency, locale
    );
    return (
      <ScrollView
        contentContainerStyle={[s.screen, { paddingTop: top + 24 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[s.stepLabel, { marginBottom: 8 }]}>Step 2 of 2</Text>

        <View style={s.checkCircle}>
          <Ionicons name="checkmark" size={28} color="#15803D" />
        </View>

        <Text style={s.title}>
          {fmt(numAmount)} added.{"\n"}Send {client.trim().split(/\s+/)[0]} a reminder now?
        </Text>
        <Text style={s.bodyText}>
          It opens WhatsApp with this message. You can edit it before sending.
        </Text>

        <View style={s.msgCard}>
          <Text style={s.msgText}>{msg}</Text>
        </View>

        {phone.trim() ? (
          <TouchableOpacity style={s.waBtn} onPress={handleWhatsApp}>
            <Ionicons name="logo-whatsapp" size={22} color="#fff" />
            <Text style={s.waBtnText}>Send on WhatsApp</Text>
          </TouchableOpacity>
        ) : (
          <View style={s.noPhoneNote}>
            <Ionicons name="information-circle-outline" size={16} color="#64748B" />
            <Text style={s.noPhoneText}>Add a phone to send reminders</Text>
          </View>
        )}

        <View style={s.pushCard}>
          <View style={s.pushIconWrap}>
            <Ionicons name="notifications-outline" size={22} color="#B45309" />
          </View>
          <View style={{ flex: 1 }}>
            {pushStatus === "denied" ? (
              <>
                <Text style={s.pushTitle}>Notifications are off for Maggo</Text>
                <Text style={s.pushBody}>
                  Turn them on to get a nudge when {client.trim().split(/\s+/)[0]} still hasn't paid.
                </Text>
                <TouchableOpacity style={s.pushBtn} onPress={handlePush}>
                  <Text style={s.pushBtnText}>Turn on in Settings</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={s.pushTitle}>Get a nudge if they still haven't paid</Text>
                <Text style={s.pushBody}>
                  We'll tell you in 3 days, so you never chase money from memory.
                </Text>
                <TouchableOpacity style={s.pushBtn} onPress={handlePush}>
                  <Text style={s.pushBtnText}>
                    {pushStatus === "granted" ? "Remind me in 3 days" : "Turn on reminders"}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        <TouchableOpacity style={s.ghostBtn} onPress={() => onDone("owed_added")}>
          <Text style={s.ghostBtnText}>Skip for now</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent>
      <View style={s.container}>
        {screen === "ask"    && renderAsk()}
        {screen === "add"    && renderAdd()}
        {screen === "remind" && renderRemind()}
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: "#F8FAFC" },
  screen:      { paddingHorizontal: 24, paddingBottom: 48, gap: 16 },
  bodySection: { gap: 16 },
  bottomActions: { gap: 12 },

  eyebrow:  { fontSize: 15, fontWeight: "600", color: "#047857" },
  title:    { fontSize: 32, fontWeight: "700", color: "#0F172A", lineHeight: 40 },
  bodyText: { fontSize: 17, color: "#475569", lineHeight: 26 },

  // Example card
  exampleCard:      { backgroundColor: "#FFFFFF", borderRadius: 20, borderWidth: 1, borderColor: "#E2E8F0", padding: 16, gap: 10 },
  exampleTop:       { flexDirection: "row", alignItems: "flex-start" },
  exampleName:      { fontSize: 15, fontWeight: "600", color: "#0F172A" },
  exampleLate:      { fontSize: 13, fontWeight: "600", color: "#B91C1C" },
  exampleAmount:    { fontSize: 20, fontWeight: "700", color: "#0F172A" },
  exampleStrip:     { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#F0FDF4", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  exampleStripText: { fontSize: 13, fontWeight: "600", color: "#166534" },
  exampleCaption:   { fontSize: 12, color: "#64748B", textAlign: "center" },

  // Buttons
  primaryBtn:         { height: 56, borderRadius: 18, backgroundColor: "#0F172A", alignItems: "center", justifyContent: "center" },
  primaryBtnDisabled: { opacity: 0.45 },
  primaryBtnText:     { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
  ghostBtn:           { height: 56, alignItems: "center", justifyContent: "center" },
  ghostBtnText:       { fontSize: 16, color: "#64748B" },

  // Nav
  navRow:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  backBtn:   { width: 44, height: 44, borderRadius: 22, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0", alignItems: "center", justifyContent: "center" },
  stepLabel: { fontSize: 15, fontWeight: "600", color: "#94A3B8" },

  // Amount
  amountRow:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  amountSymbol: { fontSize: 32, fontWeight: "700", color: "#0F172A" },
  amountInput:  { fontSize: 48, lineHeight: 56, fontWeight: "700", color: "#0F172A", minWidth: 80 },
  amountCaption:{ fontSize: 15, color: "#64748B", textAlign: "center", marginTop: -8 },

  // Fields card
  fieldsCard:     { backgroundColor: "#FFFFFF", borderRadius: 20, borderWidth: 1, borderColor: "#E2E8F0" },
  fieldRow:       { flexDirection: "row", alignItems: "center", minHeight: 58, paddingHorizontal: 16 },
  fieldRowBorder: { borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  fieldLabel:     { fontSize: 15, fontWeight: "600", color: "#0F172A", width: 60 },
  fieldInput:     { flex: 1, fontSize: 15, color: "#0F172A", paddingVertical: 10 },
  fieldHint:      { fontSize: 13, color: "#94A3B8" },

  // Due chips
  dueLabel:       { fontSize: 15, fontWeight: "600", color: "#0F172A" },
  chipRow:        { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip:           { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0" },
  chipActive:     { backgroundColor: "#F0FDF4", borderColor: "#15803D" },
  chipText:       { fontSize: 15, color: "#475569" },
  chipTextActive: { color: "#15803D", fontWeight: "600" },

  // Keyboard bar
  accBar:     { height: 44, flexDirection: "row", justifyContent: "flex-end", alignItems: "center", backgroundColor: "#F1F1EE", borderTopWidth: 1, borderTopColor: "#E6E6E1", paddingHorizontal: 12 },
  accDoneBtn: { paddingHorizontal: 8 },
  accDoneText:{ fontSize: 16, fontWeight: "600", color: "#2457D6" },

  // Check circle
  checkCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#DCFCE7", alignItems: "center", justifyContent: "center", alignSelf: "center" },

  // Msg card
  msgCard: { backgroundColor: "#FFFFFF", borderRadius: 16, borderWidth: 1, borderColor: "#E2E8F0", padding: 16 },
  msgText: { fontSize: 15, color: "#0F172A", lineHeight: 22 },

  // WhatsApp button
  waBtn:     { height: 56, borderRadius: 18, backgroundColor: "#15803D", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  waBtnText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },

  // No phone note
  noPhoneNote: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#F8FAFC", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#E2E8F0" },
  noPhoneText: { fontSize: 15, color: "#64748B" },

  // Push card
  pushCard:    { backgroundColor: "#FEF3C7", borderRadius: 20, borderWidth: 1, borderColor: "#FDE68A", padding: 16, flexDirection: "row", gap: 14 },
  pushIconWrap:{ width: 44, height: 44, borderRadius: 12, backgroundColor: "#FEF9C3", alignItems: "center", justifyContent: "center" },
  pushTitle:   { fontSize: 16, fontWeight: "700", color: "#0F172A", marginBottom: 4 },
  pushBody:    { fontSize: 15, color: "#78350F", lineHeight: 22, marginBottom: 12 },
  pushBtn:     { height: 44, borderRadius: 12, backgroundColor: "#0F172A", alignItems: "center", justifyContent: "center" },
  pushBtnText: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
});
