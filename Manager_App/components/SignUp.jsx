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
  Animated,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import axios from "axios";
import { SERVER_URL } from "@env";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Icon from "react-native-vector-icons/Ionicons";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage, auth, signInFirebase } from "./firebase";

const Input = ({ label, error, icon, children }) => (
  <View style={styles.field}>
    <View style={styles.labelRow}>
      {icon && <Icon name={icon} size={16} color="#6B7280" />}
      <Text style={styles.label}>{label}</Text>
    </View>
    {children}
    {error && (
      <View style={styles.errorContainer}>
        <Icon name="alert-circle" size={14} color="#EF4444" />
        <Text style={styles.error}>{error}</Text>
      </View>
    )}
  </View>
);

export default function SignUp() {
  const navigation = useNavigation();
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [image, setImage] = useState();
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

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const validateStep1 = () => {
    const e = {};
    if (!formData.firstName) e.firstName = "First name is required";
    if (!formData.lastName) e.lastName = "Last name is required";
    if (!formData.email) e.email = "Email is required";
    else if (!validateEmail(formData.email)) e.email = "Please enter a valid email";
    if (!formData.password) e.password = "Password is required";
    else if (formData.password.length < 8)
      e.password = "Password must be at least 8 characters";

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep2 = () => {
    const e = {};
    if (!formData.businessName) e.businessName = "Business name is required";
    if (!formData.businessId) e.businessId = "Business ID is required";
    if (!formData.address) e.address = "Address is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSignUp = async () => {
    if (!validateStep2()) return;

    try {
      if (!auth.currentUser) {
        await signInFirebase();
      } else {
        console.log("false");
        
      }

      const uid = auth.currentUser.uid;
      let logoUrl = null;

      if (image) {
        const response = await fetch(image);
        const blob = await response.blob();
        const fileRef = ref(storage, `users/${uid}/company-logo/logo.jpg`);
        await uploadBytesResumable(fileRef, blob);
        logoUrl = await getDownloadURL(fileRef);
      }

      const response = await axios.post(`${SERVER_URL}/NewUser`, {
        name: formData.firstName,
        surname: formData.lastName,
        email: formData.email,
        password: formData.password,
        businessName: formData.businessName,
        businessId: formData.businessId,
        address: formData.address,
        logo: logoUrl,
      });

      if (response.status === 200) {
        const { token } = response.data;
        await AsyncStorage.setItem("token", token);
        navigation.reset({
          index: 0,
          routes: [{ name: "HomeScreen" }],
        });
      }

      Alert.alert("Success", "Account created successfully");
    } catch (err) {
      console.log(err);
      Alert.alert("Error", "Registration failed. Please try again.");
    }
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission Required", "Please allow access to your photos");
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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      <LinearGradient
        colors={["#EEF2FF", "#FFFFFF"]}
        style={styles.gradient}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.iconCircle}>
                <Icon name="briefcase-outline" size={32} color="#3B82F6" />
              </View>
              <Text style={styles.headerTitle}>
                {step === 1 ? "Welcome!" : "Almost there"}
              </Text>
              <Text style={styles.headerSubtitle}>
                {step === 1
                  ? "Create your account to get started"
                  : "Tell us about your business"}
              </Text>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: step === 1 ? "50%" : "100%" },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>Step {step} of 2</Text>
            </View>

            {/* Card */}
            <View style={styles.card}>
              {step === 1 ? (
                <>
                  <View style={styles.nameRow}>
                    <Input
                      label="First Name"
                      icon="person-outline"
                      error={errors.firstName}
                    >
                      <TextInput
                        style={[
                          styles.input,
                          errors.firstName && styles.inputError,
                        ]}
                        value={formData.firstName}
                        placeholder="John"
                        placeholderTextColor="#9CA3AF"
                        onChangeText={(t) =>
                          setFormData({ ...formData, firstName: t })
                        }
                      />
                    </Input>

                    <Input
                      label="Last Name"
                      icon="person-outline"
                      error={errors.lastName}
                    >
                      <TextInput
                        style={[
                          styles.input,
                          errors.lastName && styles.inputError,
                        ]}
                        value={formData.lastName}
                        placeholder="Doe"
                        placeholderTextColor="#9CA3AF"
                        onChangeText={(t) =>
                          setFormData({ ...formData, lastName: t })
                        }
                      />
                    </Input>
                  </View>

                  <Input label="Email" icon="mail-outline" error={errors.email}>
                    <TextInput
                      style={[styles.input, errors.email && styles.inputError]}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={formData.email}
                      placeholder="john@example.com"
                      placeholderTextColor="#9CA3AF"
                      onChangeText={(t) =>
                        setFormData({ ...formData, email: t })
                      }
                    />
                  </Input>

                  <Input
                    label="Password"
                    icon="lock-closed-outline"
                    error={errors.password}
                  >
                    <View
                      style={[
                        styles.passwordContainer,
                        errors.password && styles.inputError,
                      ]}
                    >
                      <TextInput
                        style={styles.passwordInput}
                        secureTextEntry={!showPassword}
                        value={formData.password}
                        placeholder="Min. 8 characters"
                        placeholderTextColor="#9CA3AF"
                        onChangeText={(t) =>
                          setFormData({ ...formData, password: t })
                        }
                      />
                      <TouchableOpacity
                        onPress={() => setShowPassword(!showPassword)}
                        style={styles.eyeIcon}
                      >
                        <Icon
                          name={showPassword ? "eye-off-outline" : "eye-outline"}
                          size={22}
                          color="#6B7280"
                        />
                      </TouchableOpacity>
                    </View>
                  </Input>

                  <TouchableOpacity
                    onPress={() => validateStep1() && setStep(2)}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={["#3B82F6", "#2563EB"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.primaryBtn}
                    >
                      <Text style={styles.primaryText}>Continue</Text>
                      <Icon name="arrow-forward" size={20} color="#fff" />
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Input
                    label="Business Name"
                    icon="business-outline"
                    error={errors.businessName}
                  >
                    <TextInput
                      style={[
                        styles.input,
                        errors.businessName && styles.inputError,
                      ]}
                      value={formData.businessName}
                      placeholder="Acme Corporation"
                      placeholderTextColor="#9CA3AF"
                      onChangeText={(t) =>
                        setFormData({ ...formData, businessName: t })
                      }
                    />
                  </Input>

                  <Input
                    label="Business ID"
                    icon="card-outline"
                    error={errors.businessId}
                  >
                    <TextInput
                      style={[
                        styles.input,
                        errors.businessId && styles.inputError,
                      ]}
                      value={formData.businessId}
                      keyboardType="number-pad"
                      placeholder="123456789"
                      placeholderTextColor="#9CA3AF"
                      onChangeText={(t) =>
                        setFormData({ ...formData, businessId: t })
                      }
                    />
                  </Input>

                  <Input
                    label="Address"
                    icon="location-outline"
                    error={errors.address}
                  >
                    <TextInput
                      style={[styles.input, errors.address && styles.inputError]}
                      placeholder="123 Main St, City, ZIP"
                      placeholderTextColor="#9CA3AF"
                      value={formData.address}
                      onChangeText={(t) =>
                        setFormData({ ...formData, address: t })
                      }
                    />
                  </Input>

                  <View style={styles.logoSection}>
                    <Text style={styles.logoLabel}>Company Logo (Optional)</Text>
                    <TouchableOpacity
                      style={styles.upload}
                      onPress={pickImage}
                      activeOpacity={0.7}
                    >
                      {image ? (
                        <View style={styles.imagePreview}>
                          <Icon
                            name="checkmark-circle"
                            size={24}
                            color="#10B981"
                          />
                          <Text style={styles.uploadedText}>Logo uploaded</Text>
                          <Text style={styles.changeText}>Tap to change</Text>
                        </View>
                      ) : (
                        <View style={styles.uploadContent}>
                          <View style={styles.uploadIcon}>
                            <Icon
                              name="cloud-upload-outline"
                              size={28}
                              color="#3B82F6"
                            />
                          </View>
                          <Text style={styles.uploadText}>Upload Logo</Text>
                          <Text style={styles.uploadHint}>
                            PNG, JPG up to 5MB
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>

                  <View style={styles.buttonRow}>
                    <TouchableOpacity
                      style={styles.secondaryBtn}
                      onPress={() => setStep(1)}
                      activeOpacity={0.7}
                    >
                      <Icon name="arrow-back" size={20} color="#374151" />
                      <Text style={styles.secondaryText}>Back</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={handleSignUp}
                      activeOpacity={0.8}
                      style={styles.primaryBtnWrapper}
                    >
                      <LinearGradient
                        colors={["#3B82F6", "#2563EB"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.primarySolid}
                      >
                        <Text style={styles.primaryText}>Create Account</Text>
                        {/* <Icon name="checkmark" size={20} color="#fff" /> */}
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  content: {
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
  },

  // Header
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 15,
    color: "#6B7280",
    textAlign: "center",
  },

  // Progress
  progressContainer: {
    marginBottom: 24,
  },
  progressBar: {
    height: 6,
    backgroundColor: "#E5E7EB",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#3B82F6",
    borderRadius: 3,
  },
  progressText: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    fontWeight: "600",
  },

  // Card
  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },

  // Inputs
  field: { marginBottom: 20 },
  nameRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 0,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  input: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    color: "#111827",
  },
  inputError: {
    borderColor: "#EF4444",
    backgroundColor: "#FEF2F2",
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    paddingRight: 16,
  },
  passwordInput: {
    flex: 1,
    padding: 16,
    fontSize: 15,
    color: "#111827",
  },
  eyeIcon: {
    padding: 4,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  error: {
    color: "#EF4444",
    fontSize: 13,
    fontWeight: "500",
  },

  // Logo Upload
  logoSection: {
    marginBottom: 20,
  },
  logoLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  upload: {
    borderWidth: 2,
    borderColor: "#E5E7EB",
    borderStyle: "dashed",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    backgroundColor: "#F9FAFB",
  },
  uploadContent: {
    alignItems: "center",
  },
  uploadIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  uploadText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 4,
  },
  uploadHint: {
    fontSize: 13,
    color: "#9CA3AF",
  },
  imagePreview: {
    alignItems: "center",
  },
  uploadedText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#10B981",
    marginTop: 8,
  },
  changeText: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 4,
  },

  // Buttons
  primaryBtn: {
    marginTop: 8,
    borderRadius: 14,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#3B82F6",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  primaryText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#fff",
  },
  secondaryText: {
    color: "#374151",
    fontWeight: "600",
    fontSize: 16,
  },
  primaryBtnWrapper: {
    flex: 1,
  },
  primarySolid: {
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    // flexDirection: "row",
    gap: 8,
    shadowColor: "#3B82F6",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});