import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StyleSheet,
  I18nManager,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import axios from "axios";
import { SERVER_URL } from "@env";
import Icon from "react-native-vector-icons/Ionicons";

const Input = ({ label, error, children }) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    {children}
    {error && <Text style={styles.error}>{error}</Text>}
  </View>
);
export default function SignUp() {
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    businessName: "",
    businessId: "",
    address: "",
    businessLogo: null,
  });

  const [errors, setErrors] = useState({});

  const validateEmail = (email) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const validateStep1 = () => {
    
    const e = {};
    if (!formData.firstName) e.firstName = "Required";
    if (!formData.lastName) e.lastName = "Required";
    if (!formData.email) e.email = "Required";
    else if (!validateEmail(formData.email)) e.email = "Invalid email";
    if (!formData.password) e.password = "Required";
    else if (formData.password.length < 8)
      e.password = "Minimum 8 characters";

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep2 = () => {
    const e = {};
    if (!formData.businessName) e.businessName = "Required";
    if (!formData.businessId) e.businessId = "Required";
    if (!formData.address) e.address = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSignUp = async () => {
    if (!validateStep2()) return;

    try {
      await axios.post(`${SERVER_URL}/NewUser`, {
        name: formData.firstName,
        surname: formData.lastName,
        email: formData.email,
        password: formData.password,
        businessName: formData.businessName,
        businessId: formData.businessId,
        address: formData.address,
        businessLogo: formData.businessLogo,
      });
      Alert.alert("Success", "Account created successfully");
    } catch {
      Alert.alert("Error", "Failed to create account");
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
        setFormData({...formData, businessLogo: res.assets[0].uri});
        // uploadLogo(); // keep your existing upload logic
      }
    };
  return (
  <KeyboardAvoidingView
  style={{ flex: 1 }}
  behavior={Platform.OS === "ios" ? "padding" : undefined}
  keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
>
  <ScrollView
    keyboardShouldPersistTaps="handled"
    contentContainerStyle={styles.scrollContainer}
  >
  <View style={styles.content}>
        {/* Progress */}
        <View style={styles.progress}>
          <View style={[styles.dot, step === 1 && styles.dotActive]} />
          <View style={[styles.dot, step === 2 && styles.dotActive]} />
        </View>

        {/* Card */}
        <View style={styles.card}>
          {step === 1 ? (
            <>
              <Text style={styles.title}>Create your account</Text>

              <Input label="First Name" error={errors.firstName}>
                <TextInput
                  style={styles.input}
                  value={formData.firstName}
                  onChangeText={(t) =>
                    setFormData({ ...formData, firstName: t })
                  }
                />
              </Input>

              <Input label="Last Name" error={errors.lastName}>
                <TextInput
                  style={styles.input}
                  value={formData.lastName}
                  onChangeText={(t) =>
                    setFormData({ ...formData, lastName: t })
                  }
                />
              </Input>

              <Input label="Email" error={errors.email}>
                <TextInput
                  style={styles.input}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={formData.email}
                  onChangeText={(t) =>
                    setFormData({ ...formData, email: t })
                  }
                />
              </Input>

              <Input label="Password" error={errors.password}>
                <View style={styles.password}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    secureTextEntry={!showPassword}
                    value={formData.password}
                    onChangeText={(t) =>
                      setFormData({ ...formData, password: t })
                    }
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Icon
                      name={showPassword ? "eye-off" : "eye"}
                      size={20}
                      color="#6B7280"
                    />
                  </TouchableOpacity>
                </View>
              </Input>

              <LinearGradient
                colors={["#3B82F6", "#1D4ED8"]}
                style={styles.primaryBtn}
              >
                <TouchableOpacity onPress={() => validateStep1() && setStep(2)}>
                  <Text style={styles.primaryText}>Continue</Text>
                </TouchableOpacity>
              </LinearGradient>
            </>
          ) : (
            <>
              <Text style={styles.title}>Business details</Text>

              <Input label="Business Name" error={errors.businessName}>
                <TextInput
                  style={styles.input}
                  value={formData.businessName}
                  onChangeText={(t) =>
                    setFormData({ ...formData, businessName: t })
                  }
                />
              </Input>

              <Input label="Business ID" error={errors.businessId}>
                <TextInput
                  style={styles.input}
                  value={formData.businessId}
                  onChangeText={(t) =>
                    setFormData({ ...formData, businessId: t })
                  }
                />
              </Input>
              <Input label="Address" error={errors.address}>
                <TextInput
                style={styles.input}
                placeholder="Street, City, Postcode"
                value={formData.address}
                onChangeText={(t)=>
                  setFormData({...formData, address: t})
                }
                />
              </Input>
              <TouchableOpacity style={styles.upload} onPress={pickImage}>
                <Icon name="cloud-upload-outline" size={20} />
                <Text style={styles.uploadText}>Upload logo</Text>
              </TouchableOpacity>

              <View style={styles.row}>
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => setStep(1)}
                >
                  <Text>Back</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.primarySolid}
                  onPress={handleSignUp}
                >
                  <Text style={styles.primaryText}>Create account</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
       </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },
  scroll: { padding: 24 },
  scrollContainer: {
  flexGrow: 1,
  justifyContent: "center",  
  alignItems: "center",       
  paddingHorizontal: 24,
  
},

content: {
  width: "100%",
  maxWidth: 420,
},

  progress: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#CBD5E1",
    marginHorizontal: 4,
  },
  dotActive: { backgroundColor: "#2563EB" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    // marginVertical: 30,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
    
  },

  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 50,
    color: "#111827",
  },

  field: { marginBottom: 14 },
  label: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
    color: "#374151",
  },

  input: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 14,
    borderWidth: 0.5,
    borderColor: "#E5E7EB",
  },

  password: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  error: { color: "#DC2626", fontSize: 12, marginTop: 4 },

  primaryBtn: {
    marginTop: 40,
    borderRadius: 14,
    alignItems: "center",
    padding: 14,
  },

  primarySolid: {
    flex: 1,
    backgroundColor: "#2563EB",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },

  primaryText: { color: "#fff", fontWeight: "700" },

  upload: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginVertical: 14,
  },

  uploadText: { color: "#374151" },

  row: { flexDirection: "row", gap: 10 },

  secondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
});
