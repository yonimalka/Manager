import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  LayoutAnimation,
  Platform,
  UIManager,
  StyleSheet,
} from "react-native";
import { Plus, ChevronDown, ChevronUp, Repeat, CloudUpload } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import api from "../services/api";
import ReceiptDownloadByDate from "./ReceiptDownloadByDate";
import IncomeReceiptGenerator from "./IncomeReceiptGenerator";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function FinanceFixedExpenses() {
  const navigation = useNavigation();

  // === ORIGINAL FUNCTIONALITY (UNCHANGED) ===
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [frequency, setFrequency] = useState("monthly");
  const [dayOfMonth, setDayOfMonth] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState(null);
  const [month, setMonth] = useState(null);

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  const nextOccurrence = useMemo(() => {
    const now = new Date();

    if (frequency === "monthly" && dayOfMonth) {
      const d = new Date(now.getFullYear(), now.getMonth(), Number(dayOfMonth));
      if (d < now) d.setMonth(d.getMonth() + 1);
      return d.toDateString();
    }

    if (frequency === "weekly" && dayOfWeek !== null) {
      const d = new Date(now);
      const diff = (dayOfWeek + 7 - d.getDay()) % 7 || 7;
      d.setDate(d.getDate() + diff);
      return d.toDateString();
    }

    if (frequency === "yearly" && month !== null && dayOfMonth) {
      const d = new Date(now.getFullYear(), month, Number(dayOfMonth));
      if (d < now) d.setFullYear(d.getFullYear() + 1);
      return d.toDateString();
    }

    return null;
  }, [frequency, dayOfMonth, dayOfWeek, month]);

  const saveFixedExpense = async () => {
    const payload = {
      title,
      amount: Number(amount),
      category,
      frequency,
      dayOfMonth: frequency !== "weekly" ? Number(dayOfMonth) : null,
      dayOfWeek: frequency === "weekly" ? dayOfWeek : null,
      month: frequency === "yearly" ? month : null,
    };

    await api.post("/fixedExpense", payload);

    setTitle("");
    setAmount("");
    setCategory("");
    setDayOfMonth("");
    setDayOfWeek(null);
    setMonth(null);
    setExpanded(false);
  };

  const goToReceipts = () => navigation.navigate("Receipts");
 
  async function submitReceipt(data) {
    const r = JSON.stringify(data);
  const res = await api.post("/incomeReceipt", { r});

  const receipt = await res.json();
  console.log(receipt);
  
  generateIncomeReceiptPDF(receipt);
}

  // === CLAUDE iOS–STYLE UI ===
  return (
    <View style={styles.screen}>
      <Text style={styles.sectionTitle}>Finance</Text>
      <Text style={styles.sectionSubtitle}>Manage recurring expenses and receipts</Text>

      <View style={styles.surface}>
        <TouchableOpacity style={styles.surfaceHeader} onPress={toggleExpand} activeOpacity={0.7}>
          <View style={styles.headerLeft}>
            <Repeat size={18} color="#0A7AFF" />
            <Text style={styles.surfaceTitle}>Fixed expense</Text>
          </View>
          {expanded ? <ChevronUp /> : <ChevronDown />}
        </TouchableOpacity>

        {expanded && (
          <View style={styles.surfaceBody}>
            <Text style={styles.helperText}>Add a recurring cost. You can fine-tune the schedule below.</Text>

            <TextInput placeholder="Title" value={title} onChangeText={setTitle} style={styles.input} />
            <TextInput placeholder="Amount" keyboardType="numeric" value={amount} onChangeText={setAmount} style={styles.input} />
            <TextInput placeholder="Category" value={category} onChangeText={setCategory} style={styles.input} />

            <View style={styles.freqRow}>
              {["monthly", "weekly", "yearly"].map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.freqPill, frequency === f && styles.freqPillActive]}
                  onPress={() => setFrequency(f)}
                >
                  <Text style={[styles.freqText, frequency === f && styles.freqTextActive]}>{f}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {frequency === "monthly" && (
              <TextInput placeholder="Day of month" keyboardType="numeric" value={dayOfMonth} onChangeText={setDayOfMonth} style={styles.input} />
            )}

            {frequency === "weekly" && (
              <View style={styles.selectorRow}>
                {DAYS.map((d, i) => (
                  <TouchableOpacity key={d} style={[styles.selector, dayOfWeek === i && styles.selectorActive]} onPress={() => setDayOfWeek(i)}>
                    <Text style={dayOfWeek === i ? styles.selectorTextActive : styles.selectorText}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {frequency === "yearly" && (
              <>
                <View style={styles.selectorRow}>
                  {MONTHS.map((m, i) => (
                    <TouchableOpacity key={m} style={[styles.selector, month === i && styles.selectorActive]} onPress={() => setMonth(i)}>
                      <Text style={month === i ? styles.selectorTextActive : styles.selectorText}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput placeholder="Day" keyboardType="numeric" value={dayOfMonth} onChangeText={setDayOfMonth} style={styles.input} />
              </>
            )}

            {nextOccurrence && <Text style={styles.preview}>Next occurrence: {nextOccurrence}</Text>}

            <TouchableOpacity style={styles.primaryAction} onPress={saveFixedExpense}>
              <Plus size={16} color="#fff" />
              <Text style={styles.primaryActionText}>Add fixed expense</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Receipts */}
      <ReceiptDownloadByDate />

      <View style={styles.surface}>
        <TouchableOpacity style={styles.inlineAction} onPress={goToReceipts} activeOpacity={0.7}>
          <CloudUpload size={18} color="#0A7AFF" />
          <Text style={styles.surfaceTitle}>Upload receipt</Text>
        </TouchableOpacity>
      </View>
      <IncomeReceiptGenerator onSubmit={submitReceipt} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, padding: 20, paddingTop: 50, backgroundColor: "#F9FAFB", },

  sectionTitle: { fontSize: 28, fontWeight: "600", color: "#111827", marginBottom: 10, },
  sectionSubtitle: { fontSize: 14, color: "#6B7280", marginBottom: 22 },

  surface: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    marginBottom: 6,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 20,
    elevation: 1,
  },

  surfaceHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between"},
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  surfaceTitle: { fontSize: 16, fontWeight: "500", color: "#111827" },

  surfaceBody: { marginTop: 14, gap: 12 },
  helperText: { fontSize: 13, color: "#6B7280", marginBottom: 4 },

  input: {
    backgroundColor: "#F3F4F6",
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
  },

  freqRow: { flexDirection: "row", gap: 8 },
  freqPill: { flex: 1, paddingVertical: 10, borderRadius: 999, backgroundColor: "#F3F4F6", alignItems: "center" },
  freqPillActive: { backgroundColor: "#E8F0FF" },
  freqText: { color: "#6B7280" },
  freqTextActive: { color: "#0A7AFF", fontWeight: "600" },

  selectorRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  selector: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: "#F3F4F6" },
  selectorActive: { backgroundColor: "#E8F0FF" },
  selectorText: { fontSize: 12, color: "#6B7280" },
  selectorTextActive: { fontSize: 12, color: "#0A7AFF", fontWeight: "600" },

  preview: { fontSize: 13, color: "#374151" },

  primaryAction: {
    marginTop: 10,
    backgroundColor: "#0A7AFF",
    paddingVertical: 14,
    borderRadius: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  primaryActionText: { color: "#fff", fontWeight: "600", fontSize: 15 },

  inlineAction: { flexDirection: "row", alignItems: "center", gap: 10 },
  inlineActionText: { fontSize: 15, fontWeight: "500", color: "#111827" },
});