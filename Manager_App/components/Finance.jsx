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
  Modal,
  ScrollView,
} from "react-native";
import { Plus, ChevronDown, ChevronUp, Repeat, CloudUpload, BanknoteArrowUp, Calendar, DollarSign, Tag } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import api from "../services/api";
import ReceiptDownloadByDate from "./ReceiptDownloadByDate";
import IncomesDownloadByDate from "./IncomesDownloadByDate";
import Receipts from "./Receipts";
import IncomeReceiptGenerator from "./IncomesReceiptGenerator";
import { generateIncomeReceiptPDF } from "../services/generateIncomePDF";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);
  const [visible, setVisible] = useState(false);

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

  const submitIncomeReceipt = async (data) => {
    try {
      const res = await api.post("/incomeReceipt", data);
      const receipt = await res.data;
      console.log("Saved receipt:", receipt);
      const response = await api.get(`/getUserDetails/${userId}`);
      console.log(response.data);
      const userDetails = response.data;
      generateIncomeReceiptPDF(receipt, userDetails);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <ScrollView style={styles.screen} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Finance</Text>
        <Text style={styles.headerSubtitle}>Manage your recurring expenses and income receipts</Text>
      </View>

      {/* Expenses Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recurring Expenses</Text>
        
        <View style={styles.card}>
          <TouchableOpacity style={styles.cardHeader} onPress={toggleExpand} activeOpacity={0.7}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.iconContainer}>
                <Repeat size={20} color="#0A7AFF" />
              </View>
              <View>
                <Text style={styles.cardTitle}>Fixed Expense</Text>
                <Text style={styles.cardSubtitle}>Add a recurring payment</Text>
              </View>
            </View>
            <View style={styles.chevronContainer}>
              {expanded ? <ChevronUp size={20} color="#6B7280" /> : <ChevronDown size={20} color="#6B7280" />}
            </View>
          </TouchableOpacity>

          {expanded && (
            <View style={styles.cardBody}>
              <View style={styles.inputGroup}>
                <View style={styles.inputLabelRow}>
                  <Tag size={16} color="#6B7280" />
                  <Text style={styles.inputLabel}>Title</Text>
                </View>
                <TextInput 
                  placeholder="e.g., Netflix Subscription" 
                  value={title} 
                  onChangeText={setTitle} 
                  style={styles.input}
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.inputLabelRow}>
                  <DollarSign size={16} color="#6B7280" />
                  <Text style={styles.inputLabel}>Amount</Text>
                </View>
                <TextInput 
                  placeholder="0.00" 
                  keyboardType="numeric" 
                  value={amount} 
                  onChangeText={setAmount} 
                  style={styles.input}
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.inputLabelRow}>
                  <Tag size={16} color="#6B7280" />
                  <Text style={styles.inputLabel}>Category</Text>
                </View>
                <TextInput 
                  placeholder="e.g., Entertainment, Utilities" 
                  value={category} 
                  onChangeText={setCategory} 
                  style={styles.input}
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.inputLabelRow}>
                  <Calendar size={16} color="#6B7280" />
                  <Text style={styles.inputLabel}>Frequency</Text>
                </View>
                <View style={styles.freqRow}>
                  {["monthly", "weekly", "yearly"].map((f) => (
                    <TouchableOpacity
                      key={f}
                      style={[styles.freqPill, frequency === f && styles.freqPillActive]}
                      onPress={() => setFrequency(f)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.freqText, frequency === f && styles.freqTextActive]}>
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {frequency === "monthly" && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Day of Month</Text>
                  <TextInput 
                    placeholder="1-31" 
                    keyboardType="numeric" 
                    value={dayOfMonth} 
                    onChangeText={setDayOfMonth} 
                    style={styles.input}
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
              )}

              {frequency === "weekly" && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Day of Week</Text>
                  <View style={styles.selectorRow}>
                    {DAYS.map((d, i) => (
                      <TouchableOpacity 
                        key={d} 
                        style={[styles.selector, dayOfWeek === i && styles.selectorActive]} 
                        onPress={() => setDayOfWeek(i)}
                        activeOpacity={0.7}
                      >
                        <Text style={dayOfWeek === i ? styles.selectorTextActive : styles.selectorText}>{d}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {frequency === "yearly" && (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Month</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={styles.selectorRow}>
                        {MONTHS.map((m, i) => (
                          <TouchableOpacity 
                            key={m} 
                            style={[styles.selector, month === i && styles.selectorActive]} 
                            onPress={() => setMonth(i)}
                            activeOpacity={0.7}
                          >
                            <Text style={month === i ? styles.selectorTextActive : styles.selectorText}>{m}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Day</Text>
                    <TextInput 
                      placeholder="1-31" 
                      keyboardType="numeric" 
                      value={dayOfMonth} 
                      onChangeText={setDayOfMonth} 
                      style={styles.input}
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                </>
              )}

              {nextOccurrence && (
                <View style={styles.previewContainer}>
                  <Calendar size={16} color="#10B981" />
                  <Text style={styles.previewText}>Next payment: {nextOccurrence}</Text>
                </View>
              )}

              <TouchableOpacity style={styles.primaryButton} onPress={saveFixedExpense} activeOpacity={0.8}>
                <Plus size={18} color="#fff" />
                <Text style={styles.primaryButtonText}>Add Expense</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Receipts Section */}
        
        <View style={styles.section}>
        <Text style={styles.sectionTitle}>Expenses</Text>
         
            <ReceiptDownloadByDate />

        <View style={styles.card}>
          <TouchableOpacity
            style={styles.actionCard}
            activeOpacity={0.7}
            onPress={() => setReceiptModalVisible(true)}
          >
            <View style={styles.actionCardLeft}>
              <View style={[styles.iconContainer, styles.iconContainerPurple]}>
                <CloudUpload size={20} color="#8B5CF6" />
              </View>
              <View>
                <Text style={styles.cardTitle}>Upload Receipt</Text>
                <Text style={styles.cardSubtitle}>Add an expense receipt</Text>
              </View>
            </View>
            <ChevronDown size={20} color="#6B7280" style={{ transform: [{ rotate: '-90deg' }] }} />
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={receiptModalVisible} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.backdrop}>
          <View style={styles.modalCard}>
            <Receipts onClose={() => setReceiptModalVisible(false)} />
          </View>
        </View>
      </Modal>

      {/* Income Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Incomes</Text>
        <IncomesDownloadByDate />
        <View style={styles.card}>
          <TouchableOpacity
            onPress={() => setVisible(true)}
            style={styles.actionCard}
            activeOpacity={0.7}
          >
            <View style={styles.actionCardLeft}>
              <View style={[styles.iconContainer, styles.iconContainerGreen]}>
                <BanknoteArrowUp size={20} color="#10B981" />
              </View>
              <View>
                <Text style={styles.cardTitle}>New Income Receipt</Text>
                <Text style={styles.cardSubtitle}>Generate income documentation</Text>
              </View>
            </View>
            <ChevronDown size={20} color="#6B7280" style={{ transform: [{ rotate: '-90deg' }] }} />
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={visible} animationType="fade" transparent onRequestClose={() => setVisible(false)}>
        <View style={styles.backdrop}>
          <View style={styles.modalCard}>
            <IncomeReceiptGenerator
              onSubmit={(data) => {
                submitIncomeReceipt(data);
                setVisible(false);
              }}
              onClose={() => setVisible(false)}
            />
          </View>
        </View>
      </Modal>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
   
  },

  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 24,
    backgroundColor: "#FFFFFF",
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  headerTitle: {
    fontSize: 32,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 6,
    letterSpacing: -0.5,
  },

  headerSubtitle: {
    fontSize: 15,
    color: "#64748B",
    lineHeight: 22,
  },

  section: {
    paddingHorizontal: 20,
    marginTop: 24,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1E293B",
    marginBottom: 12,
    letterSpacing: -0.3,
  },

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
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },

  iconContainerPurple: {
    backgroundColor: "#F3E8FF",
  },

  iconContainerGreen: {
    backgroundColor: "#D1FAE5",
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

  inputGroup: {
    gap: 8,
  },

  inputLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#475569",
  },

  input: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: "#0F172A",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  freqRow: {
    flexDirection: "row",
    gap: 8,
  },

  freqPill: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  freqPillActive: {
    backgroundColor: "#EFF6FF",
    borderColor: "#0A7AFF",
  },

  freqText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#64748B",
  },

  freqTextActive: {
    color: "#0A7AFF",
    fontWeight: "600",
  },

  selectorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  selector: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  selectorActive: {
    backgroundColor: "#EFF6FF",
    borderColor: "#0A7AFF",
  },

  selectorText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#64748B",
  },

  selectorTextActive: {
    fontSize: 13,
    color: "#0A7AFF",
    fontWeight: "600",
  },

  previewContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#ECFDF5",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },

  previewText: {
    fontSize: 14,
    color: "#059669",
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

  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 18,
  },

  actionCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },

  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },

  modalCard: {
    width: "92%",
    height: "90%",
    backgroundColor: "#ffffff",
    borderRadius: 24,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
    overflow: "hidden",
  },
});