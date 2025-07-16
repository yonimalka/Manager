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
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import axios from "axios";
import { SERVER_URL } from "@env";
import Constants from 'expo-constants';

import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Buffer } from "buffer";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Entypo from "@expo/vector-icons/Entypo";
import { BlurView } from "expo-blur";

global.Buffer = Buffer;
// const SERVER_URL = Constants.expoConfig.extra.SERVER_URL;
const PriceOffer = () => {
 
  const navigation = useNavigation();
  const route = useRoute();
  const userId = route.params?.userId;

  const [formData, setFormData] = useState({
    clientName: "",
    projectTitle: "",
    projectType: "",
    projectDetails: "",
    additionalCosts: "",
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
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.clientName || !formData.projectTitle || !formData.totalPrice) {
      Alert.alert("שגיאה", "אנא מלא את כל השדות החיוניים");
      return;
    }
    setLoading(true);
    setSharing(false);
    try {
      const form = new FormData();
      Object.entries(formData).forEach(([key, value]) => form.append(key, value));

      const response = await axios.post(`${SERVER_URL}/quoteGenerator/${userId}`, form, {
        headers: { "Content-Type": "multipart/form-data" },
        responseType: "arraybuffer",
      });

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
    <View style={styles.container}>
      <Text style={styles.heading}>הצעת מחיר</Text>

      {[
        { key: "clientName", placeholder: "שם הלקוח" },
        { key: "projectTitle", placeholder: "תיאור כללי למסמך" },
        { key: "projectType", placeholder: "סוג הפרוייקט" },
        { key: "projectDetails", placeholder: "תיאור הפרוייקט" },
        { key: "additionalCosts", placeholder: "עלויות נוספות" },
        { key: "totalPrice", placeholder: "מחיר" },
        { key: "paymentTerms", placeholder: "תנאי תשלום" },
      ].map(({ key, placeholder }) => (
        <TextInput
          key={key}
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="#999"
          value={formData[key]}
          onChangeText={(v) => handleChange(key, v)}
          textAlign="right"
          allowFontScaling={false}
        />
      ))}

      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={loading}>
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.submitButtonText}>צור הצעת מחיר</Text>
        )}
      </TouchableOpacity>

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
    <View style={[styles.actionsRow]}>
      <TouchableOpacity
        style={styles.actionButton}
        onPress={() => navigation.navigate("PdfPreview", { quote })}
        accessibilityLabel="תצוגה מקדימה"
      >
        <MaterialIcons name="preview" size={28} color="#2a3a55" />
        <Text style={styles.actionText}>תצוגה מקדימה</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionButton, styles.shareButton]}
        onPress={() => Sharing.shareAsync(quote)}
        accessibilityLabel="שיתוף"
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
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 24,
    backgroundColor: "#fafafa",
  },
  heading: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1f2937",
    textAlign: "center",
    marginBottom: 26,
  },
  input: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    paddingVertical: 16,
    paddingHorizontal: 18,
    fontSize: 16,
    color: "#1f2937",
    marginBottom: 18,
    textAlign: isRTL ? "right" : "left",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  submitButton: {
    backgroundColor: "#2563eb",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 12,
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 4,
  },
  submitButtonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
  },
  popupContainer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: isRTL ? "row" : "row-reverse",
    paddingHorizontal: 30,
    zIndex: 10,
  },
  actionsRow: {
    flexDirection: isRTL ? "row" : "row-reverse",
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
    width: 110,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  shareButton: {
    backgroundColor: "#2563eb",
  },
  actionText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
  },
});

export default PriceOffer;
