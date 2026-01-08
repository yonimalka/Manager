import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { Calendar, Download, ChevronDown, ChevronUp } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import {SERVER_URL} from "@env";

export default function ReceiptDownloadByDate({ onDownload }) {
  const [expanded, setExpanded] = useState(false);
  const [pickerType, setPickerType] = useState(null); // "from" | "to" | null
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);

  const toggleExpand = () => setExpanded(!expanded);

  // ✅ Validates date range
  const isValidRange = useMemo(() => {
    if (!fromDate || !toDate) return false;
    return fromDate <= toDate;
  }, [fromDate, toDate]);

  // Quick ranges
  const quickRanges = {
    "This Month": () => {
      const now = new Date();
      setFromDate(new Date(now.getFullYear(), now.getMonth(), 1));
      setToDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    },
    "Last Month": () => {
      const now = new Date();
      setFromDate(new Date(now.getFullYear(), now.getMonth() - 1, 1));
      setToDate(new Date(now.getFullYear(), now.getMonth(), 0));
    },
    "This Year": () => {
      const now = new Date();
      setFromDate(new Date(now.getFullYear(), 0, 1));
      setToDate(new Date(now.getFullYear(), 11, 31));
    },
  };

  const handleDownload = () => {
    if (!isValidRange) return;
    onDownload({ from: fromDate, to: toDate });
    setExpanded(false);
  };
   // 🔥 ZIP download function
  const downloadReceiptsZip = async ({ from, to } = {}) => {
  try {
    const token = await AsyncStorage.getItem("token");
    const fileUri = FileSystem.documentDirectory + "Receipts.zip";

    const query =
  from instanceof Date && to instanceof Date
    ? `?from=${from.toISOString()}&to=${to.toISOString()}`
    : "";

    const res = await FileSystem.downloadAsync(
      `${SERVER_URL}/downloadReceiptsZip${query}`,
      fileUri,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    await Sharing.shareAsync(res.uri);
  } catch (err) {
    console.log("ZIP download error:", err);
  }
};
  return (
    <>
      <View style={styles.container}>
        {/* Header */}
        <TouchableOpacity style={styles.header} onPress={toggleExpand}>
          <View style={styles.headerLeft}>
            <Calendar size={18} color="#0A7AFF" />
            <Text style={styles.headerTitle}>Download Receipts</Text>
          </View>
          {expanded ? <ChevronUp /> : <ChevronDown />}
        </TouchableOpacity>

        {/* Expanded Body */}
        {expanded && (
          <View style={styles.body}>
            <View style={styles.rangeRow}>
              <TouchableOpacity
                style={styles.dateBox}
                onPress={() => setPickerType("from")}
              >
                <Text style={styles.label}>From</Text>
                <Text style={styles.dateText}>
                  {fromDate ? fromDate.toDateString() : "Select"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dateBox}
                onPress={() => setPickerType("to")}
              >
                <Text style={styles.label}>To</Text>
                <Text style={styles.dateText}>
                  {toDate ? toDate.toDateString() : "Select"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Quick ranges */}
            <View style={styles.quickRow}>
              {Object.keys(quickRanges).map((label) => (
                <TouchableOpacity
                  key={label}
                  style={styles.quickBtn}
                  onPress={quickRanges[label]}
                >
                  <Text style={styles.quickText}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Validation */}
            {!isValidRange && fromDate && toDate && (
              <Text style={styles.error}>
                "From" date must be before "To" date
              </Text>
            )}

            {/* Download Button */}
            <TouchableOpacity
              style={[styles.downloadBtn, !isValidRange && styles.disabled]}
              disabled={!isValidRange}
              onPress={() => downloadReceiptsZip({ from: fromDate, to: toDate })}
            >
              <Download size={18} color="#fff" />
              <Text style={styles.downloadText}>Download</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Modal Date Picker */}
      <DateTimePickerModal
        isVisible={pickerType !== null}
        mode="date"
        display="spinner" // ✅ ensures iOS spinner appears
        date={pickerType === "from" ? fromDate || new Date() : toDate || new Date()}
        onConfirm={(date) => {
          if (pickerType === "from") setFromDate(date);
          else setToDate(date);
          setPickerType(null);
        }}
        onCancel={() => setPickerType(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginVertical: 12, elevation: 2 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { fontSize: 16, fontWeight: "600" },
  body: { marginTop: 16, gap: 12 },
  rangeRow: { flexDirection: "row", gap: 12 },
  dateBox: { flex: 1, borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, padding: 12 },
  label: { fontSize: 12, color: "#6B7280" },
  dateText: { fontSize: 14, marginTop: 4 },
  quickRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  quickBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: "#F3F4F6" },
  quickText: { fontSize: 12, color: "#374151" },
  downloadBtn: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, backgroundColor: "#0A7AFF", paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  disabled: { opacity: 0.5 },
  downloadText: { color: "#fff", fontWeight: "600" },
  error: { color: "#DC2626", fontSize: 12 },
});
