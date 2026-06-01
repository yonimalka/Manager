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
import * as ImageManipulator from "expo-image-manipulator";
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

// ─── Category data ────────────────────────────────────────────────
const CATEGORY_SUGGESTIONS = [
  { name: "Office Supplies", emoji: "📎" },
  { name: "Food & Dining",   emoji: "🍽️" },
  { name: "Software",        emoji: "💻" },
  { name: "Travel",          emoji: "✈️" },
  { name: "Utilities",       emoji: "⚡" },
  { name: "Marketing",       emoji: "📢" },
  { name: "Equipment",       emoji: "🔧" },
  { name: "Other",           emoji: "🎁" },
];

// ─── Sub-components ───────────────────────────────────────────────
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

// ─── Main Component ───────────────────────────────────────────────
export default function Receipts({ onClose, onSubmit, projectId }) {
  const navigation = useNavigation();
  const route = useRoute();
  const { userId, userDetails } = useAuth();

  const [image, setImage]     = useState(null);
  const [category, setCategory] = useState("");
  const [sum, setSum]         = useState("");
  const [notes, setNotes]     = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errors, setErrors]   = useState({});
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const successAnim  = useRef(new Animated.Value(0)).current;

  // ── Helpers ──
  const formatCurrency = (value) => {
    const cleaned = value.replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    if (parts.length > 2) return parts[0] + "." + parts.slice(1).join("");
    if (parts[1] && parts[1].length > 2) return parts[0] + "." + parts[1].slice(0, 2);
    return cleaned;
  };

  const handleAmountChange = (value) => {
    const formatted = formatCurrency(value);
    setSum(formatted);
    if (errors.sum) setErrors({ ...errors, sum: null });
  };

  // ── Validation ──
  const validateForm = () => {
    const newErrors = {};
    if (!image)              newErrors.image    = "Receipt image is required";
    if (!category.trim())    newErrors.category = "Category is required";
    if (!sum || isNaN(sum) || Number(sum) <= 0)
                             newErrors.sum      = "Please enter a valid amount";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Image Picker ──
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
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, allowsEditing: true })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, allowsEditing: true });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
      if (errors.image) setErrors({ ...errors, image: null });
    }
  };

  // ── Category ──
  const selectCategory = (categoryName) => {
    setCategory(categoryName);
    setShowCategorySuggestions(false);
    if (errors.category) setErrors({ ...errors, category: null });
  };

  // ── Upload ──
  const uploadReceipt = async () => {
    if (!validateForm()) {
      Alert.alert("Validation Error", "Please fill all fields");
      return;
    }
    try {
      setLoading(true);
      setProgress(0);

      if (!auth.currentUser) await signInFirebase();

      const compressed = await ImageManipulator.manipulateAsync(
        image,
        [{ resize: { width: 1200 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );

      const receiptRes = await api.post("/receipts/create", {
        projectId, category, sumOfReceipt: Number(sum), notes,
      });
      const receipt = receiptRes.data;

      const blob = await (await fetch(compressed.uri)).blob();
      const fileRef = ref(storage, `users/${userId}/receipts/${receipt._id}.jpg`);
      const uploadTask = uploadBytesResumable(fileRef, blob);

      uploadTask.on(
        "state_changed",
        (snap) => {
          const percent = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
          setProgress(percent);
        },
        (error) => {
          console.log(error);
          Alert.alert("Upload failed");
          setLoading(false);
        },
        async () => {
          const url = await getDownloadURL(fileRef);
          await api.patch(`/receipts/${receipt._id}/image`, { imageUrl: url });
          setLoading(false);
          onSubmit ? onSubmit() : onClose();
        }
      );
    } catch (err) {
      console.log("UPLOAD ERROR:", err?.response?.data || err);
      Alert.alert("Upload Error", err?.response?.data?.message || "Failed to upload receipt");
      setLoading(false);
    }
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
  });

  // ─── Render ────────────────────────────────────────────────────
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

          {/* ── Header ── */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIcon}>
                <Upload size={22} color="#fff" />
              </View>
              <View>
                <Text style={styles.title}>Upload Receipt</Text>
                <Text style={styles.subtitle}>Track your project expenses</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} disabled={loading}>
              <X size={16} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* ══════════════════════════════
               1. CATEGORY
          ══════════════════════════════ */}
          <SectionCard
            iconBg="#eff6ff"
            icon={<Tag size={16} color="#2563EB" />}
            title="Category"
          >
            <FieldLabel label="Select a category" required />

            {/* Selected badge */}
            {category.trim() ? (
              <View style={styles.selectedBadge}>
                <CheckCircle2 size={16} color="#2563EB" />
                <Text style={styles.selectedBadgeText}>{category}</Text>
                <TouchableOpacity
                  onPress={() => setCategory("")}
                  style={styles.clearCatBtn}
                >
                  <X size={14} color="#2563EB" />
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Chip grid */}
            <View style={styles.chipsGrid}>
              {CATEGORY_SUGGESTIONS.map((cat) => (
                <TouchableOpacity
                  key={cat.name}
                  style={[styles.chip, category === cat.name && styles.chipActive]}
                  onPress={() => selectCategory(cat.name)}
                  disabled={loading}
                >
                  <Text style={styles.chipEmoji}>{cat.emoji}</Text>
                  <Text
                    style={[styles.chipLabel, category === cat.name && styles.chipLabelActive]}
                    numberOfLines={2}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Custom input */}
            <FieldLabel label="Or type a custom category" optional />
            <View style={[styles.inputWrap, errors.category && styles.inputWrapError]}>
              <View style={styles.inputIcon}>
                <Tag size={16} color="#9CA3AF" />
              </View>
              <TextInput
                value={category}
                onChangeText={(text) => {
                  setCategory(text);
                  if (errors.category) setErrors({ ...errors, category: null });
                }}
                placeholder="e.g. Insurance, Subscriptions…"
                placeholderTextColor="#9CA3AF"
                style={styles.inputField}
                textAlign={isRTL ? "right" : "left"}
                editable={!loading}
              />
            </View>
            {errors.category && (
              <Text style={styles.fieldError}>{errors.category}</Text>
            )}
          </SectionCard>

          {/* ══════════════════════════════
               2. AMOUNT
          ══════════════════════════════ */}
          <SectionCard
            iconBg="#eff6ff"
            icon={<DollarSign size={16} color="#2563EB" />}
            title="Amount"
          >
            <FieldLabel label="Expense amount" required />
            <View style={[styles.inputWrap, errors.sum && styles.inputWrapError]}>
              <Text style={styles.inputPrefix}>$</Text>
              <TextInput
                value={sum}
                onChangeText={handleAmountChange}
                placeholder="0.00"
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
                style={[styles.inputField, { paddingLeft: 6 }]}
                textAlign={isRTL ? "right" : "left"}
                editable={!loading}
              />
              <Text style={styles.currencyBadge}>{userDetails?.currency || "USD"}</Text>
            </View>
            {errors.sum && (
              <Text style={styles.fieldError}>{errors.sum}</Text>
            )}
            {sum && !errors.sum && Number(sum) > 0 && (
              <Text style={styles.fieldHelper}>
                ${Number(sum).toFixed(2)} will be added to project expenses
              </Text>
            )}
          </SectionCard>

          {/* ══════════════════════════════
               3. NOTES
          ══════════════════════════════ */}
          <SectionCard
            iconBg="#f5f3ff"
            icon={<FileText size={16} color="#7c3aed" />}
            title="Notes"
          >
            <FieldLabel label="Description" optional />
            <View style={[styles.inputWrap, { alignItems: "flex-start" }]}>
              <View style={[styles.inputIcon, { paddingTop: 12 }]}>
                <FileText size={16} color="#9CA3AF" />
              </View>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Add context, vendor name, or details…"
                placeholderTextColor="#9CA3AF"
                style={[styles.inputField, { paddingTop: 12, paddingBottom: 12 }]}
                textAlign={isRTL ? "right" : "left"}
                multiline
                numberOfLines={3}
                editable={!loading}
              />
            </View>
          </SectionCard>

          {/* ══════════════════════════════
               4. RECEIPT IMAGE
          ══════════════════════════════ */}
          <SectionCard
            iconBg="#fff1f2"
            icon={<Camera size={16} color="#e11d48" />}
            title="Receipt Image"
          >
            <FieldLabel label="Attach photo" required />

            {!image ? (
              <>
                {/* Upload action buttons */}
                <View style={styles.uploadActions}>
                  <TouchableOpacity
                    style={styles.btnCamera}
                    onPress={() => pickImage(true)}
                    disabled={loading}
                  >
                    <View style={styles.btnCameraIconWrap}>
                      <Camera size={20} color="#fff" />
                    </View>
                    <Text style={styles.btnCameraText}>Take Photo</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.btnGallery}
                    onPress={() => pickImage(false)}
                    disabled={loading}
                  >
                    <View style={styles.btnGalleryIconWrap}>
                      <ImageIcon size={20} color="#6B7280" />
                    </View>
                    <Text style={styles.btnGalleryText}>From Gallery</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.uploadHintText}>PNG, JPG up to 10MB</Text>

                {errors.image && (
                  <View style={styles.imgErrorBanner}>
                    <AlertCircle size={14} color="#EF4444" />
                    <Text style={styles.imgErrorText}>{errors.image}</Text>
                  </View>
                )}
              </>
            ) : (
              /* Image preview */
              <View style={styles.imgPreviewWrap}>
                <Image source={{ uri: image }} style={styles.previewImage} />
                {!loading && (
                  <TouchableOpacity
                    style={styles.imgRemoveBtn}
                    onPress={() => setImage(null)}
                  >
                    <X size={14} color="#fff" />
                  </TouchableOpacity>
                )}
                <View style={styles.imgReadyBadge}>
                  <CheckCircle2 size={14} color="#fff" />
                  <Text style={styles.imgReadyText}>Ready to upload</Text>
                </View>
              </View>
            )}
          </SectionCard>

          {/* ── Upload Button ── */}
          <TouchableOpacity
            style={[
              styles.uploadBtn,
              (!image || !category || !sum || loading) && styles.uploadBtnDisabled,
            ]}
            onPress={uploadReceipt}
            disabled={!image || !category || !sum || loading}
          >
            {loading ? (
              <>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.uploadBtnText}>Uploading…</Text>
              </>
            ) : (
              <>
                <Upload size={20} color="#fff" />
                <Text style={styles.uploadBtnText}>Upload Receipt</Text>
              </>
            )}
          </TouchableOpacity>

          {/* ── Progress ── */}
          {loading && (
            <View style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>Uploading receipt…</Text>
                <Text style={styles.progressPct}>{progress}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress}%` }]} />
              </View>
            </View>
          )}

          {/* ── Success ── */}
          {loading && progress === 100 && (
            <Animated.View
              style={[
                styles.successCard,
                {
                  opacity: successAnim,
                  transform: [{
                    scale: successAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }),
                  }],
                },
              ]}
            >
              <View style={styles.successIconWrap}>
                <CheckCircle2 size={30} color="#fff" />
              </View>
              <Text style={styles.successTitle}>Receipt Uploaded!</Text>
              <Text style={styles.successSub}>
                Your expense has been added to the project
              </Text>
            </Animated.View>
          )}

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // ── Layout ──
  container: {
    flex: 1,
    backgroundColor: "#eff6ff",
    borderRadius: 20,
  },
  scrollView: {  flex: 1 },
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
    backgroundColor: "#2563EB",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2563EB",
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

  // ── Field label ──
  fieldLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
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
    color: "#2563EB",
    backgroundColor: "#EFF6FF",
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
    color: "#EF4444",
    marginTop: 5,
  },
  fieldHelper: {
    fontSize: 12,
    color: "#2563EB",
    marginTop: 5,
    fontWeight: "500",
  },

  // ── Input wrap ──
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    backgroundColor: "#fff",
  },
  inputWrapError: {
    borderColor: "#EF4444",
    backgroundColor: "#FEF2F2",
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
  inputPrefix: {
    paddingLeft: 14,
    fontSize: 15,
    fontWeight: "700",
    color: "#2563EB",
  },
  currencyBadge: {
    paddingRight: 14,
    fontSize: 12,
    fontWeight: "700",
    color: "#9CA3AF",
  },

  // ── Category: selected badge ──
  selectedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#EFF6FF",
    borderWidth: 1.5,
    borderColor: "#2563EB",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  selectedBadgeText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: "#1D4ED8",
  },
  clearCatBtn: {
    padding: 2,
  },

  // ── Category: chip grid ──
  chipsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  chip: {
    width: "22%",
    alignItems: "center",
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    backgroundColor: "#fff",
  },
  chipActive: {
    borderColor: "#2563EB",
    backgroundColor: "#EFF6FF",
  },
  chipEmoji: {
    fontSize: 18,
    lineHeight: 22,
  },
  chipLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#6B7280",
    textAlign: "center",
  },
  chipLabelActive: {
    color: "#1D4ED8",
  },

  // ── Image upload ──
  uploadActions: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  btnCamera: {
    flex: 1,
    alignItems: "center",
    gap: 8,
    paddingVertical: 20,
    borderRadius: 12,
    backgroundColor: "#2563EB",
    shadowColor: "#2563EB",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  btnCameraIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  btnCameraText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
  btnGallery: {
    flex: 1,
    alignItems: "center",
    gap: 8,
    paddingVertical: 20,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
  },
  btnGalleryIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  btnGalleryText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
  },
  uploadHintText: {
    textAlign: "center",
    fontSize: 12,
    color: "#9CA3AF",
    marginBottom: 4,
  },
  imgErrorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
    borderLeftWidth: 3,
    borderLeftColor: "#EF4444",
  },
  imgErrorText: {
    fontSize: 13,
    color: "#EF4444",
    fontWeight: "600",
    flex: 1,
  },

  // ── Image preview ──
  imgPreviewWrap: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#F3F4F6",
    position: "relative",
  },
  previewImage: {
    width: "100%",
    height: 220,
    backgroundColor: "#E5E7EB",
  },
  imgRemoveBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  imgReadyBadge: {
    position: "absolute",
    bottom: 10,
    right: 10,
    backgroundColor: "rgba(37,99,235,0.95)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  imgReadyText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },

  // ── Upload button ──
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#2563EB",
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 16,
    shadowColor: "#2563EB",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  uploadBtnDisabled: {
    backgroundColor: "#E5E7EB",
    shadowOpacity: 0,
    elevation: 0,
  },
  uploadBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
  },

  // ── Progress ──
  progressCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
  },
  progressPct: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2563EB",
  },
  progressTrack: {
    width: "100%",
    height: 6,
    backgroundColor: "#F3F4F6",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#2563EB",
    borderRadius: 3,
  },

  // ── Success ──
  successCard: {
    alignItems: "center",
    gap: 12,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 16,
    padding: 28,
    marginTop: 12,
  },
  successIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2563EB",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1D4ED8",
  },
  successSub: {
    fontSize: 13,
    color: "#2563EB",
    textAlign: "center",
  },
});
