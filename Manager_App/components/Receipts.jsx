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
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage, auth, signInFirebase } from "./firebase";
import { useNavigation, useRoute } from "@react-navigation/native";
import api from "../services/api";
import { useAuth } from "./useAuth";

const isRTL = I18nManager.isRTL;

export default function Receipts() {
  const navigation = useNavigation();
  const route = useRoute();
  const projectId = route.params?.projectId;
  const { userId } = useAuth();

  const [image, setImage] = useState(null);
  const [category, setCategory] = useState("");
  const [sum, setSum] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  // -------------------------------
  // Pick image from gallery or camera
  // -------------------------------


const pickImage = async (fromCamera = false) => {
  try {
    // Request permission
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "Permission denied",
        "You need to allow access to your camera or gallery."
      );
      return;
    }

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images, 
          quality: 0.7,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.7,
        });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  } catch (err) {
    console.error("ImagePicker error:", err);
    Alert.alert("Error", "Could not open camera/gallery");
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

    if (!userId || !projectId) {
      Alert.alert("Error", "User or project ID missing");
      return;
    }

    try {
      setLoading(true);
      setProgress(0);

      // Sign in if not authenticated
      if (!auth.currentUser) {
        await signInFirebase();
      }

      // Convert image to blob
      const response = await fetch(image);
      const blob = await response.blob();

      // Create unique storage path
      const filePath = `receipts/${userId}/${projectId}/${category}.jpg`;
      const fileRef = ref(storage, filePath);

      // Upload with progress
      const uploadTask = uploadBytesResumable(fileRef, blob);
      uploadTask.on(
        "state_changed",
        snapshot => {
          const prog = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setProgress(Math.round(prog));
        },
        error => {
          console.error("Firebase Storage upload error:", error);
          Alert.alert("Upload error", error.message);
          setLoading(false);
        },
        async () => {
          const downloadURL = await getDownloadURL(fileRef);
          console.log("File uploaded to:", filePath);
          console.log("Download URL:", downloadURL);

          await api.post("/uploadReceipt", {
            projectId,
            category,
            sumOfReceipt: Number(sum),
            imageUrl: downloadURL,
          });

          Alert.alert("Success", "Receipt uploaded successfully!");
          navigation.goBack();
        }
      );
    } catch (err) {
      console.error("Upload exception:", err);
      Alert.alert("Error", "Upload failed: " + (err.message || err.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Add Receipt</Text>

      <TouchableOpacity style={styles.imageBox} onPress={() => pickImage(false)}>
        {image ? (
          <Image source={{ uri: image }} style={styles.image} />
        ) : (
          <Text style={styles.imageText}>Tap to select image</Text>
        )}
      </TouchableOpacity>

      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 15 }}>
        <TouchableOpacity style={styles.smallButton} onPress={() => pickImage(false)}>
          <Text style={styles.buttonText}>Gallery</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.smallButton} onPress={() => pickImage(true)}>
          <Text style={styles.buttonText}>Camera</Text>
        </TouchableOpacity>
      </View>

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

      {loading && <Text>Uploading: {progress}%</Text>}

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
  container: { flex: 1, padding: 20, backgroundColor: "#fff" },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 20, textAlign: "center" },
  imageBox: {
    height: 200,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
    overflow: "hidden",
  },
  image: { width: "100%", height: "100%" },
  imageText: { color: "#777" },
  input: { borderWidth: 1, borderColor: "#ccc", padding: 12, borderRadius: 8, marginBottom: 15 },
  button: { backgroundColor: "#2563eb", padding: 15, borderRadius: 10, alignItems: "center" },
  smallButton: { backgroundColor: "#2563eb", padding: 10, borderRadius: 8, width: "48%", alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});
