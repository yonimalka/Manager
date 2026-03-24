import React, { useState, useMemo, useEffect } from "react";
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
  Image, 
  Alert,
} from "react-native";
import { Plus, ChevronDown, ChevronUp, ListChevronsUpDown, Repeat, CloudUpload, BanknoteArrowUp, Calendar, DollarSign, Tag, ListChecks  } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import api from "../services/api";
import ReceiptDownloadByDate from "./ReceiptDownloadByDate";
import IncomesDownloadByDate from "./IncomesDownloadByDate";
import Receipts from "./Receipts";
import IncomeReceiptGenerator from "./IncomesReceiptGenerator";
import { generateIncomeReceiptPDF } from "../services/generateIncomePDF";
import { useAuth } from "./useAuth";
import { formatCurrency } from "../services/formatCurrency";
import { getNextOccurrence } from "../services/getNextOccurrence";
import { formatDate } from "../services/formatDate";
import { ref, uploadBytes, getDownloadURL, uploadBytesResumable  } from "firebase/storage";
import { storage } from "../components/firebase";


if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function FinanceFixedExpenses() {
  const navigation = useNavigation();
  const { userId, userDetails } = useAuth();

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
  const [fixedExpenses, setFixedExpenses] = useState([]);
  const [listExpanded, setListExpanded] = useState(false);
  const [occurrenceModal, setOccurrenceModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [occurrences, setOccurrences] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingFor, setUploadingFor] = useState(null);

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };
  const toggleListExpand = () => {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  setListExpanded(!listExpanded);
};
const openExpenseOccurrences = async (expense) => {
  setSelectedExpense(expense);

  const res = await api.get(`/fixedExpenseOccurrences/${expense._id}`);

  setOccurrences(res.data);

  setOccurrenceModal(true);
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
  const getNextBillingDate = (item) => {
  if (!item.startDate) return null;

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  let next = new Date(item.startDate);
  next.setHours(0, 0, 0, 0);

  while (next < now) {
    if (item.frequency === "monthly") {
      next = new Date(
        next.getFullYear(),
        next.getMonth() + 1,
        item.dayOfMonth || next.getDate(),
      );
    } 
    else if (item.frequency === "weekly") {
      next = new Date(
        next.getFullYear(),
        next.getMonth(),
        next.getDate() + 7
      );
    } 
    else if (item.frequency === "yearly") {
      next = new Date(
        next.getFullYear() + 1,
        next.getMonth(),
        next.getDate()
      );
    } 
    else {
      break;
    }
  }

  return next;
};
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
  const fetchFixedExpenses = async () => {
  const res = await api.get("/fixedExpenses"); 
  setFixedExpenses(res.data);
  };
  useEffect(() => {
  fetchFixedExpenses();
  }, []);
  const toggleActive = async (id) => {
  await api.patch(`/fixedExpense/${id}/toggle`);
  fetchFixedExpenses();
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
const captureReceipt = async (expense, date) => {
  try {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Permission needed", "Camera permission is required.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
    });

    if (result.canceled) return;

    const imageUri = result?.assets?.[0]?.uri;

    if (!imageUri) return;

    setUploadingFor(date);

    await uploadReceipt(
      null,
      expense.title,
      expense.amount,
      imageUri,
      expense._id,
      date
    );

  } catch (err) {
    console.log(err);
  }
};
const confirmUploadReceipt = async () => {
  try {

    setUploadingFor(previewDate);   // ADD THIS

    await uploadReceipt(
      null,
      previewExpense.title,
      previewExpense.amount,
      previewImage,
      previewExpense._id,
      previewDate
    );

    setPreviewModal(false);
    setPreviewImage(null);

  } catch (err) {
    console.log(err);
  }
};
const uploadReceipt = async (
  projectId = null,
  category,
  sum,
  image,
  fixedExpenseId = null,
  occurrenceDate = null
) => {
  try {

    const blob = await (await fetch(image)).blob();

    const fileRef = ref(
      storage,
      `users/${userId}/receipts/fixed-expenses/${fixedExpenseId}/${Date.now()}.jpg`
    );

    const uploadTask = uploadBytesResumable(fileRef, blob);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress =
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100;

        setUploadProgress(Math.round(progress));
      },
      (error) => {
        console.log(error);
        Alert.alert("Upload failed");
        setUploadingFor(null);
        setUploadProgress(0);
      },
      async () => {
        const url = await getDownloadURL(fileRef);

        await api.post("/uploadReceipt", {
          projectId,
          category,
          sumOfReceipt: Number(sum),
          imageUrl: url,
          fixedExpenseId,
          occurrenceDate,
        });

        const res = await api.get(`/fixedExpenseOccurrences/${fixedExpenseId}`);
        setOccurrences(res.data);

        setUploadProgress(0);
        setUploadingFor(null);

        Alert.alert("Success", "Receipt uploaded successfully");
      }
    );
  } catch (err) {
    console.log(err);
  }
};
const viewReceipt = async (receiptId) => {
  try {
    const res = await api.get(`/receipt/${receiptId}`);
    const receipt = res.data;
    
    if (receipt?.imageUrl) {
      const item = receipt.imageUrl
      // Linking.openURL(receipt.imageUrl);
      navigation.navigate("ReceiptPreview", { item })
    }

  } catch (err) {
    console.log(err);
  }
};

  return (
    <ScrollView style={styles.screen} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
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
           <View style={styles.card}>
            <TouchableOpacity
              style={styles.cardHeader}
              onPress={toggleListExpand}
              activeOpacity={0.7}
            >
              <View style={styles.cardHeaderLeft}>
                <View style={styles.iconContainer}>
                  <ListChecks size={20} color="#10B981" />
                </View>
                <View>
                  <Text style={styles.cardTitle}>All Fixed Expenses</Text>
                  <Text style={styles.cardSubtitle}>
                    Manage recurring payments
                  </Text>
                </View>
              </View>

              <View style={styles.chevronContainer}>
                {listExpanded ? (
                  <ChevronUp size={20} color="#6B7280" />
                ) : (
                  <ChevronDown size={20} color="#6B7280" />
                )}
              </View>
            </TouchableOpacity>
              
            {listExpanded && (
              <View style={{ paddingHorizontal: 18, paddingBottom: 18 }}>
                {fixedExpenses.length === 0 ? (
                  <Text style={{ color: "#94A3B8", fontSize: 14 }}>
                    No recurring expenses yet
                  </Text>
                ) : (
                  fixedExpenses.map((item) => (
                    <TouchableOpacity
                      key={item._id}
                      style={styles.fixedItem}
                      activeOpacity={0.7}
                    >
                      <TouchableOpacity
                        style={styles.checkbox}
                        onPress={() => toggleActive(item._id)}
                      >
                        {item.isActive && <View style={styles.checkboxInner} />}
                      </TouchableOpacity>

                       <View 
                       style={{ flex: 1, marginLeft: 12 }}
                       >
                        <Text
                          style={[
                            styles.fixedTitle,
                            !item.isActive && styles.fixedTitleInactive,
                          ]}
                        >
                          {item.title}
                        </Text>
                        
                        <Text style={styles.fixedAmount}>
                          {formatCurrency(
                            item.amount || 0,
                            userDetails?.currency || "USD",
                            userDetails?.locale || "en-US"
                          )} / {item.frequency} • next on{" "}
                          {formatDate(
                            getNextOccurrence(item),
                            userDetails?.locale || "en-US"
                          )}
                        </Text>
                      </View>
                       <TouchableOpacity
                        
                        onPress={() => openExpenseOccurrences(item)}
                      >
                      <ListChevronsUpDown/>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))
                )}
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
    <Modal
  visible={occurrenceModal}
  transparent
  animationType="fade"
  statusBarTranslucent
>
  <View style={styles.modalBackdrop}>
    <View style={styles.timelineModal}>

      {/* Header */}
      <View style={styles.timelineHeader}>
        <Text style={styles.timelineTitle}>
          {selectedExpense?.title}
        </Text>

        <TouchableOpacity onPress={() => setOccurrenceModal(false)}>
          <Ionicons name="close" size={22} color="#64748B" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {occurrences.map((o, index) => {

          const hasReceipt = !!o.receiptId;

          return (
            <View key={index} style={styles.timelineRow}>

              {/* Timeline indicator */}
              <View style={styles.timelineLeft}>
                <View
                  style={[
                    styles.timelineDot,
                    { backgroundColor: hasReceipt ? "#10B981" : "#F59E0B" }
                  ]}
                />
                {index !== occurrences.length - 1 && (
                  <View style={styles.timelineLine} />
                )}
              </View>

              {/* Content */}
              <View style={styles.timelineContent}>

                <View style={styles.timelineTopRow}>
                  <Text style={styles.timelineDate}>
                    {new Date(o.date).toLocaleDateString()}
                  </Text>

                  <Text
                    style={[
                      styles.timelineStatus,
                      { color: hasReceipt ? "#10B981" : "#F59E0B" }
                    ]}
                  >
                    {hasReceipt ? "Paid" : "Missing"}
                  </Text>
                </View>
               <View>
                <View style={styles.timelineActions}>

                  {!hasReceipt && (
                    <TouchableOpacity
                      style={styles.timelineUpload}
                      onPress={async () => {
                        setUploadingFor(o.date);
                        await captureReceipt(selectedExpense, o.date);
                      }}
                    >
                      <CloudUpload size={16} color="#fff" />
                      <Text style={styles.timelineUploadText}>
                        Upload Receipt
                      </Text>
                    </TouchableOpacity>
                  )}
                  {uploadingFor?.toString() === o.date?.toString() && uploadProgress > 0 && (
                    <View style={styles.progressContainer}>
                      <View
                        style={[
                          styles.progressBar,
                          { width: `${uploadProgress}%` }
                        ]}
                      />
                      <Text style={styles.progressText}>{uploadProgress}%</Text>
                    </View>
                  )}
                  {hasReceipt && (
                    <TouchableOpacity
                      style={styles.timelineView}
                      onPress={() => viewReceipt(o.receiptId)}
                    >
                      <Text style={styles.timelineViewText}>
                        View Receipt
                      </Text>
                    </TouchableOpacity>
                  )}

                </View>
               </View>
              </View>
            </View>
          );
        })}

      </ScrollView>

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
  backButton: {
    width: 40,
    height: 40, 
    borderRadius: 20, 
    backgroundColor: "rgba(35, 31, 31, 0.2)", 
    alignItems: "center", 
    justifyContent: "center",
    marginBottom: 15,
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
  fixedItem: {
  flexDirection: "row",
  alignItems: "center",
  marginBottom: 14,
  gap: 12,
},

checkbox: {
  width: 22,
  height: 22,
  borderRadius: 6,
  borderWidth: 2,
  borderColor: "#0A7AFF",
  alignItems: "center",
  justifyContent: "center",
},

checkboxInner: {
  width: 12,
  height: 12,
  backgroundColor: "#0A7AFF",
  borderRadius: 3,
},

fixedTitle: {
  fontSize: 15,
  fontWeight: "600",
  color: "#0F172A",
},

fixedTitleInactive: {
  textDecorationLine: "line-through",
  color: "#9CA3AF",
},

fixedAmount: {
  fontSize: 13,
  color: "#64748B",
},
occurrenceTitle: {
  fontSize: 18,
  fontWeight: "600",
  color: "#0F172A",
},

occurrenceDate: {
  fontSize: 15,
  fontWeight: "500",
  color: "#0F172A",
},

occurrenceStatus: {
  fontSize: 12,
  color: "#64748B",
  marginTop: 3,
},

uploadReceiptButton: {
  flexDirection: "row",
  alignItems: "center",
  gap: 6,
  backgroundColor: "#0A7AFF",
  paddingHorizontal: 12,
  paddingVertical: 8,
  borderRadius: 8,
},

uploadReceiptText: {
  color: "#fff",
  fontWeight: "500",
  fontSize: 13,
},

viewReceiptButton: {
  backgroundColor: "#10B981",
  paddingHorizontal: 12,
  paddingVertical: 8,
  borderRadius: 8,
},

viewReceiptText: {
  color: "#fff",
  fontWeight: "500",
  fontSize: 13,
},
modalBackdrop: {
  flex: 1,
  backgroundColor: "rgba(15,23,42,0.55)",
  justifyContent: "center",
  alignItems: "center",
},

timelineModal: {
  width: "92%",
  maxHeight: "75%",
  backgroundColor: "#fff",
  borderRadius: 24,
  padding: 20,
  shadowColor: "#000",
  shadowOpacity: 0.2,
  shadowRadius: 20,
  elevation: 10,
},

timelineHeader: {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 18,
},

timelineTitle: {
  fontSize: 18,
  fontWeight: "600",
  color: "#0F172A",
},

timelineRow: {
  flexDirection: "row",
  marginBottom: 20,
},

timelineLeft: {
  width: 30,
  alignItems: "center",
},

timelineDot: {
  width: 12,
  height: 12,
  borderRadius: 6,
},

timelineLine: {
  width: 2,
  flex: 1,
  backgroundColor: "#E2E8F0",
  marginTop: 4,
},

timelineContent: {
  flex: 1,
  backgroundColor: "#F8FAFC",
  padding: 14,
  borderRadius: 12,
},

timelineTopRow: {
  flexDirection: "row",
  justifyContent: "space-between",
  marginBottom: 8,
},

timelineDate: {
  fontSize: 15,
  fontWeight: "500",
  color: "#0F172A",
},

timelineStatus: {
  fontSize: 13,
  fontWeight: "600",
},

timelineActions: {
  flexDirection: "row",
  gap: 10,
},

timelineUpload: {
  flexDirection: "row",
  alignItems: "center",
  gap: 6,
  backgroundColor: "#0A7AFF",
  paddingHorizontal: 12,
  paddingVertical: 8,
  borderRadius: 8,
},

timelineUploadText: {
  color: "#fff",
  fontSize: 13,
  fontWeight: "500",
},

timelineView: {
  backgroundColor: "#10B981",
  paddingHorizontal: 12,
  paddingVertical: 8,
  borderRadius: 8,
},

timelineViewText: {
  color: "#fff",
  fontSize: 13,
  fontWeight: "500",
},
previewModalCard: {
  width: "90%",
  backgroundColor: "#fff",
  borderRadius: 20,
  padding: 20,
  alignItems: "center",
  maxHeight: "80%",
},

previewTitle: {
  fontSize: 18,
  fontWeight: "600",
  marginBottom: 15,
},

previewImage: {
  width: "100%",
  height: 350,
  borderRadius: 12,
  marginBottom: 20,
},
previewButtons: {
  flexDirection: "row",
  gap: 12,
},

previewCancel: {
  backgroundColor: "#E2E8F0",
  paddingHorizontal: 16,
  paddingVertical: 10,
  borderRadius: 10,
},

previewCancelText: {
  color: "#334155",
  fontWeight: "500",
},

previewUpload: {
  flexDirection: "row",
  alignItems: "center",
  gap: 6,
  backgroundColor: "#0A7AFF",
  paddingHorizontal: 16,
  paddingVertical: 10,
  borderRadius: 10,
},

previewUploadText: {
  color: "#fff",
  fontWeight: "600",
},
progressContainer: {
  marginTop: 8,
  height: 8,
  backgroundColor: "#E2E8F0",
  borderRadius: 6,
  overflow: "hidden",
},

progressBar: {
  height: "100%",
  backgroundColor: "#0A7AFF",
},

progressText: {
  marginTop: 4,
  fontSize: 12,
  color: "#64748B",
},
});