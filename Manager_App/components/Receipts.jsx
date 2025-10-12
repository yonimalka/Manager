import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Alert,
  TouchableOpacity,
  Image,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  I18nManager,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import axios from "axios";
import { SERVER_URL } from "@env";
import Constants from 'expo-constants';


// const SERVER_URL = Constants.expoConfig.extra.SERVER_URL;

const Receipts = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { projectId, userId } = route.params;

  const [image, setImage] = useState(null);
  const [category, setCategory] = useState("");
  const [sum, setSum] = useState("");

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const handleUpload = async () => {
    
    if (!image || !category || !sum) {
      Alert.alert("Missing Info", "Please complete all fields.");
      return;
    }

    const formData = new FormData();
    formData.append("image", {
      uri: image,
      name: category + ".jpg",
      type: "image/jpeg",
    });
    formData.append("category", category);
    formData.append("projectId", projectId);
    formData.append("sumOfReceipt", Number(sum));

    try {
       console.log("uploading receipt...1");
      await axios.post(`${SERVER_URL}/uploadReceipt/${userId}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      Alert.alert("Success", "Receipt uploaded.");
      navigation.goBack();
    } catch (error) {
      console.error("Uploading reciept error:", error);
      Alert.alert("Upload Failed", "Something went wrong.");
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#f7f9fc" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.header}>הוספת חשבונית</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>קטגוריה</Text>
          <TextInput
            style={styles.input}
            placeholder="כמו: ציוד, חומר וכו'"
            placeholderTextColor="#999"
            value={category}
            onChangeText={setCategory}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>סכום</Text>
          <TextInput
            style={styles.input}
            placeholder="סכום החשבונית"
            placeholderTextColor="#999"
            keyboardType="numeric"
            value={sum}
            onChangeText={setSum}
          />
        </View>

        <TouchableOpacity style={styles.selectButton} onPress={pickImage}>
          <Text style={styles.selectButtonText}>📷 בחר תמונה</Text>
        </TouchableOpacity>

        {image && (
          <Image source={{ uri: image }} style={styles.imagePreview} />
        )}

        <TouchableOpacity style={styles.uploadButton} onPress={handleUpload}>
          <Text style={styles.uploadButtonText}>העלאת חשבונית</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const isRTL = I18nManager.isRTL;

const styles = StyleSheet.create({
  container: {
    paddingTop: 70,
    padding: 24,
    flexGrow: 1,
    backgroundColor: "#f7f9fc",
  },
  header: {
    fontSize: 24,
    fontWeight: "600",
    textAlign: "center", // Keep center alignment as is
    marginBottom: 30,
    color: "#333",
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: "#555",
    marginBottom: 6,
    textAlign: !isRTL ? "right" : "left", // Align label text according to RTL
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: "#000",
    borderWidth: 1,
    borderColor: "#ddd",
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 1,
    textAlign: !isRTL ? "right" : "left", // Align input text accordingly
  },
  selectButton: {
    backgroundColor: "rgb(58, 81, 73)",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 20,
  },
  selectButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
  imagePreview: {
    width: "100%",
    height: 220,
    borderRadius: 10,
    marginBottom: 20,
    resizeMode: "cover",
    borderWidth: 1,
    borderColor: "#ccc",
  },
  uploadButton: {
    backgroundColor: "#10b981",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
  uploadButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});


export default Receipts;
