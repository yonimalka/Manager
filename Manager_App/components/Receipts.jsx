import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  StyleSheet,
  I18nManager,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage, auth, signInFirebase } from "./firebase";
import { useNavigation, useRoute } from "@react-navigation/native";
import api from "../services/api";
import { useAuth } from "./useAuth";
import {
  Camera,
  Image as ImageIcon,
  X,
  Upload,
  Check,
  DollarSign,
  Tag,
  FileText,
  CheckCircle2,
  AlertCircle,
} from "lucide-react-native";

const isRTL = I18nManager.isRTL;

// Predefined category suggestions
const CATEGORY_SUGGESTIONS = [
  { name: "Office Supplies", icon: "📎", color: "#3B82F6" },
  { name: "Food & Dining", icon: "🍽️", color: "#F59E0B" },
  { name: "Software", icon: "💻", color: "#8B5CF6" },
  { name: "Travel", icon: "✈️", color: "#06B6D4" },
  { name: "Utilities", icon: "⚡", color: "#10B981" },
  { name: "Marketing", icon: "📢", color: "#EF4444" },
  { name: "Equipment", icon: "🔧", color: "#6B7280" },
  { name: "Other", icon: "📋", color: "#EC4899" },
];

export default function Receipts({ onClose, projectId }) {
  const navigation = useNavigation();
  const route = useRoute();
  // const projectId = route.params?.projectId;
  const { userId } = useAuth();

  const [image, setImage] = useState(null);
  const [category, setCategory] = useState("");
  const [sum, setSum] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errors, setErrors] = useState({});
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);

  // Animation values
  const progressAnim = useRef(new Animated.Value(0)).current;
  const successAnim = useRef(new Animated.Value(0)).current;

  // -------------------------------
  // Format currency input
  // -------------------------------
  const formatCurrency = (value) => {
    const cleaned = value.replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    if (parts.length > 2) {
      return parts[0] + "." + parts.slice(1).join("");
    }
    if (parts[1] && parts[1].length > 2) {
      return parts[0] + "." + parts[1].slice(0, 2);
    }
    return cleaned;
  };

  const handleAmountChange = (value) => {
    const formatted = formatCurrency(value);
    setSum(formatted);
    if (errors.sum) {
      setErrors({ ...errors, sum: null });
    }
  };

  // -------------------------------
  // Validation
  // -------------------------------
  const validateForm = () => {
    const newErrors = {};

    if (!image) {
      newErrors.image = "Receipt image is required";
    }

    if (!category.trim()) {
      newErrors.category = "Category is required";
    }

    if (!sum || isNaN(sum) || Number(sum) <= 0) {
      newErrors.sum = "Please enter a valid amount";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // -------------------------------
  // Image Picker
  // -------------------------------
  const pickImage = async (fromCamera = false) => {
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "Permission Required",
        `Please grant ${fromCamera ? "camera" : "photo library"} permissions to continue.`
      );
      return;
    }

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
          allowsEditing: true,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
          allowsEditing: true,
        });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
      if (errors.image) {
        setErrors({ ...errors, image: null });
      }
    }
  };

  // -------------------------------
  // Category Selection
  // -------------------------------
  const selectCategory = (categoryName) => {
    setCategory(categoryName);
    setShowCategorySuggestions(false);
    if (errors.category) {
      setErrors({ ...errors, category: null });
    }
  };

  // -------------------------------
  // Upload Receipt
  // -------------------------------
  const uploadReceipt = async () => {
    if (!validateForm()) {
      Alert.alert("Validation Error", "Please fill in all required fields correctly.");
      return;
    }

    try {
      setLoading(true);
      setProgress(0);

      // Animate progress bar
      Animated.timing(progressAnim, {
        toValue: 0,
        duration: 100,
        useNativeDriver: false,
      }).start();

      if (!auth.currentUser) {
        await signInFirebase();
      }

      const blob = await (await fetch(image)).blob();
      const fileRef = ref(
        storage,
        `users/${userId}/receipts/${projectId ? projectId : `General`}/${Date.now()}.jpg`
      );

      const uploadTask = uploadBytesResumable(fileRef, blob);

      uploadTask.on(
        "state_changed",
        (snap) => {
          const progressPercent = Math.round(
            (snap.bytesTransferred / snap.totalBytes) * 100
          );
          setProgress(progressPercent);

          // Animate progress
          Animated.timing(progressAnim, {
            toValue: progressPercent,
            duration: 300,
            useNativeDriver: false,
          }).start();
        },
        (err) => {
          Alert.alert("Upload Failed", err.message);
          setLoading(false);
        },
        async () => {
          const url = await getDownloadURL(fileRef);
          await api.post("/uploadReceipt", {
            projectId,
            category,
            sumOfReceipt: Number(sum),
            imageUrl: url,
            notes: notes.trim() || null,
          });

          // Show success animation
          Animated.sequence([
            Animated.timing(successAnim, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.delay(800),
          ]).start(() => {
            setLoading(false);
            onClose();
          });
        }
      );
    } catch (error) {
      Alert.alert("Error", "Failed to upload receipt. Please try again.");
      setLoading(false);
    }
  };

  // Progress bar width
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
  });

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
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.title}>Upload Receipt</Text>
              <Text style={styles.subtitle}>Add expense</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              disabled={loading}
            >
              <X size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Form Card */}
          <View style={styles.card}>
            {/* Category Section */}
            <View style={styles.section}>
              <Text style={styles.label}>
                Category <Text style={styles.required}>*</Text>
              </Text>

              <TouchableOpacity
                style={[styles.inputRow, errors.category && styles.inputError]}
                onPress={() => setShowCategorySuggestions(!showCategorySuggestions)}
                disabled={loading}
              >
                <Tag size={20} color="#6B7280" />
                <Text
                  style={[
                    styles.inputText,
                    !category && styles.placeholderText,
                  ]}
                >
                  {category || "Select or type category..."}
                </Text>
              </TouchableOpacity>

              {errors.category && (
                <Text style={styles.errorText}>{errors.category}</Text>
              )}

              {/* Category Suggestions */}
              {showCategorySuggestions && (
                <View style={styles.suggestionsContainer}>
                  {CATEGORY_SUGGESTIONS.map((cat, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.suggestionChip}
                      onPress={() => selectCategory(cat.name)}
                    >
                      <Text style={styles.suggestionIcon}>{cat.icon}</Text>
                      <Text style={styles.suggestionText}>{cat.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Custom Category Input */}
              <TextInput
                value={category}
                onChangeText={(text) => {
                  setCategory(text);
                  if (errors.category) {
                    setErrors({ ...errors, category: null });
                  }
                }}
                placeholder="Or type custom category..."
                placeholderTextColor="#9CA3AF"
                style={styles.customInput}
                textAlign={isRTL ? "right" : "left"}
                editable={!loading}
              />
            </View>

            {/* Amount Section */}
            <View style={styles.section}>
              <Text style={styles.label}>
                Amount (USD) <Text style={styles.required}>*</Text>
              </Text>

              <View style={[styles.inputRow, errors.sum && styles.inputError]}>
                <DollarSign size={20} color="#16a34a" />
                <TextInput
                  value={sum}
                  onChangeText={handleAmountChange}
                  placeholder="0.00"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="decimal-pad"
                  style={styles.input}
                  textAlign={isRTL ? "right" : "left"}
                  editable={!loading}
                />
              </View>

              {errors.sum && (
                <Text style={styles.errorText}>{errors.sum}</Text>
              )}

              {sum && !errors.sum && Number(sum) > 0 && (
                <Text style={styles.helperText}>
                  ${Number(sum).toFixed(2)} will be added to project expenses
                </Text>
              )}
            </View>

            {/* Notes Section */}
            <View style={styles.section}>
              <Text style={styles.label}>Notes (Optional)</Text>

              <View style={styles.inputRow}>
                <FileText size={20} color="#6B7280" />
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Add description or notes..."
                  placeholderTextColor="#9CA3AF"
                  style={styles.input}
                  textAlign={isRTL ? "right" : "left"}
                  multiline
                  numberOfLines={2}
                  editable={!loading}
                />
              </View>
            </View>

            {/* Image Section */}
            <View style={styles.section}>
              <Text style={styles.label}>
                Receipt Image <Text style={styles.required}>*</Text>
              </Text>

              {!image ? (
                <>
                  <TouchableOpacity
                    style={[
                      styles.primaryButton,
                      errors.image && styles.buttonError,
                    ]}
                    onPress={() => pickImage(true)}
                    disabled={loading}
                  >
                    <Camera color="#fff" size={22} />
                    <Text style={styles.primaryText}>Take Photo</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.secondaryButton,
                      errors.image && styles.buttonError,
                    ]}
                    onPress={() => pickImage(false)}
                    disabled={loading}
                  >
                    <ImageIcon size={22} color="#2563EB" />
                    <Text style={styles.secondaryText}>Choose from Gallery</Text>
                  </TouchableOpacity>

                  {errors.image && (
                    <View style={styles.errorBanner}>
                      <AlertCircle size={16} color="#EF4444" />
                      <Text style={styles.errorBannerText}>{errors.image}</Text>
                    </View>
                  )}
                </>
              ) : (
                <View style={styles.imagePreview}>
                  <Image source={{ uri: image }} style={styles.previewImage} />

                  {!loading && (
                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => setImage(null)}
                    >
                      <X size={18} color="#fff" />
                    </TouchableOpacity>
                  )}

                  <View style={styles.imageOverlay}>
                    <CheckCircle2 size={16} color="#fff" />
                    <Text style={styles.overlayText}>Ready to upload</Text>
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* Upload Button */}
          <TouchableOpacity
            style={[
              styles.uploadButton,
              (!image || !category || !sum || loading) && styles.uploadButtonDisabled,
            ]}
            onPress={uploadReceipt}
            disabled={!image || !category || !sum || loading}
          >
            {loading ? (
              <>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.uploadText}>Uploading...</Text>
              </>
            ) : (
              <>
                <Upload size={20} color="#fff" />
                <Text style={styles.uploadText}>Upload Receipt</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Progress Bar */}
          {loading && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <Animated.View
                  style={[
                    styles.progressFill,
                    { width: progressWidth },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>{progress}%</Text>
            </View>
          )}

          {/* Success Animation */}
          {loading && progress === 100 && (
            <Animated.View
              style={[
                styles.successContainer,
                {
                  opacity: successAnim,
                  transform: [
                    {
                      scale: successAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.8, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              <CheckCircle2 size={48} color="#22C55E" />
              <Text style={styles.successText}>Receipt Uploaded!</Text>
            </Animated.View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

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
    marginTop: 20,
    padding: 20,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
  closeButton: {
    padding: 4,
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
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 10,
  },
  required: {
    color: "#EF4444",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
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
  inputText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: "#111827",
  },
  placeholderText: {
    color: "#9CA3AF",
  },
  customInput: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
    fontSize: 14,
    color: "#111827",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  errorText: {
    fontSize: 12,
    color: "#EF4444",
    marginTop: 6,
    marginLeft: 4,
  },
  helperText: {
    fontSize: 12,
    color: "#16a34a",
    marginTop: 6,
    marginLeft: 4,
    fontWeight: "500",
  },
  suggestionsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 12,
    gap: 8,
  },
  suggestionChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 6,
  },
  suggestionIcon: {
    fontSize: 16,
  },
  suggestionText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
  },
  primaryButton: {
    backgroundColor: "#2563EB",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
    shadowColor: "#2563EB",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  primaryText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  secondaryButton: {
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    borderWidth: 1.5,
    borderColor: "#2563EB",
  },
  secondaryText: {
    fontWeight: "700",
    fontSize: 16,
    color: "#2563EB",
  },
  buttonError: {
    borderColor: "#EF4444",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#EF4444",
  },
  errorBannerText: {
    fontSize: 13,
    color: "#EF4444",
    fontWeight: "600",
    flex: 1,
  },
  imagePreview: {
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 4,
    backgroundColor: "#F3F4F6",
  },
  previewImage: {
    width: "100%",
    height: 240,
    backgroundColor: "#E5E7EB",
  },
  removeBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "#EF4444",
    borderRadius: 20,
    padding: 8,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  imageOverlay: {
    position: "absolute",
    bottom: 12,
    right: 12,
    backgroundColor: "rgba(34, 197, 94, 0.95)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  overlayText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  uploadButton: {
    backgroundColor: "#2563EB",
    marginTop: 20,
    borderRadius: 12,
    padding: 18,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    shadowColor: "#2563EB",
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  uploadButtonDisabled: {
    backgroundColor: "#9CA3AF",
    shadowOpacity: 0.1,
  },
  uploadText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  progressContainer: {
    marginTop: 16,
    alignItems: "center",
  },
  progressBar: {
    width: "100%",
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#2563EB",
    borderRadius: 4,
  },
  progressText: {
    marginTop: 8,
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "600",
  },
  successContainer: {
    alignItems: "center",
    marginTop: 20,
    padding: 20,
    backgroundColor: "#F0FDF4",
    borderRadius: 12,
    gap: 12,
  },
  successText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#22C55E",
  },
});