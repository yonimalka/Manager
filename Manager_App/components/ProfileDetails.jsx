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
  Pressable,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "./useAuth";
import api from "../services/api";
import { Ionicons } from "@expo/vector-icons";
import { Camera, Trash2, Pencil  } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage, auth, signInFirebase } from "./firebase";
import SubscriptionCard from "./SubscriptionCard";
import { refreshSubscriptionStatus } from "../services/subscription";

const isRTL = I18nManager.isRTL;

export default function ProfileDetails() {
  const navigation = useNavigation();
  const { userId } = useAuth();

  const [userDetails, setUserDetails] = useState({});
  const [image, setImage] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [collectTax, setCollectTax] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [selectedCurrency, setSelectedCurrency] = useState(
  userDetails?.currency || "USD"
);
  const currencies = [
  { code: "USD", locale: "en-US", label: "🇺🇸 USD - US Dollar" },
  { code: "GBP", locale: "en-GB", label: "🇬🇧 GBP - British Pound" },
  { code: "EUR", locale: "de-DE", label: "🇪🇺 EUR - Euro" },
  { code: "ILS", locale: "he-IL", label: "🇮🇱 ILS - Israeli Shekel" },
];
  
  useEffect(() => {
    fetchData();
  }, [userId]);

  const fetchData = async () => {
    try {
      const [res, subscriptionData] = await Promise.all([
        api.get(`/getUserDetails`),
        refreshSubscriptionStatus(),
      ]);
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
      setSelectedCurrency(data.currency || "USD");
      setImage(res.data.logo);
      setCollectTax(res.data?.taxSettings?.collectTax || false);
      setSubscription(subscriptionData);
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
  const handleCurrencyChange = async (value) => {
  const selected = currencies.find((c) => c.code === value);

  setSelectedCurrency(value);

  try {
    await api.put("/updateCurrency", {
      currency: selected.code,
      locale: selected.locale,
    });

    // update local state instantly
    setUserDetails((prev) => ({
      ...prev,
      currency: selected.code,
      locale: selected.locale,
    }));

  } catch (error) {
    console.log("Currency update failed");
  }
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
    currency: selectedCurrency,
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
            await AsyncStorage.multiRemove(["token", "refreshToken"]);
            navigation.reset({ index: 0, routes: [{ name: "LoginScreen" }] });
            try {
              await api.delete(`/deleteUser/${userId}`);
            } catch (e) {
              console.error("Delete account error:", e);
            }
          },
        },
      ]
    );
  };

  if (!isEditing) {
    return (
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
            <View style={styles.container}>

              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={24} color="#fff"  />
              </TouchableOpacity>

              <View style={styles.hero}>
                <View style={styles.avatarRing}>
                  {image || userDetails.logo ? (
                    <Image source={{ uri: image || userDetails.logo }} style={styles.avatarImg} />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <Text style={styles.avatarInitial}>{userDetails?.name?.[0]?.toUpperCase() || "U"}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.heroName}>{userDetails.name || "Your Name"}</Text>
                <Text style={styles.heroBiz}>{userDetails.businessName || "Business Name"}</Text>
                <TouchableOpacity style={styles.editPill} onPress={() => setIsEditing(true)}>
                  <Pencil size={11} color="#2563eb" />
                  <Text style={styles.editPillText}>Edit profile</Text>
                </TouchableOpacity>
              </View>

              <SubscriptionCard
                subscription={subscription}
                onPress={() => navigation.navigate("SubscriptionScreen")}
              />

              <Text style={styles.sectionLabel}>Personal</Text>
              <View style={styles.group}>
                <View style={styles.row}>
                  <View style={[styles.rowIcon, { backgroundColor: "#5e5ce6" }]}><Ionicons name="person" size={14} color="#fff" /></View>
                  <Text style={styles.rowLabel}>Name</Text>
                  <Text style={styles.rowVal}>{userDetails.name || "—"}</Text>
                  {/* <Ionicons name="chevron-forward" size={14} color="#c7c7cc" /> */}
                </View>
                <View style={styles.rowDivider} />
                <View style={styles.row}>
                  <View style={[styles.rowIcon, { backgroundColor: "#ff453a" }]}><Ionicons name="mail" size={14} color="#fff" /></View>
                  <Text style={styles.rowLabel}>Email</Text>
                  <Text style={[styles.rowVal, { color: "#c7c7cc" }]}>{userDetails.email || "—"}</Text>
                  <Ionicons name="lock-closed" size={12} color="#c7c7cc" />
                </View>
                <View style={styles.rowDivider} />
                <View style={styles.row}>
                  <View style={[styles.rowIcon, { backgroundColor: "#30d158" }]}><Ionicons name="cash" size={14} color="#fff" /></View>
                  <Text style={styles.rowLabel}>Currency</Text>
                  <Text style={styles.rowVal}>{userDetails.currency || "USD"}</Text>
                  {/* <Ionicons name="chevron-forward" size={14} color="#c7c7cc" /> */}
                </View>
              </View>

              <Text style={styles.sectionLabel}>Business</Text>
              <View style={styles.group}>
                <View style={styles.row}>
                  <View style={[styles.rowIcon, { backgroundColor: "#0a84ff" }]}><Ionicons name="business" size={14} color="#fff" /></View>
                  <Text style={styles.rowLabel}>Business name</Text>
                  <Text style={styles.rowVal}>{userDetails.businessName || "—"}</Text>
                  {/* <Ionicons name="chevron-forward" size={14} color="#c7c7cc" /> */}
                </View>
                <View style={styles.rowDivider} />
                <View style={styles.row}>
                  <View style={[styles.rowIcon, { backgroundColor: "#ff9f0a" }]}><Ionicons name="card" size={14} color="#fff" /></View>
                  <Text style={styles.rowLabel}>Business ID</Text>
                  <Text style={styles.rowVal}>{userDetails.businessId || "—"}</Text>
                  {/* <Ionicons name="chevron-forward" size={14} color="#c7c7cc" /> */}
                </View>
                <View style={styles.rowDivider} />
                <View style={styles.row}>
                  <View style={[styles.rowIcon, { backgroundColor: "#64d2ff" }]}><Ionicons name="location-outline" size={14} color="#fff" /></View>
                  <Text style={styles.rowLabel}>Address</Text>
                  <Text style={[styles.rowVal, { maxWidth: 140 }]} numberOfLines={1}>
                    {[userDetails.address?.street, userDetails.address?.state, userDetails.address?.zip].filter(Boolean).join(", ") || "—"}
                  </Text>
                  {/* <Ionicons name="chevron-forward" size={14} color="#c7c7cc" /> */}
                </View>
              </View>

              <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                <Trash2 size={16} color="#ff3b30" />
                <Text style={styles.deleteText}>Delete account</Text>
              </TouchableOpacity>

            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View style={styles.container}>

            <View style={styles.editHeader}>
              <TouchableOpacity onPress={() => setIsEditing(false)}>
                <Text style={styles.cancelBtn}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.editTitle}>Edit profile</Text>
              <View style={{ width: 60 }} />
            </View>

            <View style={styles.editAvatarRow}>
              <View style={styles.avatarRing}>
                {image || userDetails.logo ? (
                  <Image source={{ uri: image || userDetails.logo }} style={styles.avatarImg} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarInitial}>{userDetails?.name?.[0]?.toUpperCase() || "U"}</Text>
                  </View>
                )}
                <TouchableOpacity style={styles.cameraBtn} onPress={pickImage}>
                  <Camera size={12} color="#fff" />
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={pickImage}>
                <Text style={styles.changePhotoText}>Change photo</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionLabel}>Personal</Text>
            <View style={styles.group}>
              <View style={styles.editRow}>
                <Text style={styles.editLabel}>Name</Text>
                <TextInput
                  value={userDetails.name}
                  onChangeText={(t) => handleChange("name", t)}
                  style={styles.editInput}
                  placeholder="Your name"
                  placeholderTextColor="#c7c7cc"
                />
              </View>
              <View style={styles.editRowDivider} />
              <View style={styles.editRow}>
                <Text style={styles.editLabel}>Email</Text>
                <Text style={[styles.editInput, { color: "#c7c7cc" }]}>{userDetails.email}</Text>
              </View>
            </View>
            <Text style={styles.sectionLabel}>Currency</Text>
            <View style={styles.chipsRow}>
              {currencies.map((item) => (
                <Pressable
                  key={item.code}
                  style={[styles.chip, selectedCurrency === item.code && styles.chipActive]}
                  onPress={() => handleCurrencyChange(item.code)}
                >
                  <Text style={[styles.chipText, selectedCurrency === item.code && styles.chipTextActive]}>
                    {item.code}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.sectionLabel}>Business</Text>
            <View style={styles.group}>
              <View style={styles.editRow}>
                <Text style={styles.editLabel}>Name</Text>
                <TextInput value={userDetails.businessName} onChangeText={(t) => handleChange("businessName", t)} style={styles.editInput} placeholder="Business name" placeholderTextColor="#c7c7cc" />
              </View>
              <View style={styles.editRowDivider} />
              <View style={styles.editRow}>
                <Text style={styles.editLabel}>ID</Text>
                <TextInput value={String(userDetails.businessId || "")} onChangeText={(t) => handleChange("businessId", t)} style={styles.editInput} placeholder="Tax / Business ID" placeholderTextColor="#c7c7cc" keyboardType="numeric" />
              </View>
              <View style={styles.editRowDivider} />
              <View style={styles.editRow}>
                <Text style={styles.editLabel}>Street</Text>
                <TextInput value={userDetails.address?.street || ""} onChangeText={(t) => handleAddressChange("street", t)} style={styles.editInput} placeholder="Street address" placeholderTextColor="#c7c7cc" />
              </View>
              <View style={styles.editRowDivider} />
              <View style={{ flexDirection: "row" }}>
                <View style={[styles.editRow, { flex: 1, borderRightWidth: 0.5, borderRightColor: "rgba(60,60,67,0.1)" }]}>
                  <Text style={styles.editLabel}>State</Text>
                  <TextInput value={userDetails.address?.state || ""} onChangeText={(t) => handleAddressChange("state", t)} style={[styles.editInput, { width: 48 }]} placeholder="NY" placeholderTextColor="#c7c7cc" autoCapitalize="characters" maxLength={2} />
                </View>
                <View style={[styles.editRow, { flex: 1 }]}>
                  <Text style={styles.editLabel}>ZIP</Text>
                  <TextInput value={userDetails.address?.zip || ""} onChangeText={(t) => handleAddressChange("zip", t)} style={[styles.editInput, { width: 64 }]} placeholder="10001" placeholderTextColor="#c7c7cc" keyboardType="numeric" />
                </View>
              </View>
              <View style={styles.editRowDivider} />
              <View style={styles.editRow}>
                <Text style={styles.editLabel}>Country</Text>
                <TextInput value={userDetails.address?.country || ""} onChangeText={(t) => handleAddressChange("country", t)} style={styles.editInput} placeholder="US" placeholderTextColor="#c7c7cc" autoCapitalize="characters" maxLength={2} />
              </View>
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveText}>Save changes</Text>
            </TouchableOpacity>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: "#f2f2f7", paddingHorizontal: 16, paddingTop: 60, paddingBottom: 32 },
  backBtn: {
    width: 40,
    height: 40, 
    borderRadius: 20, 
    backgroundColor: "rgba(35, 31, 31, 0.2)", 
    alignItems: "center", 
    justifyContent: "center",
    marginBottom: 15,
  },

  hero:             { backgroundColor: "#fff", borderRadius: 16, padding: 20, marginBottom: 8, borderWidth: 0.5, borderColor: "rgba(60,60,67,0.10)", alignItems: "center", gap: 6 },
  avatarRing:       { width: 72, height: 72, borderRadius: 36, padding: 2, backgroundColor: "transparent", borderWidth: 2.5, borderColor: "#30d158", justifyContent: "center", alignItems: "center", position: "relative" },
  avatarImg:        { width: 64, height: 64, borderRadius: 32 },
  avatarFallback:   { width: 64, height: 64, borderRadius: 32, backgroundColor: "#1c1c1e", justifyContent: "center", alignItems: "center" },
  avatarInitial:    { fontSize: 22, fontWeight: "700", color: "#fff" },
  heroName:         { fontSize: 18, fontWeight: "700", color: "#1c1c1e", letterSpacing: -0.4, marginBottom: 2 },
  heroBiz:          { fontSize: 13, color: "#8e8e93", marginBottom: 10 },
  editPill:         { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#eff6ff", borderRadius: 20, paddingVertical: 4, paddingHorizontal: 10, borderWidth: 1, borderColor: "#bfdbfe" },
  editPillText:     { fontSize: 12, fontWeight: "600", color: "#2563eb" },

  sectionLabel:     { fontSize: 11, fontWeight: "600", color: "#8e8e93", textTransform: "uppercase", letterSpacing: 0.7, marginTop: 16, marginBottom: 6, marginLeft: 4 },

  group:            { backgroundColor: "#fff", borderRadius: 12, overflow: "hidden", borderWidth: 0.5, borderColor: "rgba(60,60,67,0.10)" },
  row:              { flexDirection: "row", alignItems: "center", minHeight: 46, paddingHorizontal: 14, gap: 10 },
  rowDivider:       { height: 0.5, backgroundColor: "rgba(60,60,67,0.10)", marginLeft: 52 },
  editRowDivider:   { height: 0.5, backgroundColor: "rgba(60,60,67,0.10)", marginLeft: 0 },
  rowIcon:          { width: 28, height: 28, borderRadius: 7, justifyContent: "center", alignItems: "center" },
  rowLabel:         { flex: 1, fontSize: 15, color: "#1c1c1e", letterSpacing: -0.2 },
  rowVal:           { fontSize: 15, color: "#8e8e93", letterSpacing: -0.1, marginRight: 4 },

  editHeader:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  editTitle:        { fontSize: 17, fontWeight: "700", color: "#1c1c1e", letterSpacing: -0.3 },
  cancelBtn:        { fontSize: 15, color: "#ff3b30", fontWeight: "500" },

  editAvatarRow:    { alignItems: "center", gap: 8, marginBottom: 8 },
  cameraBtn:        { position: "absolute", bottom: 0, right: 0, width: 22, height: 22, borderRadius: 11, backgroundColor: "#0a84ff", justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "#f2f2f7" },
  changePhotoText:  { fontSize: 13, color: "#0a84ff", fontWeight: "500" },

  editRow:          { flexDirection: "row", alignItems: "center", minHeight: 46, paddingHorizontal: 14 },
  editLabel:        { fontSize: 13, color: "#8e8e93", width: 72 },
  editInput:        { flex: 1, fontSize: 15, color: "#1c1c1e", textAlign: "right", letterSpacing: -0.2, paddingVertical: 12 },

  chipsRow:         { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 2, marginTop: 10, marginBottom: 4 },
  chip:             { borderRadius: 100, paddingVertical: 6, paddingHorizontal: 14, backgroundColor: "#f2f2f7", borderWidth: 0.5, borderColor: "rgba(60,60,67,0.18)" },
  chipActive:       { backgroundColor: "#0a84ff", borderColor: "#0a84ff" },
  chipText:         { fontSize: 13, fontWeight: "500", color: "#1c1c1e" },
  chipTextActive:   { color: "#fff" },

  saveBtn:          { backgroundColor: "#1c1c1e", borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 20 },
  saveText:         { color: "#fff", fontSize: 16, fontWeight: "700", letterSpacing: -0.3 },

  deleteBtn:        { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 16, paddingVertical: 14, borderRadius: 12, backgroundColor: "#fff", borderWidth: 0.5, borderColor: "rgba(60,60,67,0.10)" },
  deleteText:       { fontSize: 15, fontWeight: "500", color: "#ff3b30" },
});