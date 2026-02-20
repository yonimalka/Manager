import React, { useState } from "react";
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
} from "lucide-react-native";
import api from "../services/api";
import { useAuth } from "./useAuth";
import { generateIncomeReceiptPDF } from "../services/generateIncomePDF";

export default function IncomeReceiptGenerator({ onSubmit, onClose, projectId }) {
  const { userId } = useAuth();
  const [amount, setAmount] = useState("");
  const [payer, setPayer] = useState("");
  const [payerAddress, setPayerAddress] = useState("");
  const [payerTaxId, setPayerTaxId] = useState("");
  const [category, setCategory] = useState("");
  const [receiptNumber, setReceiptNumber] = useState(
    `REC-${Date.now().toString().slice(-8)}`
  );
  const [date, setDate] = useState(new Date());
  const [showDate, setShowDate] = useState(false);
  const [description, setDescription] = useState("");
  const [image, setImage] = useState(null);
  const [errors, setErrors] = useState({});

  // Validation
  const validateForm = () => {
    const newErrors = {};

    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      newErrors.amount = "Please enter a valid amount";
    }

    if (!payer.trim()) {
      newErrors.payer = "Payer name is required";
    }

    if (!category.trim()) {
      newErrors.category = "Category/Service is required";
    }

    if (!description.trim()) {
      newErrors.description = "Description is required for tax purposes";
    }

    // Optional EIN/SSN validation (basic format check)
    if (payerTaxId && !validateTaxId(payerTaxId)) {
      newErrors.payerTaxId = "Invalid Tax ID format (use XX-XXXXXXX or XXX-XX-XXXX)";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateTaxId = (id) => {
    // Basic EIN (XX-XXXXXXX) or SSN (XXX-XX-XXXX) format
    const einPattern = /^\d{2}-\d{7}$/;
    const ssnPattern = /^\d{3}-\d{2}-\d{4}$/;
    return einPattern.test(id) || ssnPattern.test(id);
  };

  const formatAmount = (value) => {
    // Remove non-numeric characters except decimal point
    const cleaned = value.replace(/[^0-9.]/g, "");
    // Ensure only one decimal point
    const parts = cleaned.split(".");
    if (parts.length > 2) {
      return parts[0] + "." + parts.slice(1).join("");
    }
    return cleaned;
  };

  const handleAmountChange = (value) => {
    const formatted = formatAmount(value);
    setAmount(formatted);
    if (errors.amount) {
      setErrors({ ...errors, amount: null });
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Please grant camera roll permissions to attach documents."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Please grant camera permissions to take photos."
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: true,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      Alert.alert("Validation Error", "Please fill in all required fields correctly.");
      return;
    }
    
    try {
      const receiptData = {
      receiptNumber,
      amount: Number(amount),
      payer: payer.trim(),
      payerAddress: payerAddress.trim() || null,
      payerTaxId: payerTaxId.trim() || null,
      category: category.trim(),
      currency: "USD",
      date: date.toISOString(),
      description: description.trim(),
      image,
      createdAt: new Date().toISOString(),
    };
    const response = await api.get(`/getUserDetails/${userId}`);
    const userDetails = response.data;
     const pdfUrl = await generateIncomeReceiptPDF(
      receiptData,
      userDetails,
      {
        userId,
        projectId,
        allowSharing: true,
        // onProgress: (progress) => {
        //   setProgress(progress);
        // },
      }
    );

    receiptData.pdfUrl = pdfUrl.downloadURL;
    onSubmit(receiptData);
    } catch (err) {
      console.error("error occurd on Receipt Generator", err);
      
    }
    
  };

  return (
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
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Income Receipt</Text>
              <Text style={styles.subtitle}>Tax-Compliant Documentation</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Receipt Number */}
          <View style={styles.receiptNumberContainer}>
            <Hash size={16} color="#6B7280" />
            <Text style={styles.receiptNumberLabel}>Receipt #</Text>
            <Text style={styles.receiptNumber}>{receiptNumber}</Text>
          </View>

          {/* Form Card */}
          <View style={styles.card}>
            {/* Amount */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Payment Details</Text>
              
              <FormInput
                icon={<DollarSign size={20} color="#16a34a" />}
                value={amount}
                onChange={handleAmountChange}
                placeholder="0.00"
                keyboardType="decimal-pad"
                error={errors.amount}
                label="Amount (USD)"
                required
              />

              {/* Date */}
              <TouchableOpacity
                style={[styles.inputRow, errors.date && styles.inputError]}
                onPress={() => setShowDate(true)}
              >
                <Calendar size={20} color="#6B7280" />
                <View style={styles.dateContent}>
                  <Text style={styles.inputLabel}>Payment Date *</Text>
                  <Text style={styles.dateText}>
                    {date.toLocaleDateString("en-US", {
                      weekday: "short",
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </Text>
                </View>
              </TouchableOpacity>

              {showDate && (
                <DateTimePicker
                  value={date}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={(event, selectedDate) => {
                    setShowDate(Platform.OS === "ios");
                    if (selectedDate) {
                      setDate(selectedDate);
                    }
                  }}
                  maximumDate={new Date()}
                />
              )}
            </View>

            {/* Payer Information */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Payer Information</Text>
              
              <FormInput
                icon={<User size={20} color="#6B7280" />}
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

              <FormInput
                icon={<Building2 size={20} color="#6B7280" />}
                value={payerAddress}
                onChange={setPayerAddress}
                placeholder="123 Main St, City, State ZIP"
                label="Payer Address"
                optional
              />

              <FormInput
                icon={<Hash size={20} color="#6B7280" />}
                value={payerTaxId}
                onChange={(val) => {
                  setPayerTaxId(val);
                  if (errors.payerTaxId) setErrors({ ...errors, payerTaxId: null });
                }}
                placeholder="XX-XXXXXXX (EIN) or XXX-XX-XXXX (SSN)"
                error={errors.payerTaxId}
                label="Tax ID (EIN/SSN)"
                optional
              />
            </View>

            {/* Service Details */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Service Details</Text>
              
              <FormInput
                icon={<Tag size={20} color="#6B7280" />}
                value={category}
                onChange={(val) => {
                  setCategory(val);
                  if (errors.category) setErrors({ ...errors, category: null });
                }}
                placeholder="Consulting, Design, Development, etc."
                error={errors.category}
                label="Category/Type of Service"
                required
              />

              <View style={styles.textAreaContainer}>
                <Text style={styles.inputLabel}>
                  Description of Services *
                </Text>
                <TextInput
                  placeholder="Detailed description of work performed or services rendered..."
                  value={description}
                  onChangeText={(val) => {
                    setDescription(val);
                    if (errors.description) setErrors({ ...errors, description: null });
                  }}
                  style={[
                    styles.textArea,
                    errors.description && styles.inputError,
                  ]}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
                {errors.description && (
                  <Text style={styles.errorText}>{errors.description}</Text>
                )}
                <Text style={styles.helperText}>
                  Required for IRS documentation. Be specific about services provided.
                </Text>
              </View>
            </View>

            {/* Attachment */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Supporting Documentation</Text>
              
              {image ? (
                <View style={styles.imagePreviewContainer}>
                  <Image source={{ uri: image }} style={styles.imagePreview} />
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={() => setImage(null)}
                  >
                    <X size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.uploadButtons}>
                  <TouchableOpacity
                    style={styles.uploadButton}
                    onPress={pickImage}
                  >
                    <FileText size={20} color="#6B7280" />
                    <Text style={styles.uploadButtonText}>Choose File</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.uploadButton}
                    onPress={takePhoto}
                  >
                    <Camera size={20} color="#6B7280" />
                    <Text style={styles.uploadButtonText}>Take Photo</Text>
                  </TouchableOpacity>
                </View>
              )}
              <Text style={styles.helperText}>
                Optional: Attach invoice, contract, or supporting document
              </Text>
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
            <CheckCircle2 size={20} color="#fff" />
            <Text style={styles.submitButtonText}>Generate Receipt</Text>
          </TouchableOpacity>

          {/* Disclaimer */}
          <View style={styles.disclaimer}>
            <Text style={styles.disclaimerText}>
              📋 This receipt will be stored for tax reporting purposes. Ensure all
              information is accurate and complete.
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Reusable Input Component
const FormInput = ({
  icon,
  value,
  onChange,
  placeholder,
  error,
  label,
  required,
  optional,
  keyboardType = "default",
}) => (
  <View style={styles.formInputContainer}>
    {label && (
      <Text style={styles.inputLabel}>
        {label} {required && "*"} {optional && "(Optional)"}
      </Text>
    )}
    <View style={[styles.inputRow, error && styles.inputError]}>
      {icon}
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        style={styles.input}
        keyboardType={keyboardType}
      />
    </View>
    {error && <Text style={styles.errorText}>{error}</Text>}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  screen: {
    paddingTop: 38,
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
  closeButton: {
    padding: 4,
  },
  receiptNumberContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  receiptNumberLabel: {
    fontSize: 14,
    color: "#6B7280",
    marginLeft: 8,
    marginRight: 8,
  },
  receiptNumber: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: "#E5E7EB",
  },
  formInputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: "#F9FAFB",
  },
  inputError: {
    borderColor: "#EF4444",
    backgroundColor: "#FEF2F2",
  },
  input: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: "#111827",
  },
  dateContent: {
    flex: 1,
    marginLeft: 12,
  },
  dateText: {
    fontSize: 16,
    color: "#111827",
    marginTop: 2,
  },
  textAreaContainer: {
    marginBottom: 16,
  },
  textArea: {
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 14,
    minHeight: 100,
    fontSize: 16,
    color: "#111827",
    backgroundColor: "#F9FAFB",
  },
  errorText: {
    fontSize: 12,
    color: "#EF4444",
    marginTop: 6,
    marginLeft: 4,
  },
  helperText: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 6,
    marginLeft: 4,
    fontStyle: "italic",
  },
  uploadButtons: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 8,
  },
  uploadButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    borderStyle: "dashed",
    backgroundColor: "#F9FAFB",
    gap: 8,
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  imagePreviewContainer: {
    position: "relative",
    marginBottom: 12,
  },
  imagePreview: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
  },
  removeImageButton: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "#EF4444",
    borderRadius: 20,
    padding: 8,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  submitButton: {
    flexDirection: "row",
    backgroundColor: "#16a34a",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    gap: 10,
    shadowColor: "#16a34a",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  submitButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  disclaimer: {
    backgroundColor: "#EFF6FF",
    borderLeftWidth: 4,
    borderLeftColor: "#3B82F6",
    borderRadius: 8,
    padding: 16,
    marginTop: 20,
  },
  disclaimerText: {
    fontSize: 13,
    color: "#1E40AF",
    lineHeight: 18,
  },
});