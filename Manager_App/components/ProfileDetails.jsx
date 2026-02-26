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
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "./useAuth";
import api from "../services/api";
import { Camera, Trash2, Pencil  } from "lucide-react-native";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage, auth, signInFirebase } from "./firebase";

const isRTL = I18nManager.isRTL;

export default function ProfileDetails() {
  const navigation = useNavigation();
  const { userId } = useAuth();

  const [userDetails, setUserDetails] = useState({});
  const [image, setImage] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [collectTax, setCollectTax] = useState(false);

  useEffect(() => {
    fetchData();
  }, [userId]);

  const fetchData = async () => {
    try {
      const res = await api.get(`/getUserDetails`);
      const data = res.data;
      let addressObj = {
       street: "",
       state: "",
       country: "",
       zip: "",
     };

    if (typeof data.address === "string") {
      const parts = data.address.split(",");
      addressObj.street = parts[0]?.trim() || "";
      addressObj.state = parts[1]?.trim() || "";
      addressObj.zip = parts[2]?.trim() || "";
    } else if (typeof data.address === "object") {
      addressObj = data.address;
    }

    setUserDetails({
      ...data,
      address: addressObj,
    });

      setImage(res.data.logo);
      setCollectTax(res.data?.taxSettings?.collectTax || false);
    } catch (err) {
      console.error(err);
    }
  };
  const handleAddressChange = (field, value) => {
  setUserDetails((prev) => ({
    ...prev,
    address: {
      ...prev.address,
      [field]: value,
    },
  }));
};
  const handleChange = (field, value) => {
    setUserDetails((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    try {
      if (!auth.currentUser) {
      await signInFirebase();
    }

    const uid = auth.currentUser.uid;
    let logoUrl = userDetails.logo; // default to existing

    // Only upload if image changed
    if (image && image !== userDetails.logo) {
      const response = await fetch(image);
      const blob = await response.blob();

      const fileRef = ref(storage, `users/${uid}/company-logo/logo.jpg`);

      await uploadBytesResumable(fileRef, blob);

      logoUrl = await getDownloadURL(fileRef);
    }
      setUserDetails((prev) => ({
        ...prev,
        logo: logoUrl,
      }));

      // Also update local variable before sending
      userDetails.logo = logoUrl;
      await api.post("/updateUser", {
  ...userDetails,
  taxSettings: {
    collectTax,
    businessState: userDetails.address?.state,
  },
});
      setIsEditing(false);
      navigation.reset({
        index: 0,
        routes: [{ name: "HomeScreen" }],
      });
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
  const newImage = res.assets[0].uri;

  setImage(newImage);

  setUserDetails((prev) => ({
    ...prev,
    logo: newImage,
  }));
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
  <KeyboardAvoidingView
    style={{ flex: 1 }}
    behavior={Platform.OS === "ios" ? "padding" : "height"}
    // keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
  >
  <ScrollView
      contentContainerStyle={{ flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
    >
    <View style={styles.container}>
      {/* <Text style={styles.title}>Profile</Text> */}

      {/* Avatar */}
      <View style={styles.avatarWrapper}>
        {image || userDetails.logo ? (
  <Image
    source={{ uri: image || userDetails.logo }}
    style={styles.avatar}
  />
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
      {/* Edit Button */}
      {!isEditing && (
        <TouchableOpacity
  style={styles.editBtn}
  onPress={() => setIsEditing(true)}
>
  <Pencil size={22} color="#2563EB" />
</TouchableOpacity>
      )}
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
          value={userDetails.businessName}
          style={styles.input}
          editable={isEditing}
          onChangeText={(text) => handleChange("businessName", text)}
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

{isEditing ? (
  <>
    <Label title="Street" />
    <TextInput
      value={userDetails.address?.street || ""}
      style={styles.input}
      onChangeText={(text) => handleAddressChange("street", text)}
      placeholder="Street address"
    />

    <Label title="State" />
    <TextInput
      value={userDetails.address?.state || ""}
      style={styles.input}
      onChangeText={(text) => handleAddressChange("state", text)}
      placeholder="State"
    />

    <Label title="Country" />
    <TextInput
      value={userDetails.address?.country || ""}
      style={styles.input}
      onChangeText={(text) => handleAddressChange("country", text)}
      placeholder="Country"
    />

    <Label title="ZIP Code" />
    <TextInput
      value={userDetails.address?.zip || ""}
      style={styles.input}
      keyboardType="numeric"
      onChangeText={(text) => handleAddressChange("zip", text)}
      placeholder="ZIP Code"
    />
  </>
) : (
  <View style={styles.input}>
    <Text>
      {[
        userDetails.address?.street,
        userDetails.address?.state,
        userDetails.address?.country,
        userDetails.address?.zip,
      ]
        .filter(Boolean)
        .join(" ") || "No address provided"}
    </Text>
  </View>
)}
<View style={styles.taxSection}>
  <Text style={styles.label}>Sales Tax</Text>

  <TouchableOpacity
    style={styles.taxToggleRow}
    onPress={() => setCollectTax(!collectTax)}
  >
    <View
      style={[
        styles.checkbox,
        collectTax && styles.checkboxActive,
      ]}
    />
    <Text style={styles.taxToggleText}>
      Automatically calculate Sales Tax
    </Text>
  </TouchableOpacity>

  {collectTax && (
    <Text style={styles.taxHelper}>
      Sales tax will be applied only for in-state transactions.
    </Text>
  )}
</View>

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
    </ScrollView>
    </KeyboardAvoidingView>
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
    paddingTop: 100,
  },

  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 16,
  },

  editBtn: {
    alignSelf: "flex-end",
  marginBottom: 10,
  backgroundColor: "#E0E7FF",
  padding: 8,
  borderRadius: 20,
  position: "absolute",
  top: 60,
  right: 20,
  zIndex: 10,
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
  
  taxSection: {
  marginTop: 20,
},

taxToggleRow: {
  flexDirection: "row",
  alignItems: "center",
  marginTop: 8,
},

checkbox: {
  width: 18,
  height: 18,
  borderWidth: 1.5,
  borderColor: "#2563EB",
  borderRadius: 4,
  marginRight: 10,
},

checkboxActive: {
  backgroundColor: "#2563EB",
},

taxToggleText: {
  fontSize: 14,
  color: "#111827",
},

taxHelper: {
  fontSize: 12,
  color: "#6B7280",
  marginTop: 6,
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