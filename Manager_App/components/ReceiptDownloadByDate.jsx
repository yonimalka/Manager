import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { Calendar, Download, ChevronDown, ChevronUp } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { SERVER_URL } from "@env";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function ReceiptDownloadByDate() {
  const [expanded, setExpanded] = useState(false);
  const [pickerType, setPickerType] = useState(null);
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

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

  const isValidRange = useMemo(() => {
    if (!fromDate || !toDate) return false;
    return fromDate <= toDate;
  }, [fromDate, toDate]);

  const downloadReceiptsZip = async ({ from, to } = {}) => {
    try {
      const token = await AsyncStorage.getItem("token");
      const fileUri = FileSystem.documentDirectory + "Receipts.zip";

      const query = from instanceof Date && to instanceof Date
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
      <View style={styles.card}>
        <TouchableOpacity style={styles.cardHeader} onPress={toggleExpand} activeOpacity={0.7}>
          <View style={styles.cardHeaderLeft}>
            <View style={styles.iconContainer}>
              <Calendar size={20} color="#F97316" />
            </View>
            <View>
              <Text style={styles.cardTitle}>Download Receipts</Text>
              <Text style={styles.cardSubtitle}>Get receipts for a date range</Text>
            </View>
          </View>
          <View style={styles.chevronContainer}>
            {expanded ? <ChevronUp size={20} color="#6B7280" /> : <ChevronDown size={20} color="#6B7280" />}
          </View>
        </TouchableOpacity>

        {expanded && (
          <View style={styles.cardBody}>
            <View style={styles.dateRangeRow}>
              <TouchableOpacity
                style={styles.dateBox}
                onPress={() => setPickerType("from")}
                activeOpacity={0.7}
              >
                <Text style={styles.dateLabel}>From</Text>
                <Text style={styles.dateValue}>
                  {fromDate ? fromDate.toLocaleDateString() : "Select date"}
                </Text>
              </TouchableOpacity>

              <View style={styles.dateSeparator}>
                <View style={styles.dateSeparatorLine} />
              </View>

              <TouchableOpacity
                style={styles.dateBox}
                onPress={() => setPickerType("to")}
                activeOpacity={0.7}
              >
                <Text style={styles.dateLabel}>To</Text>
                <Text style={styles.dateValue}>
                  {toDate ? toDate.toLocaleDateString() : "Select date"}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Quick Select</Text>
              <View style={styles.quickRangeRow}>
                {Object.keys(quickRanges).map((label) => (
                  <TouchableOpacity
                    key={label}
                    style={styles.quickRangeBtn}
                    onPress={quickRanges[label]}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.quickRangeText}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {!isValidRange && fromDate && toDate && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>
                  "From" date must be before "To" date
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.primaryButton, !isValidRange && styles.primaryButtonDisabled]}
              disabled={!isValidRange}
              onPress={() => downloadReceiptsZip({ from: fromDate, to: toDate })}
              activeOpacity={0.8}
            >
              <Download size={18} color="#fff" />
              <Text style={styles.primaryButtonText}>Download ZIP</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <DateTimePickerModal
        isVisible={pickerType !== null}
        mode="date"
        display="spinner"
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
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 18,
  },

  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },

  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#FFF7ED",
    alignItems: "center",
    justifyContent: "center",
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0F172A",
    marginBottom: 2,
  },

  cardSubtitle: {
    fontSize: 13,
    color: "#64748B",
  },

  chevronContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },

  cardBody: {
    paddingHorizontal: 18,
    paddingBottom: 20,
    gap: 16,
  },

  dateRangeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  dateBox: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  dateLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: "#64748B",
    marginBottom: 6,
  },

  dateValue: {
    fontSize: 15,
    fontWeight: "500",
    color: "#0F172A",
  },

  dateSeparator: {
    alignItems: "center",
    justifyContent: "center",
  },

  dateSeparatorLine: {
    width: 12,
    height: 2,
    backgroundColor: "#CBD5E1",
    borderRadius: 1,
  },

  inputGroup: {
    gap: 8,
  },

  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#475569",
  },

  quickRangeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  quickRangeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  quickRangeText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#475569",
  },

  errorContainer: {
    backgroundColor: "#FEE2E2",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },

  errorText: {
    fontSize: 13,
    color: "#DC2626",
    fontWeight: "500",
  },

  primaryButton: {
    marginTop: 8,
    backgroundColor: "#0A7AFF",
    paddingVertical: 16,
    borderRadius: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    shadowColor: "#0A7AFF",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },

  primaryButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },

  primaryButtonDisabled: {
    opacity: 0.4,
  },
});