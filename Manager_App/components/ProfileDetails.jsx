import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  I18nManager,
  Alert,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "./useAuth";
import api from "../services/api";
import { Camera, Trash2 } from "lucide-react-native";

const isRTL = I18nManager.isRTL;

export default function ProfileDetails() {
  const navigation = useNavigation();
  const { userId } = useAuth();

  const [userDetails, setUserDetails] = useState({});
  const [image, setImage] = useState(null);
  const [address, setAddress] = useState("");

  useEffect(() => {
    fetchData();
    console.log(userDetails);
      
  }, [userId]);

  const fetchData = async () => {
    try {
      const res = await api.get(`/getUserDetails/${userId}`);
      setUserDetails(res.data);
      setImage(res.data.logo);
    } catch (err) {
      console.error(err);
    }
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission required");
      return;
    }

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });

    if (!res.canceled) {
      setImage(res.assets[0].uri);
      // uploadLogo(); // keep your existing upload logic
    }
  };

  const handleDelete = async () => {
    Alert.alert(
      "Delete Account",
      "This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await api.delete(`/deleteUser/${userId}`);
            navigation.navigate("LoginScreen");
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>

      {/* Avatar / Logo */}
      <View style={styles.avatarWrapper}>
        {image ? (
          <Image source={{ uri: userDetails.logo }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>
              {userDetails?.name?.[0] || "U"}
            </Text>
          </View>
        )}

        <TouchableOpacity style={styles.cameraBtn} onPress={pickImage}>
          <Camera size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Info Card */}
      <View style={styles.card}>
        <Label title="Name" />
        <TextInput
          value={userDetails.name}
          style={styles.input}
          placeholder="Your name"
        />

        <Label title="Business Name" />
        <TextInput
          value={userDetails.bussinessName}
          style={styles.input}
          placeholder="Business name"
        />
        <Label title="Business ID" />
        <TextInput
          keyboardType="numeric"
          value={String(userDetails.businessId)}
          style={styles.input}
          placeholder="Business ID"
        />
        <View style={styles.field}>
  <Text style={styles.label}>Address</Text>
  <TextInput
    value={userDetails.address}
    onChangeText={setAddress}
    placeholder="Street, City, Postcode"
    placeholderTextColor="#9CA3AF"
    style={styles.input}
    multiline
  />
</View>

        <Label title="Email" />
        <TextInput
          value={userDetails.email}
          style={[styles.input, styles.disabled]}
          editable={false}
        />
      </View>

      {/* Actions */}
      <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
        <Trash2 size={18} color="#dc2626" />
        <Text style={styles.deleteText}>Delete Account</Text>
      </TouchableOpacity>
    </View>
  );
}

const Label = ({ title }) => (
  <Text style={styles.label}>{title}</Text>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F6F8",
    padding: 20,
    paddingTop: 60,
  },

  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 24,
  },

  avatarWrapper: {
    alignItems: "center",
    marginBottom: 24,
  },

  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
  },

  avatarPlaceholder: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
  },

  avatarText: {
    fontSize: 36,
    fontWeight: "700",
    color: "#6B7280",
  },

  cameraBtn: {
    position: "absolute",
    bottom: 0,
    right: "35%",
    backgroundColor: "#2563EB",
    padding: 10,
    borderRadius: 20,
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 4,
    marginBottom: 30,
  },

  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
  },

  input: {
    backgroundColor: "#F3F4F6",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    fontSize: 15,
  },

  disabled: {
    opacity: 0.6,
  },

  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#FEE2E2",
  },

  deleteText: {
    color: "#dc2626",
    fontWeight: "600",
  },
});

