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
import { useNavigation, useRoute } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import { Ionicons } from "@expo/vector-icons";
import * as Sharing from "expo-sharing";
import {SERVER_URL} from "@env";
import ReceiptDownloadByDate from "./ReceiptDownloadByDate";
import Receipts from "./Receipts";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function FinanceFixedExpenses() {

  const navigation = useNavigation();

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
  
  const addReceipts = () => {
    
    navigation.navigate("Receipts");
  };
  // 🔁 Recurrence preview (next occurrence)
  const nextOccurrence = useMemo(() => {
    const now = new Date();

    if (frequency === "monthly" && dayOfMonth) {
      const date = new Date(now.getFullYear(), now.getMonth(), Number(dayOfMonth));
      if (date < now) date.setMonth(date.getMonth() + 1);
      return date.toDateString();
    }

    if (frequency === "weekly" && dayOfWeek !== null) {
      const date = new Date(now);
      const diff = (dayOfWeek + 7 - date.getDay()) % 7 || 7;
      date.setDate(date.getDate() + diff);
      return date.toDateString();
    }

    if (frequency === "yearly" && month !== null && dayOfMonth) {
      const date = new Date(now.getFullYear(), month, Number(dayOfMonth));
      if (date < now) date.setFullYear(date.getFullYear() + 1);
      return date.toDateString();
    }

    return null;
  }, [frequency, dayOfMonth, dayOfWeek, month]);

  const saveFixedExpense = () => {
    const payload = {
      title,
      amount: Number(amount),
      category,
      frequency,
      dayOfMonth: frequency !== "weekly" ? Number(dayOfMonth) : null,
      dayOfWeek: frequency === "weekly" ? dayOfWeek : null,
      month: frequency === "yearly" ? month : null,
    };

    console.log("Saving fixed expense:", payload);

    setTitle("");
    setAmount("");
    setCategory("");
    setDayOfMonth("");
    setDayOfWeek(null);
    setMonth(null);
    setExpanded(false);
  };

  return (
    <View >
    <View style={styles.container}>
      <TouchableOpacity style={styles.header} onPress={toggleExpand}>
        <View style={styles.headerLeft}>
          <Repeat size={18} color="#0A7AFF" />
          <Text style={styles.headerTitle}>Fixed Expenses</Text>
        </View>
        {expanded ? <ChevronUp /> : <ChevronDown />}
      </TouchableOpacity>

      {expanded && (
        <View style={styles.form}>
          <TextInput placeholder="Title" value={title} onChangeText={setTitle} style={styles.input} />
          <TextInput placeholder="Amount" keyboardType="numeric" value={amount} onChangeText={setAmount} style={styles.input} />
          <TextInput placeholder="Category" value={category} onChangeText={setCategory} style={styles.input} />

          <View style={styles.frequencyRow}>
            {["monthly", "weekly", "yearly"].map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.freqButton, frequency === f && styles.freqButtonActive]}
                onPress={() => setFrequency(f)}
              >
                <Text style={[styles.freqText, frequency === f && styles.freqTextActive]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {frequency === "monthly" && (
            <TextInput placeholder="Day of month (1–31)" keyboardType="numeric" value={dayOfMonth} onChangeText={setDayOfMonth} style={styles.input} />
          )}

          {frequency === "weekly" && (
            <View style={styles.selectorRow}>
              {DAYS.map((d, i) => (
                <TouchableOpacity key={d} style={[styles.selector, dayOfWeek === i && styles.selectorActive]} onPress={() => setDayOfWeek(i)}>
                  <Text style={dayOfWeek === i ? styles.selectorTextActive : styles.selectorText}>{d.slice(0, 3)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {frequency === "yearly" && (
            <>
              <View style={styles.selectorRow}>
                {MONTHS.map((m, i) => (
                  <TouchableOpacity key={m} style={[styles.selector, month === i && styles.selectorActive]} onPress={() => setMonth(i)}>
                    <Text style={month === i ? styles.selectorTextActive : styles.selectorText}>{m.slice(0, 3)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput placeholder="Day" keyboardType="numeric" value={dayOfMonth} onChangeText={setDayOfMonth} style={styles.input} />
            </>
          )}

          {nextOccurrence && (
            <Text style={styles.preview}>Next occurrence: {nextOccurrence}</Text>
          )}

          <TouchableOpacity style={styles.saveButton} onPress={saveFixedExpense}>
            <Plus size={18} color="#fff" />
            <Text style={styles.saveText}>Add Fixed Expense</Text>
          </TouchableOpacity>
        </View>
      )}
      </View>
     <ReceiptDownloadByDate />
     {/* Upload Receipt Button */}
     <View style={styles.container}>
     <View style={styles.form}>
      <CloudUpload size={24} color="#0A7AFF" />
      <TouchableOpacity  onPress={addReceipts} activeOpacity={0.8}>
        <Text style={styles.headerTitle}>upload receipt</Text>
      </TouchableOpacity>
     </View>
     </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: "#fff", borderRadius: 16, padding: 20, marginVertical: 52, elevation: 2 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { fontSize: 16, fontWeight: "600" },
  form: { marginTop: 16, gap: 12 },
  input: { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10, padding: 12 },
  frequencyRow: { flexDirection: "row", gap: 8 },
  freqButton: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: "#E5E7EB", alignItems: "center" },
  freqButtonActive: { backgroundColor: "#E8F0FF", borderColor: "#0A7AFF" },
  freqText: { color: "#6B7280", textTransform: "capitalize" },
  freqTextActive: { color: "#0A7AFF", fontWeight: "600" },
  selectorRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  selector: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: "#E5E7EB" },
  selectorActive: { backgroundColor: "#E8F0FF", borderColor: "#0A7AFF" },
  selectorText: { fontSize: 12, color: "#6B7280" },
  selectorTextActive: { fontSize: 12, color: "#0A7AFF", fontWeight: "600" },
  preview: { fontSize: 13, color: "#374151", marginTop: 4 },
  saveButton: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, backgroundColor: "#0A7AFF", paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  saveText: { color: "#fff", fontWeight: "600" },
});