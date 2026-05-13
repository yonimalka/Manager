import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
  Alert,
  Modal,
  ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  DollarSign,
  User,
  Tag,
  Calendar,
  FileText,
  Camera,
  X,
  Building2,
  Hash,
  CheckCircle2,
  CreditCard,
  Paperclip,
} from "lucide-react-native";
import api from "../services/api";
import { useAuth } from "./useAuth";
import { generateIncomeReceiptPDF } from "../services/generateIncomePDF";
import { formatCurrency } from "../services/formatCurrency";

// ─── Sub-components ──────────────────────────────────────────────

const SectionCard = ({ iconBg, icon, title, children }) => (
  <View style={styles.card}>
    <View style={styles.cardHeader}>
      <View style={[styles.cardHeaderIcon, { backgroundColor: iconBg }]}>
        {icon}
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
    </View>
    <View style={styles.cardBody}>{children}</View>
  </View>
);

const FieldLabel = ({ label, required, optional }) => (
  <View style={styles.fieldLabelRow}>
    <Text style={styles.fieldLabel}>{label}</Text>
    {required && <Text style={styles.badgeRequired}>Required</Text>}
    {optional && <Text style={styles.badgeOptional}>Optional</Text>}
  </View>
);

const InputField = ({
  icon,
  value,
  onChange,
  placeholder,
  error,
  label,
  required,
  optional,
  keyboardType = "default",
  suffix,
}) => {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      {label && (
        <FieldLabel label={label} required={required} optional={optional} />
      )}
      <View
        style={[
          styles.inputWrap,
          focused && styles.inputWrapFocused,
          error && styles.inputWrapError,
        ]}
      >
        {icon && <View style={styles.inputIcon}>{icon}</View>}
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          style={styles.inputField}
          keyboardType={keyboardType}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {suffix && <Text style={styles.inputSuffix}>{suffix}</Text>}
      </View>
      {error && <Text style={styles.fieldError}>{error}</Text>}
    </View>
  );
};

// ─── Payment methods config ───────────────────────────────────────
const PAYMENT_METHODS = [
  { key: "cash",  label: "Cash",          emoji: "💵" },
  { key: "card",  label: "Credit Card",   emoji: "💳" },
  { key: "bank",  label: "Bank Transfer", emoji: "🏦" },
  { key: "check", label: "Check",         emoji: "📝" },
  { key: "other", label: "Other",         emoji: "🔄" },
];

// ─── Main Component ───────────────────────────────────────────────
export default function IncomeReceiptGenerator({ onSubmit, onClose, projectId }) {
  const { userId, userDetails } = useAuth();
  const [amount, setAmount] = useState("");
  const [payer, setPayer] = useState("");
  const [payerAddress, setPayerAddress] = useState({
    street: "",
    state: "",
    zip: "",
    country: "US",
  });
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [payerTaxId, setPayerTaxId] = useState("");
  const [category, setCategory] = useState("");
  const [receiptNumber, setReceiptNumber] = useState(
    `REC-${Date.now().toString().slice(-8)}`
  );
  const [services, setServices] = useState([
    { id: Date.now(), description: "", quantity: "1", unitPrice: "" },
  ]);
  const [date, setDate] = useState(new Date());
  const [showDate, setShowDate] = useState(false);
  const [description, setDescription] = useState("");
  const [image, setImage] = useState(null);
  const [errors, setErrors] = useState({});
  const [taxRate, setTaxRate] = useState("0");

  // ── Business details one-time prompt ──
  const [bizModalVisible, setBizModalVisible] = useState(false);
  const [bizId, setBizId] = useState("");
  const [bizAddress, setBizAddress] = useState("");
  const [bizZip, setBizZip] = useState("");
  const [bizSaving, setBizSaving] = useState(false);
  const [bizErrors, setBizErrors] = useState({});

  useEffect(() => {
    if (
      userDetails &&
      (!userDetails.businessId || !userDetails.address || !userDetails.zip)
    ) {
      setBizModalVisible(true);
    }
  }, [userDetails]);

  const handleSaveBizDetails = async () => {
    const errs = {};
    if (!bizId.trim()) errs.bizId = "Business ID is required";
    if (!bizAddress.trim()) errs.bizAddress = "Address is required";
    if (!bizZip.trim()) errs.bizZip = "ZIP Code is required";
    if (Object.keys(errs).length) {
      setBizErrors(errs);
      return;
    }
    setBizSaving(true);
    try {
      await api.post("/updateUser", {
        businessId: bizId.trim(),
        address: bizAddress.trim(),
        zip: bizZip.trim(),
      });
      setBizModalVisible(false);
    } catch (e) {
      Alert.alert("Error", "Could not save details. Please try again.");
    } finally {
      setBizSaving(false);
    }
  };

  const numericAmount = Number(amount) || 0;

  const subtotal = services.reduce((sum, service) => {
    const qty = Number(service.quantity) || 0;
    const price = Number(service.unitPrice) || 0;
    return sum + qty * price;
  }, 0);
  const numericRate = Number(taxRate) || 0;
  const tax = +(subtotal * (numericRate / 100)).toFixed(2);
  const total = +(subtotal + tax).toFixed(2);

  // ── Validation ──
  const validateForm = () => {
    const newErrors = {};
    if (!payer.trim()) newErrors.payer = "Payer name is required";
    if (!payerAddress.state.trim()) newErrors.state = "State is required for tax calculation";
    if (!payerAddress.zip.trim()) newErrors.zip = "ZIP Code is required for tax calculation";
    if (services.some((s) => !s.description.trim()))
      newErrors.services = "All services must have a description";
    if (services.some((s) => Number(s.quantity) <= 0))
      newErrors.services = "Quantity must be greater than 0";
    if (payerTaxId && !validateTaxId(payerTaxId))
      newErrors.payerTaxId = "Invalid Tax ID format (use XX-XXXXXXX or XXX-XX-XXXX)";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateTaxId = (id) => {
    const einPattern = /^\d{2}-\d{7}$/;
    const ssnPattern = /^\d{3}-\d{2}-\d{4}$/;
    return einPattern.test(id) || ssnPattern.test(id);
  };

  // ── Services ──
  const addService = () => {
    setServices((prev) => [
      ...prev,
      { id: Date.now(), description: "", quantity: "1", unitPrice: "" },
    ]);
  };
  const removeService = (id) => {
    setServices((prev) => prev.filter((s) => s.id !== id));
  };
  const updateService = (id, field, value) => {
    setServices((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  // ── Image ──
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Please grant camera roll permissions to attach documents.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
    });
    if (!result.canceled) setImage(result.assets[0].uri);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Please grant camera permissions to take photos.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: true });
    if (!result.canceled) setImage(result.assets[0].uri);
  };

  const handlePayerAddressChange = (field, value) => {
    setPayerAddress((prev) => ({ ...prev, [field]: value }));
  };

  const handlePaymentMethodSelect = (method) => setPaymentMethod(method);

  // ── Submit ──
  const handleSubmit = async () => {
    if (!validateForm()) {
      Alert.alert("Validation Error", "Please fill in all required fields correctly.");
      return;
    }
    try {
      const receiptData = {
        receiptNumber, subtotal, services, tax,
        taxRate: numericRate, total, amount: numericAmount,
        payer: payer.trim(), payerAddress,
        payerTaxId: payerTaxId.trim() || null,
        category: category.trim(), currency: "USD",
        date: date.toISOString(), image, paymentMethod,
        createdAt: new Date().toISOString(),
      };
      console.log("Incoming projectId:", projectId);
      const savedReceipt = await api.post("/incomeReceipt", { ...receiptData, projectId });
      const response = await api.get("/getUserDetails");
      const userDetails = response.data;
      const pdfResult = await generateIncomeReceiptPDF(receiptData, userDetails, {
        userId, projectId, allowSharing: true,
      });
      console.log(pdfResult.downloadURL);
      await api.patch(`/incomeReceipt/${savedReceipt.data._id}/pdf`, {
        pdfUrl: pdfResult.downloadURL,
      });
      onSubmit(savedReceipt.data);
    } catch (err) {
      console.error("Receipt generation error:", err.response?.data || err);
      Alert.alert("Error", "Failed to generate receipt");
    }
  };

  // ─── Render ────────────────────────────────────────────────────
  return (
    <>
      {/* ── One-time business details prompt ── */}
      <Modal
        visible={bizModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.bizOverlay}>
          <View style={styles.bizSheet}>
            <View style={styles.bizHandle} />

            <View style={styles.bizIconCircle}>
              <Building2 size={28} color="#3B82F6" />
            </View>

            <Text style={styles.bizTitle}>One last thing</Text>
            <Text style={styles.bizSubtitle}>
              Your business details are printed on every invoice. Fill them once and you're done.
            </Text>

            {/* Business ID */}
            <View style={styles.bizField}>
              <Text style={styles.bizLabel}>Business ID / Tax Number</Text>
              <TextInput
                style={[styles.bizInput, bizErrors.bizId && styles.bizInputError]}
                value={bizId}
                onChangeText={(v) => { setBizId(v); setBizErrors((e) => ({ ...e, bizId: null })); }}
                placeholder="e.g. 12-3456789"
                placeholderTextColor="#9CA3AF"
              />
              {bizErrors.bizId ? <Text style={styles.bizErrText}>{bizErrors.bizId}</Text> : null}
            </View>

            {/* Address */}
            <View style={styles.bizField}>
              <Text style={styles.bizLabel}>Business Address</Text>
              <TextInput
                style={[styles.bizInput, bizErrors.bizAddress && styles.bizInputError]}
                value={bizAddress}
                onChangeText={(v) => { setBizAddress(v); setBizErrors((e) => ({ ...e, bizAddress: null })); }}
                placeholder="123 Main St, New York, NY"
                placeholderTextColor="#9CA3AF"
              />
              {bizErrors.bizAddress ? <Text style={styles.bizErrText}>{bizErrors.bizAddress}</Text> : null}
            </View>

            {/* ZIP */}
            <View style={styles.bizField}>
              <Text style={styles.bizLabel}>ZIP Code</Text>
              <TextInput
                style={[styles.bizInput, bizErrors.bizZip && styles.bizInputError]}
                value={bizZip}
                onChangeText={(v) => { setBizZip(v); setBizErrors((e) => ({ ...e, bizZip: null })); }}
                placeholder="10001"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
              />
              {bizErrors.bizZip ? <Text style={styles.bizErrText}>{bizErrors.bizZip}</Text> : null}
            </View>

            <TouchableOpacity
              style={styles.bizSaveBtn}
              onPress={handleSaveBizDetails}
              disabled={bizSaving}
              activeOpacity={0.85}
            >
              {bizSaving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.bizSaveBtnText}>Save & Continue</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.bizSkipBtn}
              onPress={() => setBizModalVisible(false)}
            >
              <Text style={styles.bizSkipText}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.screen}>

          {/* ── Header ── */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIcon}>
                <FileText size={22} color="#fff" />
              </View>
              <View>
                <Text style={styles.title}>Income Receipt</Text>
                <Text style={styles.subtitle}>Tax-Compliant Documentation</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={16} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* ── Receipt Badge ── */}
          <View style={styles.receiptBadge}>
            <View style={styles.receiptDot} />
            <Text style={styles.receiptBadgeLabel}>Receipt # </Text>
            <Text style={styles.receiptBadgeNum}>{receiptNumber}</Text>
          </View>

          {/* ══════════════════════════════
               1. PAYER INFORMATION
          ══════════════════════════════ */}
          <SectionCard
            iconBg="#dcfce7"
            icon={<User size={16} color="#16a34a" />}
            title="Payer Information"
          >
            <InputField
              icon={<User size={16} color="#9CA3AF" />}
              value={payer}
              onChange={(val) => {
                setPayer(val);
                if (errors.payer) setErrors({ ...errors, payer: null });
              }}
              placeholder="John Doe or ABC Company"
              error={errors.payer}
              label="Payer Name"
              required
            />

            <FieldLabel label="Payer Address" />

            <InputField
              icon={<Building2 size={16} color="#9CA3AF" />}
              value={payerAddress.street}
              onChange={(val) => handlePayerAddressChange("street", val)}
              placeholder="123 Main St"
            />

            <View style={styles.addressGrid}>
              <View style={styles.addressGridItem}>
                <InputField
                  icon={<Hash size={16} color="#9CA3AF" />}
                  value={payerAddress.state}
                  onChange={(val) => {
                    handlePayerAddressChange("state", val);
                    if (errors.state) setErrors({ ...errors, state: null });
                  }}
                  placeholder="NY"
                  error={errors.state}
                  label="State"
                  required
                />
              </View>
              <View style={styles.addressGridItem}>
                <InputField
                  icon={<Hash size={16} color="#9CA3AF" />}
                  value={payerAddress.zip}
                  onChange={(val) => {
                    handlePayerAddressChange("zip", val);
                    if (errors.zip) setErrors({ ...errors, zip: null });
                  }}
                  placeholder="10001"
                  error={errors.zip}
                  label="ZIP Code"
                  required
                  keyboardType="numeric"
                />
              </View>
            </View>

            <InputField
              icon={<Hash size={16} color="#9CA3AF" />}
              value={payerTaxId}
              onChange={(val) => {
                setPayerTaxId(val);
                if (errors.payerTaxId) setErrors({ ...errors, payerTaxId: null });
              }}
              placeholder="XX-XXXXXXX or XXX-XX-XXXX"
              error={errors.payerTaxId}
              label="Tax ID (EIN / SSN)"
              optional
            />
          </SectionCard>

          {/* ══════════════════════════════
               2. SERVICES
          ══════════════════════════════ */}
          <SectionCard
            iconBg="#eff6ff"
            icon={<FileText size={16} color="#3b82f6" />}
            title="Services & Line Items"
          >
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.colDescription, styles.tableHeaderText]}>Description</Text>
              <Text style={[styles.colQty, styles.tableHeaderText]}>Qty</Text>
              <Text style={[styles.colUnit, styles.tableHeaderText]}>Unit $</Text>
              <Text style={[styles.colTotal, styles.tableHeaderText, { textAlign: "right" }]}>Total</Text>
              <View style={styles.colAction} />
            </View>

            {/* Table Rows */}
            {services.map((service) => {
              const lineTotal =
                (Number(service.quantity) || 0) * (Number(service.unitPrice) || 0);
              return (
                <View key={service.id} style={styles.tableRow}>
                  <TextInput
                    style={[styles.colDescription, styles.serviceInput]}
                    placeholder="Service…"
                    placeholderTextColor="#9CA3AF"
                    value={service.description}
                    onChangeText={(val) => updateService(service.id, "description", val)}
                  />
                  <TextInput
                    style={[styles.colQty, styles.serviceInput, { textAlign: "center" }]}
                    value={service.quantity}
                    keyboardType="numeric"
                    onChangeText={(val) =>
                      updateService(service.id, "quantity", val.replace(/[^0-9]/g, ""))
                    }
                  />
                  <TextInput
                    style={[styles.colUnit, styles.serviceInput]}
                    value={service.unitPrice}
                    placeholder="0.00"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="decimal-pad"
                    onChangeText={(val) =>
                      updateService(service.id, "unitPrice", val.replace(/[^0-9.]/g, ""))
                    }
                  />
                  <View style={styles.colTotal}>
                    <Text style={styles.lineTotalText}>
                      {formatCurrency(
                        lineTotal,
                        userDetails?.currency || "USD",
                        userDetails?.locale || "en-US"
                      )}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.colAction}
                    onPress={() => removeService(service.id)}
                  >
                    <View style={styles.removeServiceBtn}>
                      <X size={12} color="#9CA3AF" />
                    </View>
                  </TouchableOpacity>
                </View>
              );
            })}

            {errors.services && (
              <Text style={styles.fieldError}>{errors.services}</Text>
            )}

            <TouchableOpacity onPress={addService} style={styles.addServiceBtn}>
              <Text style={styles.addServiceBtnText}>+ Add Line Item</Text>
            </TouchableOpacity>
          </SectionCard>

          {/* ══════════════════════════════
               3. PAYMENT METHOD
          ══════════════════════════════ */}
          <SectionCard
            iconBg="#f5f3ff"
            icon={<CreditCard size={16} color="#7c3aed" />}
            title="Payment Method"
          >
            <View style={styles.paymentGrid}>
              {PAYMENT_METHODS.map((method) => (
                <TouchableOpacity
                  key={method.key}
                  style={[
                    styles.payOption,
                    paymentMethod === method.key && styles.payOptionActive,
                  ]}
                  onPress={() => handlePaymentMethodSelect(method.key)}
                >
                  <Text style={styles.payEmoji}>{method.emoji}</Text>
                  <Text
                    style={[
                      styles.payLabel,
                      paymentMethod === method.key && styles.payLabelActive,
                    ]}
                  >
                    {method.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </SectionCard>

          {/* ══════════════════════════════
               4. PAYMENT DETAILS
          ══════════════════════════════ */}
          <SectionCard
            iconBg="#fffbeb"
            icon={<DollarSign size={16} color="#d97706" />}
            title="Payment Details"
          >
            <InputField
              icon={<Hash size={16} color="#9CA3AF" />}
              value={taxRate}
              onChange={(val) => setTaxRate(val.replace(/[^0-9.]/g, ""))}
              placeholder="0.00"
              keyboardType="decimal-pad"
              label="Tax Rate"
              optional
              suffix="%"
            />

            {/* Summary Box */}
            <View style={styles.summaryBox}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>
                  {formatCurrency(
                    subtotal.toFixed(2),
                    userDetails?.currency || "USD",
                    userDetails?.locale || "en-US"
                  )}
                </Text>
              </View>
              <View style={[styles.summaryRow, styles.summaryRowBorder]}>
                <View style={styles.summaryLabelRow}>
                  <Text style={styles.summaryLabel}>Sales Tax</Text>
                  <View style={styles.summaryTaxTag}>
                    <Text style={styles.summaryTaxTagText}>
                      {numericRate.toFixed(2)}%
                    </Text>
                  </View>
                </View>
                <Text style={styles.summaryValue}>
                  {formatCurrency(
                    tax.toFixed(2),
                    userDetails?.currency || "USD",
                    userDetails?.locale || "en-US"
                  )}
                </Text>
              </View>
              <View style={[styles.summaryRow, styles.summaryTotalRow]}>
                <Text style={styles.summaryTotalLabel}>Total</Text>
                <Text style={styles.summaryTotalValue}>
                  {formatCurrency(
                    total.toFixed(2),
                    userDetails?.currency || "USD",
                    userDetails?.locale || "en-US"
                  )}
                </Text>
              </View>
            </View>

            {/* Date */}
            <View style={{ marginTop: 16 }}>
              <FieldLabel label="Payment Date" required />
              <TouchableOpacity
                style={styles.dateRow}
                onPress={() => setShowDate(true)}
              >
                <Calendar size={18} color="#9CA3AF" />
                <View style={styles.dateInfo}>
                  <Text style={styles.dateInfoLabel}>Selected date</Text>
                  <Text style={styles.dateInfoVal}>
                    {date.toLocaleDateString("en-US", {
                      weekday: "short",
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </Text>
                </View>
                <View style={styles.dateChip}>
                  <Text style={styles.dateChipText}>Change</Text>
                </View>
              </TouchableOpacity>
            </View>

            {showDate && (
              <DateTimePicker
                value={date}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(event, selectedDate) => {
                  setShowDate(Platform.OS === "ios");
                  if (selectedDate) setDate(selectedDate);
                }}
                maximumDate={new Date()}
              />
            )}
          </SectionCard>

          {/* ── Inline Attachment ── */}
          <View style={styles.attachRow}>
            <Paperclip size={18} color="#9CA3AF" />
            <View style={styles.attachInfo}>
              {image ? (
                <>
                  <Text style={styles.attachedLabel}>Attached</Text>
                  <Text style={styles.attachFilename} numberOfLines={1}>
                    document
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.attachLabel}>Attach Document</Text>
                  <Text style={styles.attachHint}>
                    Invoice, contract, or photo — optional
                  </Text>
                </>
              )}
            </View>
            {image && (
              <>
                <Image source={{ uri: image }} style={styles.attachThumb} />
                <TouchableOpacity
                  onPress={() => setImage(null)}
                  style={styles.attachRemoveBtn}
                >
                  <X size={12} color="#ef4444" />
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity style={styles.attachBtn} onPress={pickImage}>
              <Text style={styles.attachBtnText}>{image ? "Change" : "Browse"}</Text>
            </TouchableOpacity>
          </View>

          {/* ── Submit ── */}
          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
            <CheckCircle2 size={20} color="#fff" />
            <Text style={styles.submitBtnText}>Generate Receipt</Text>
          </TouchableOpacity>

          {/* ── Disclaimer ── */}
          <View style={styles.disclaimer}>
            <Hash size={16} color="#3b82f6" style={{ flexShrink: 0, marginTop: 1 }} />
            <Text style={styles.disclaimerText}>
              This receipt will be stored for tax reporting purposes. Ensure all
              information is accurate and complete before generating.
            </Text>
          </View>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // ── Layout ──
  container: {
    flex: 1,
    backgroundColor: "#f0fdf4",
  },
  scrollView: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  screen: {
    padding: 16,
    paddingTop: 38,
    paddingBottom: 48,
  },

  // ── Header ──
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerIcon: {
    width: 44,
    height: 44,
    backgroundColor: "#16a34a",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#16a34a",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
    lineHeight: 26,
  },
  subtitle: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "500",
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Receipt Badge ──
  receiptBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 99,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginBottom: 16,
    gap: 6,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  receiptDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#16a34a",
  },
  receiptBadgeLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
  },
  receiptBadgeNum: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6B7280",
  },

  // ── Section Card ──
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    backgroundColor: "#F9FAFB",
  },
  cardHeaderIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  cardBody: {
    padding: 16,
  },

  // ── Field ──
  field: {
    marginBottom: 14,
  },
  fieldLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  badgeRequired: {
    fontSize: 10,
    fontWeight: "700",
    color: "#16a34a",
    backgroundColor: "#dcfce7",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    overflow: "hidden",
  },
  badgeOptional: {
    fontSize: 10,
    fontWeight: "600",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  fieldError: {
    fontSize: 12,
    color: "#ef4444",
    marginTop: 5,
  },

  // ── Input Wrap ──
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    backgroundColor: "#fff",
  },
  inputWrapFocused: {
    borderColor: "#16a34a",
    shadowColor: "#16a34a",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
  inputWrapError: {
    borderColor: "#ef4444",
    backgroundColor: "#fef2f2",
  },
  inputIcon: {
    width: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  inputField: {
    flex: 1,
    paddingVertical: 12,
    paddingRight: 14,
    fontSize: 15,
    color: "#111827",
  },
  inputSuffix: {
    paddingRight: 14,
    fontSize: 15,
    fontWeight: "600",
    color: "#6B7280",
  },

  // ── Address grid ──
  addressGrid: {
    flexDirection: "row",
    gap: 10,
  },
  addressGridItem: {
    flex: 1,
  },

  // ── Services Table ──
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  tableHeaderText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  colDescription: { flex: 3, paddingRight: 6 },
  colQty:         { flex: 1, paddingHorizontal: 4 },
  colUnit:        { flex: 1.5, paddingHorizontal: 4 },
  colTotal:       { flex: 1.5, paddingLeft: 4, alignItems: "flex-end" },
  colAction:      { width: 30, alignItems: "center" },

  serviceInput: {
    fontSize: 14,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: "#F9FAFB",
    color: "#111827",
  },
  lineTotalText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  removeServiceBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  addServiceBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#E5E7EB",
    borderRadius: 8,
    gap: 6,
  },
  addServiceBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#16a34a",
  },

  // ── Payment Method ──
  paymentGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  payOption: {
    width: "31%",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    backgroundColor: "#fff",
  },
  payOptionActive: {
    borderColor: "#16a34a",
    backgroundColor: "#dcfce7",
  },
  payEmoji: {
    fontSize: 20,
    lineHeight: 24,
  },
  payLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6B7280",
    textAlign: "center",
  },
  payLabelActive: {
    color: "#15803d",
  },

  // ── Summary Box ──
  summaryBox: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 4,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  summaryRowBorder: {
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  summaryLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  summaryLabel: {
    fontSize: 14,
    color: "#374151",
  },
  summaryValue: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "500",
  },
  summaryTaxTag: {
    backgroundColor: "#fef9c3",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  summaryTaxTagText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#a16207",
  },
  summaryTotalRow: {
    backgroundColor: "#111827",
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  summaryTotalLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  summaryTotalValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },

  // ── Date Row ──
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "#fff",
  },
  dateInfo: {
    flex: 1,
  },
  dateInfoLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  dateInfoVal: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
    marginTop: 2,
  },
  dateChip: {
    backgroundColor: "#dcfce7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  dateChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#16a34a",
  },

  // ── Inline Attachment ──
  attachRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    marginTop: 4,
    marginBottom: 0,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  attachInfo: {
    flex: 1,
  },
  attachLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
  },
  attachedLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#16a34a",
  },
  attachHint: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 1,
  },
  attachFilename: {
    fontSize: 11,
    color: "#16a34a",
    marginTop: 1,
  },
  attachThumb: {
    width: 40,
    height: 40,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  attachRemoveBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#fef2f2",
    alignItems: "center",
    justifyContent: "center",
  },
  attachBtn: {
    backgroundColor: "#F3F4F6",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  attachBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#374151",
  },

  // ── Submit Button ──
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#16a34a",
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 16,
    shadowColor: "#16a34a",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  submitBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
  },

  // ── Disclaimer ──
  disclaimer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 13,
    color: "#1d4ed8",
    lineHeight: 19,
  },

  // ── Business details modal ──
  bizOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  bizSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 28,
    paddingBottom: 44,
    alignItems: "center",
  },
  bizHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EB",
    marginBottom: 24,
  },
  bizIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  bizTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 8,
    textAlign: "center",
  },
  bizSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  bizField: {
    width: "100%",
    marginBottom: 16,
  },
  bizLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 6,
  },
  bizInput: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    paddingVertical: 13,
    paddingHorizontal: 14,
    fontSize: 15,
    color: "#111827",
    width: "100%",
  },
  bizInputError: {
    borderColor: "#EF4444",
  },
  bizErrText: {
    fontSize: 12,
    color: "#EF4444",
    marginTop: 4,
  },
  bizSaveBtn: {
    backgroundColor: "#2563EB",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    width: "100%",
    marginTop: 8,
  },
  bizSaveBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  bizSkipBtn: {
    marginTop: 14,
    paddingVertical: 6,
  },
  bizSkipText: {
    fontSize: 14,
    color: "#9CA3AF",
    fontWeight: "600",
  },
});
