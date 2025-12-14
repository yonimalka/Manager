import React, { useState } from "react";
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
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase"; // <-- your firebase config
import { useNavigation } from "@react-navigation/native";
import api from "../services/api"; // optional (metadata save)

const isRTL = I18nManager.isRTL;

export default function Receipts({ projectId, userId }) {
  const navigation = useNavigation();

  const [image, setImage] = useState(null);
  const [category, setCategory] = useState("");
  const [sum, setSum] = useState("");
  const [loading, setLoading] = useState(false);

  // -------------------------------
  // Pick image
  // -------------------------------
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  // -------------------------------
  // Upload to Firebase
  // -------------------------------
  const uploadReceipt = async () => {
    if (!image || !category || !sum) {
      Alert.alert("Missing fields", "Please fill all fields");
      return;
    }

    try {
      setLoading(true);

      // Convert image to blob
      const response = await fetch(image);
      const blob = await response.blob();

      // Firebase path
      const fileRef = ref(
        storage,
        `receipts/${userId}/${projectId}/${Date.now()}.jpg`
      );

      // Upload
      await uploadBytes(fileRef, blob);

      // Get public URL
      const downloadURL = await getDownloadURL(fileRef);

      // OPTIONAL: save metadata to backend
      await api.post("/receipts", {
        projectId,
        category,
        sum: Number(sum),
        imageUrl: downloadURL,
      });

      Alert.alert("Success", "Receipt uploaded");
      navigation.goBack();
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------
  // UI
  // -------------------------------
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Add Receipt</Text>

      <TouchableOpacity style={styles.imageBox} onPress={pickImage}>
        {image ? (
          <Image source={{ uri: image }} style={styles.image} />
        ) : (
          <Text style={styles.imageText}>Tap to select image</Text>
        )}
      </TouchableOpacity>

      <TextInput
        style={styles.input}
        placeholder="Category"
        value={category}
        onChangeText={setCategory}
        textAlign={isRTL ? "right" : "left"}
      />

      <TextInput
        style={styles.input}
        placeholder="Amount"
        keyboardType="numeric"
        value={sum}
        onChangeText={setSum}
        textAlign={isRTL ? "right" : "left"}
      />

      <TouchableOpacity
        style={styles.button}
        onPress={uploadReceipt}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Upload Receipt</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  imageBox: {
    height: 200,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imageText: {
    color: "#777",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
  },
  button: {
    backgroundColor: "#2563eb",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
});
