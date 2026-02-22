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
  Keyboard,
  TouchableWithoutFeedback,
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
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    fetchData();
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

  const handleChange = (field, value) => {
    setUserDetails((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    try {
      console.log(userDetails);
      
      await api.post(`/updateUser`, userDetails);
      setIsEditing(false);
      // Alert.alert("Success", "Profile updated successfully");
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Something went wrong");
    }
  };

  const pickImage = async () => {
    if (!isEditing) return;

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
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>

      {/* Edit Button */}
      {!isEditing && (
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => setIsEditing(true)}
        >
          <Text style={styles.editText}>Edit Details</Text>
        </TouchableOpacity>
      )}

      {/* Avatar */}
      <View style={styles.avatarWrapper}>
        {image ? (
          <Image source={{ uri: image }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>
              {userDetails?.name?.[0] || "U"}
            </Text>
          </View>
        )}

        {isEditing && (
          <TouchableOpacity style={styles.cameraBtn} onPress={pickImage}>
            <Camera size={18} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {/* Info Card */}
      <View style={styles.card}>
        <Label title="Name" />
        <TextInput
          value={userDetails.name}
          style={styles.input}
          editable={isEditing}
          onChangeText={(text) => handleChange("name", text)}
          placeholder="Your name"
        />

        <Label title="Business Name" />
        <TextInput
          value={userDetails.bussinessName}
          style={styles.input}
          editable={isEditing}
          onChangeText={(text) => handleChange("bussinessName", text)}
          placeholder="Business name"
        />

        <Label title="Business ID" />
        <TextInput
          keyboardType="numeric"
          value={String(userDetails.businessId || "")}
          style={styles.input}
          editable={isEditing}
          onChangeText={(text) => handleChange("businessId", text)}
          placeholder="Business ID"
        />

        <Label title="Address" />
        <TextInput
          value={userDetails.address}
          style={styles.input}
          editable={isEditing}
          onChangeText={(text) => handleChange("address", text)}
          placeholder="Street, City, Postcode"
          multiline
        />

        <Label title="Email" />
        <TextInput
          value={userDetails.email}
          style={[styles.input, styles.disabled]}
          editable={false}
        />
        {/* Save Button (Bottom Fixed) */}
      {isEditing && (
        <View style={styles.saveWrapper}>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveText}>Save</Text>
          </TouchableOpacity>
        </View>
      )}
      </View>
      {/* Delete */}
      <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
        <Trash2 size={18} color="#dc2626" />
        <Text style={styles.deleteText}>Delete Account</Text>
      </TouchableOpacity>
    </View>
    </TouchableWithoutFeedback>
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
    marginBottom: 16,
  },

  editBtn: {
    alignSelf: "flex-end",
    marginBottom: 10,
  },

  editText: {
    color: "#2563EB",
    fontWeight: "600",
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

  saveWrapper: {
    position: "relative",
    // bottom: 10,
    // left: 20,
    // right: 20,
    flexDirection: "row-reverse",
  },

  saveBtn: {
    justifyContent: "center",
    backgroundColor: "#2563EB",
    // padding: 18,
    width: 100,
    height: 50,
    borderRadius: 18,
    alignItems: "center",
  },

  saveText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
});