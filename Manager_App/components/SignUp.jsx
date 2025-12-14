import React, { useState } from 'react';
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
} from 'react-native';
import { LinearGradient } from "expo-linear-gradient";
import axios from 'axios';
import { SERVER_URL } from '@env';
import Icon from 'react-native-vector-icons/Ionicons';
// import { Eye, EyeOff, ChevronRight, ChevronLeft, Upload } from 'lucide-react-native';

export default function SignUp() {
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    businessName: '',
    businessId: '',
    businessLogo: null,
  });

  const [errors, setErrors] = useState({});

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const validateStep1 = () => {
    const newErrors = {};
    let valid = true;
    if (!formData.firstName.trim()) { newErrors.firstName = 'First name required'; valid = false; }
    if (!formData.lastName.trim()) { newErrors.lastName = 'Last name required'; valid = false; }
    if (!formData.email.trim()) { newErrors.email = 'Email required'; valid = false; }
    else if (!validateEmail(formData.email)) { newErrors.email = 'Invalid email'; valid = false; }
    if (!formData.password.trim()) { newErrors.password = 'Password required'; valid = false; }
    else if (formData.password.length < 8) { newErrors.password = 'At least 8 characters'; valid = false; }

    setErrors(newErrors);
    return valid;
  };

  const validateStep2 = () => {
    const newErrors= {};
    let valid = true;
    if (!formData.businessName.trim()) { newErrors.businessName = 'Business name required'; valid = false; }
    if (!formData.businessId.trim()) { newErrors.businessId = 'Business ID required'; valid = false; }

    setErrors(newErrors);
    return valid;
  };

  const handleNext = () => {
    if (validateStep1()) setStep(2);
  };

  const handleBack = () => setStep(1);

  const handleSignUp = async () => {
    if (validateStep2()) {
      try {
        await axios.post(`${SERVER_URL}/NewUser`, {
          name: formData.firstName,
          surname: formData.lastName,
          email: formData.email,
          password: formData.password,
          businessName: formData.businessName,
          businessId: formData.businessId,
        });
        Alert.alert('Success', 'Account created successfully!');
      } catch (err) {
        Alert.alert('Error', 'Failed to create account');
      }
    }
  };

  const handleUploadLogo = () => {
    Alert.alert('Upload', 'Upload logo functionality');
  };

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Personal Information</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>First Name</Text>
        <TextInput
          style={[styles.input, errors.firstName && styles.inputError, { textAlign: I18nManager.isRTL ? 'right' : 'left' }]}
          placeholder="First Name"
          value={formData.firstName}
          onChangeText={(text) => setFormData({ ...formData, firstName: text })}
        />
        {errors.firstName && <Text style={styles.errorText}>{errors.firstName}</Text>}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Last Name</Text>
        <TextInput
          style={[styles.input, errors.lastName && styles.inputError, { textAlign: I18nManager.isRTL ? 'right' : 'left' }]}
          placeholder="Last Name"
          value={formData.lastName}
          onChangeText={(text) => setFormData({ ...formData, lastName: text })}
        />
        {errors.lastName && <Text style={styles.errorText}>{errors.lastName}</Text>}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={[styles.input, errors.email && styles.inputError, { textAlign: I18nManager.isRTL ? 'right' : 'left' }]}
          placeholder="Email"
          value={formData.email}
          onChangeText={(text) => setFormData({ ...formData, email: text })}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Password</Text>
        <View style={styles.passwordWrapper}>
          <TextInput
            style={[styles.input, errors.password && styles.inputError, { flex: 1, textAlign: I18nManager.isRTL ? 'right' : 'left' }]}
            placeholder="Password"
            value={formData.password}
            onChangeText={(text) => setFormData({ ...formData, password: text })}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
             <Icon name={showPassword ? "eye-off" : "eye"} size={20} />
          </TouchableOpacity>
        </View>
        {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
      </View>
      <LinearGradient
          colors={["#60a5fa", "#3b82f6", "#1e40af"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.nextButton}
          >
         <TouchableOpacity  onPress={handleNext}>
          {/* <Text style={styles.nextButtonText}>Next</Text> */}
          <Icon name="chevron-forward" position={"static"} alignSelf={"center"} color={"#fff"} size={40} />
         </TouchableOpacity>
          </LinearGradient>
      
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Business Information</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Business Name</Text>
        <TextInput
          style={[styles.input, errors.businessName && styles.inputError, { textAlign: I18nManager.isRTL ? 'right' : 'left' }]}
          placeholder="Business Name"
          value={formData.businessName}
          onChangeText={(text) => setFormData({ ...formData, businessName: text })}
        />
        {errors.businessName && <Text style={styles.errorText}>{errors.businessName}</Text>}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Business ID</Text>
        <TextInput
          style={[styles.input, errors.businessId && styles.inputError, { textAlign: I18nManager.isRTL ? 'right' : 'left' }]}
          placeholder="Business ID"
          value={formData.businessId}
          onChangeText={(text) => setFormData({ ...formData, businessId: text })}
        />
        {errors.businessId && <Text style={styles.errorText}>{errors.businessId}</Text>}
      </View>

      <TouchableOpacity style={styles.uploadButton} onPress={handleUploadLogo}>
        <Icon name="cloud-upload-outline" size={20} />
        <Text>Upload Logo</Text>
      </TouchableOpacity>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Icon name="chevron-back" color={"#fff"} size={20} />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.signUpButton} onPress={handleSignUp}>
          <Text style={styles.signUpButtonText}>Sign Up</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.progressContainer}>
          <View style={[styles.dot, step === 1 && styles.activeDot]} />
          <View style={[styles.dot, step === 2 && styles.activeDot]} />
          {/* <Text style={{ textAlign: I18nManager.isRTL ? 'right' : 'left' }}>Step {step} of 2</Text> */}
        </View>

        {step === 1 ? renderStep1() : renderStep2()}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', top: 40, padding: 26 },
  scrollContainer: { paddingBottom: 40 },
  progressContainer: { flexDirection:"row", justifyContent: "center", marginBottom: 16, alignItems: 'center' },
  dot: { width: 12, height: 12, borderRadius: 4, backgroundColor: '#ccc', marginHorizontal: 4 },
  activeDot: { backgroundColor: 'blue' },
  stepContainer: { marginBottom: 24 },
  stepTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 22, marginTop: 30 },
  inputGroup: { marginBottom: 22 },
  label: { marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 12, borderRadius: 8, backgroundColor: 'white' },
  inputError: { borderColor: 'red' },
  errorText: { color: 'red', marginTop: 4 },
  passwordWrapper: { flexDirection: 'row', alignItems: 'center' },
  eyeIcon: { padding: 8 },
  nextButton: { flexDirection: 'row', position: "absolute", alignSelf: "flex-end", backgroundColor: 'blue', width: 70, height: 70, borderRadius: 12, justifyContent: 'center', alignItems: 'center', bottom: -330,},
  nextButtonText: { color: '#fff', fontWeight: 'bold', marginRight: 6 },
  uploadButton: { flexDirection: 'row', borderWidth: 1, borderColor: '#ccc', padding: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center',},
  buttonRow: { flexDirection: 'row', marginTop: 12 },
  backButton: { flex: 1, flexDirection: 'row', borderWidth: 1, borderColor: '#ccc', padding: 12, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 6 },
  backButtonText: { marginLeft: 6 },
  signUpButton: { flex: 1, backgroundColor: 'blue', padding: 12, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  signUpButtonText: { color: '#fff', fontWeight: 'bold' },
});
