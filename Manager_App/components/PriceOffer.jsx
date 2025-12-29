import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  Animated,
  I18nManager,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import axios from "axios";
import { SERVER_URL } from "@env";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Buffer } from "buffer";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import Entypo from "@expo/vector-icons/Entypo";
import { BlurView } from "expo-blur";
import { useAuth } from "./useAuth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../services/api";

global.Buffer = Buffer;

const PriceOffer = () => {
  const navigation = useNavigation();
  const route = useRoute();
  // const userId = route.params?.userId;

  const [formData, setFormData] = useState({
    clientName: "",
    // projectTitle: "",
    projectType: "",
    projectDetails: "",
    additionalCosts: {
      item: "",
      quantity: "",
      unitPrice: "",
    },
    paymentTerms: "",
    totalPrice: "",
  });

  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (sharing) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.9);
    }
  }, [sharing]);

  const handleChange = (field, value) => {
    // support nested additionalCosts
    if (field.startsWith("additionalCosts.")) {
      const subField = field.split(".")[1];
      setFormData((prev) => ({
        ...prev,
        additionalCosts: { ...prev.additionalCosts, [subField]: value },
      }));
    } else {
      setFormData((prev) => ({ ...prev, [field]: value }));
    }
  };

  const handleSubmit = async () => {
    if (!formData.clientName || !formData.totalPrice) {
      Alert.alert("שגיאה", "אנא מלא את כל השדות החיוניים");
      return;
    }
    setLoading(true);
    setSharing(false);
    try {
      const token = AsyncStorage.getItem("token");
    const form = new FormData();

Object.entries(formData).forEach(([key, value]) => {
  if (key === "additionalCosts" && typeof value === "object") {
    form.append(key, JSON.stringify(value)); 
  } else {
    form.append(key, value);
  }
});
      // console.log(form)
      const response = await api.post(
        '/quoteGenerator',
        form,
        {
          headers: { "Content-Type": "multipart/form-data" },
          responseType: "arraybuffer",
        }
      );

      const fileUri = FileSystem.cacheDirectory + `${formData.clientName}.pdf`;
      const base64data = Buffer.from(response.data, "binary").toString("base64");
      await FileSystem.writeAsStringAsync(fileUri, base64data, {
        encoding: FileSystem.EncodingType.Base64,
      });
      setQuote(fileUri);
      setSharing(true);
    } catch (error) {
      Alert.alert("שגיאה", "יצירת הצעת המחיר נכשלה, נסה שנית.");
      console.error(error);
    }
    setLoading(false);
  };

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialIcons
           name="arrow-back-ios" 
           size={24} 
           color="#374151" 
           style={{
            transform: [{ scaleX: I18nManager.isRTL ? -1 : 1 }],
           }}
           />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>יצירת הצעת מחיר</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Form Card */}
        <View style={styles.card}>
          <Text style={styles.label}>שם לקוח</Text>
          <View style={styles.inputWrapper}>
            <MaterialIcons
              name="person-outline"
              size={20}
              color="#9ca3af"
              style={styles.icon}
            />
            <TextInput
              style={styles.input}
              placeholder="לדוגמא: ישראל ישראלי"
              value={formData.clientName}
              onChangeText={(v) => handleChange("clientName", v)}
            />
          </View>

          <Text style={styles.label}>סוג פרויקט</Text>
          <View style={styles.inputWrapper}>
            <MaterialIcons
              name="work-outline"
              size={20}
              color="#9ca3af"
              style={styles.icon}
            />
            <TextInput
              style={styles.input}
              placeholder="לדוגמא: עיצוב לוגו"
              value={formData.projectType}
              onChangeText={(v) => handleChange("projectType", v)}
            />
          </View>

          <Text style={styles.label}>תיאור שירות/מוצר</Text>
          <View style={[styles.inputWrapper, { alignItems: "flex-start" }]}>
            <MaterialIcons
              name="description"
              size={20}
              color="#9ca3af"
              style={[styles.icon, { top: 12 }]}
            />
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: "top" }]}
              placeholder="לדוגמא: בניית אתר תדמית"
              multiline
              value={formData.projectDetails}
              onChangeText={(v) => handleChange("projectDetails", v)}
            />
          </View>

          <Text style={styles.label}>תנאי תשלום</Text>
          <View style={styles.inputWrapper}>
            <MaterialIcons
              name="credit-card"
              size={20}
              color="#9ca3af"
              style={styles.icon}
            />
            <TextInput
              style={styles.input}
              placeholder="לדוגמא: שוטף + 30"
              value={formData.paymentTerms}
              onChangeText={(v) => handleChange("paymentTerms", v)}
            />
          </View>
        </View>

        {/* Additional Costs Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="add-shopping-cart" size={22} color="#2563eb" />
            <Text style={styles.cardTitle}>עלויות נוספות</Text>
          </View>

          {/* Item */}
          <Text style={styles.label}>פריט</Text>
          <View style={styles.inputWrapper}>
            <MaterialCommunityIcons
              name="package-variant"
              size={20}
              color="#9ca3af"
              style={styles.icon}
            />
            <TextInput
              style={styles.input}
              placeholder="לדוגמא: דומיין"
              value={formData.additionalCosts.item}
              onChangeText={(v) => handleChange("additionalCosts.item", v)}
            />
          </View>

          {/* Quantity + Unit Price */}
          <View style={styles.row}>
            <View style={[styles.inputWrapper, { flex: 1, marginRight: 8 }]}>
              <MaterialCommunityIcons
                name="counter"
                size={20}
                color="#9ca3af"
                style={styles.icon}
              />
              <TextInput
                style={styles.input}
                placeholder="כמות"
                keyboardType="numeric"
                value={formData.additionalCosts.quantity}
                onChangeText={(v) => handleChange("additionalCosts.quantity", v)}
              />
            </View>
            <View style={[styles.inputWrapper, { flex: 1, marginLeft: 8 }]}>
              <MaterialCommunityIcons
                name="currency-ils"
                size={20}
                color="#9ca3af"
                style={styles.icon}
              />
              <TextInput
                style={styles.input}
                placeholder="מחיר ליחידה"
                keyboardType="numeric"
                value={formData.additionalCosts.unitPrice}
                onChangeText={(v) => handleChange("additionalCosts.unitPrice", v)}
              />
            </View>
          </View>
        </View>

        {/* Total Price */}
        <KeyboardAvoidingView
                   style={{ flex: 1, backgroundColor: "#f8fafc" }}
                   behavior={Platform.OS === "ios" ? "padding" : undefined}
                 >
        <Text style={styles.label}>מחיר כולל (₪)</Text>
        <View style={styles.inputWrapper}>
          <MaterialIcons
            name="payments"
            size={20}
            color="#9ca3af"
            style={styles.icon}
          />
          <TextInput
            style={styles.input}
            placeholder="5,000"
            keyboardType="numeric"
            value={formData.totalPrice}
            onChangeText={(v) => handleChange("totalPrice", v)}
          />
        </View>
        </KeyboardAvoidingView>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Text style={styles.submitButtonText}>הפקת הצעת מחיר</Text>
              <MaterialIcons
                name="arrow-circle-left"
                size={24}
                color="#fff"
                style={{ marginLeft: 8 }}
              />
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Share Modal */}
      {sharing && (
        <View style={StyleSheet.absoluteFillObject}>
          <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
          <Animated.View
            style={[
              styles.popupContainer,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => navigation.navigate("PdfPreview", { quote })}
              >
                <MaterialIcons name="preview" size={28} color="#2a3a55" />
                <Text style={styles.actionText}>תצוגה מקדימה</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.shareButton]}
                onPress={() => Sharing.shareAsync(quote)}
              >
                <Entypo name="share-alternative" size={28} color="#fff" />
                <Text style={[styles.actionText, { color: "#fff" }]}>שתף</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      )}
    </View>
  );
};

const isRTL = I18nManager.isRTL;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f1f5f9" },
  header: {
    paddingTop: 70,
    flexDirection: !isRTL ? "row" : "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(255,255,255,0.9)",
    // borderBottomWidth: 1,
    // borderColor: "#e5e7eb",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  scrollContainer: { padding: 16, paddingBottom: 80 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#2563eb",
    marginBottom: 4,
    marginTop: 8,
    textAlign: isRTL ? "left" : "right",
  },
  inputWrapper: {
    flexDirection: isRTL ? "row" : "row-reverse",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    backgroundColor: "#fff",
    marginBottom: 12,
    paddingHorizontal: 12,
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  row: {
    flexDirection: I18nManager.isRTL ? "row-reverse" : "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  icon: { marginRight: 8 },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111827",
    textAlign: !isRTL ? "right" : "left",
    marginRight: 10,
  },
  cardHeader: {
    flexDirection: isRTL ? "row" : "row-reverse",
    alignItems: "center",
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginRight: 8,
  },
  // footer: {
  //   padding: 16,
  //   backgroundColor: "rgba(255,255,255,0.9)",
  //   borderTopWidth: 1,
  //   borderColor: "#e5e7eb",
  // },
  submitButton: {
    flexDirection: isRTL ? "row" : "row-reverse",
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    width: 300,
    // marginBottom: 20,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    height: 56,
    backgroundColor: "#2563eb",
    shadowColor: "#2563eb",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 4,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    margin: 8,
  },
  popupContainer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
    zIndex: 10,
  },
  actionsRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 24,
  },
  actionButton: {
    backgroundColor: "#f9fafb",
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: "center",
    width: 120,
    marginHorizontal: 10,
    elevation: 3,
  },
  shareButton: { backgroundColor: "#2563eb" },
  actionText: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
});

export default PriceOffer;
