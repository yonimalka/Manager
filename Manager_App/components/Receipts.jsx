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
import { Camera, Image as ImageIcon, X, Upload, Check } from "lucide-react-native";

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
  // Image Picker
  // -------------------------------
  const pickImage = async (fromCamera = false) => {
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Permission denied");
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
  };

  // -------------------------------
  // Upload Receipt
  // -------------------------------
  const uploadReceipt = async () => {
    if (!image || !category || !sum) {
      Alert.alert("Missing fields");
      return;
    }

    try {
      setLoading(true);
      setProgress(0);

      if (!auth.currentUser) {
        await signInFirebase();
      }

      const blob = await (await fetch(image)).blob();
        const fileRef = ref(
        storage,
        `receipts/${userId}/${projectId}/${Date.now()}.jpg`
        )
      
     

      const uploadTask = uploadBytesResumable(fileRef, blob);
      uploadTask.on(
        "state_changed",
        snap => {
          setProgress(
            Math.round((snap.bytesTransferred / snap.totalBytes) * 100)
          );
        },
        err => {
          Alert.alert("Upload failed", err.message);
          setLoading(false);
        },
        async () => {
          const url = await getDownloadURL(fileRef);
          await api.post("/uploadReceipt", {
            projectId,
            category,
            sumOfReceipt: Number(sum),
            imageUrl: url,
          });
          // Alert.alert("Success");
        }
      );
    } finally {
      navigation.goBack();
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.header}>Upload Receipt</Text>
      <Text style={styles.subHeader}>
        Capture or upload your receipt
      </Text>

      {/* Card */}
      <View style={styles.card}>
        {/* Category */}
        <Text style={styles.label}>Category</Text>
        <TextInput
          value={category}
          onChangeText={setCategory}
          placeholder="Office, Food, Software..."
          style={styles.input}
          textAlign={isRTL ? "right" : "left"}
        />

        {/* Amount */}
        <Text style={styles.label}>Amount</Text>
        <TextInput
          value={sum}
          onChangeText={setSum}
          placeholder="0.00"
          keyboardType="numeric"
          style={styles.input}
          textAlign={isRTL ? "right" : "left"}
        />

        {/* Image Section */}
        <Text style={styles.label}>Receipt Image</Text>

        {!image ? (
          <>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => pickImage(true)}
            >
              <Camera color="#fff" size={22} />
              <Text style={styles.primaryText}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => pickImage(false)}
            >
              <ImageIcon size={22} />
              <Text style={styles.secondaryText}>Choose from Gallery</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.imagePreview}>
            <Image source={{ uri: image }} style={styles.previewImage} />

            <TouchableOpacity
              style={styles.removeBtn}
              onPress={() => setImage(null)}
            >
              <X size={18} />
            </TouchableOpacity>

            <View style={styles.imageOverlay}>
              <Check size={14} color="#fff" />
              <Text style={styles.overlayText}>Ready</Text>
            </View>
          </View>
        )}
      </View>

      {/* Upload Button */}
      <TouchableOpacity
        style={[
          styles.uploadButton,
          (!image || !category || !sum) && { opacity: 0.4 },
        ]}
        onPress={uploadReceipt}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Upload size={20} color="#fff" />
            <Text style={styles.uploadText}>
              Upload Receipt
            </Text>
          </>
        )}
      </TouchableOpacity>

      {loading && (
        <Text style={styles.progressText}>
          Uploading… {progress}%
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F5F6F8",
    padding: 20,
    paddingTop: 50,
  },
  header: {
    fontSize: 32,
    fontWeight: "700",
    marginBottom: 4,
  },
  subHeader: {
    color: "#6B7280",
    marginBottom: 20,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
    color: "#374151",
  },
  input: {
    backgroundColor: "#F3F4F6",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: "#2563EB",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  primaryText: {
    color: "#fff",
    fontWeight: "600",
  },
  secondaryButton: {
    backgroundColor: "#E5E7EB",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  secondaryText: {
    fontWeight: "600",
  },
  imagePreview: {
    borderRadius: 16,
    overflow: "hidden",
    marginTop: 10,
  },
  previewImage: {
    width: "100%",
    height: 220,
  },
  removeBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 6,
  },
  imageOverlay: {
    position: "absolute",
    bottom: 10,
    right: 10,
    backgroundColor: "#22C55E",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  overlayText: {
    color: "#fff",
    fontSize: 12,
  },
  uploadButton: {
    backgroundColor: "#2563EB",
    marginTop: 20,
    borderRadius: 20,
    padding: 18,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  uploadText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  progressText: {
    textAlign: "center",
    marginTop: 10,
    color: "#6B7280",
  },
});
