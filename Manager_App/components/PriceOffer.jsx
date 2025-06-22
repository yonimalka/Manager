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
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import axios from "axios";
import { SERVER_URL } from "@env";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Buffer } from "buffer";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Entypo from "@expo/vector-icons/Entypo";
import { BlurView } from "expo-blur";

global.Buffer = Buffer;

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fefefe",
    paddingHorizontal: 30,
    paddingTop: 10,
    
  },
  heading: {
    fontSize: 30,
    fontWeight: "700",
    color: "#2a3a55",
    marginBottom: 30,
    textAlign: "right",
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d0d7de",
    paddingVertical: 18,
    paddingHorizontal: 20,
    fontSize: 17,
    color: "#2a3a55",
    marginBottom: 22,
    shadowColor: "#00000015",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  submitButton: {
    backgroundColor: "#3a86ff",
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 10,
    shadowColor: "#3a86ff",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
  },
  submitButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 20,
  },
  popupContainer: {
  position: "absolute",
  flexDirection: "row",
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
  justifyContent: "center",
  alignItems: "center",
  zIndex: 10,
},
  actionsRow: {
    flexDirection: "row",
  justifyContent: "space-evenly",
  alignItems: "center",
  width: "100%",
  paddingHorizontal: 30,
    
  },
  actionButton: {
    backgroundColor: "#f3f4f6",
    borderRadius: 25,
    paddingVertical: 15,
    paddingHorizontal: 7,
    alignItems: "center",
    alignContent: "center",
    width: 100,
    shadowColor: "#00000010",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  shareButton: {
    backgroundColor: "#3a86ff",
  },
  actionText: {
    marginTop: 10,
    color: "#2a3a55",
    fontSize: 13,
    fontWeight: "5000",
  },
});

export default PriceOffer;
