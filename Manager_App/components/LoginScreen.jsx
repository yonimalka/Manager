import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  I18nManager,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Animated,
} from "react-native";
import { SERVER_URL } from "@env";
import axios from "axios";
import { TextInput } from "react-native-gesture-handler";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import GoogleSignInButton from "./GoogleSignInButton";
import AppleSignInButton from "./AppleSignInButton";
import * as AppleAuthentication from 'expo-apple-authentication';
import Svg, { Path } from "react-native-svg";
import Constants from 'expo-constants';

console.log("Bundle ID:", Constants.expoConfig.ios.bundleIdentifier);
const LoginScreen = () => {
  const navigation = useNavigation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [validation, setValidation] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // Email validation
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Handle input changes with validation
  const handleEmailChange = (text) => {
    setEmail(text);
    setEmailError("");
    setValidation(null);
  };

  const handlePasswordChange = (text) => {
    setPassword(text);
    setPasswordError("");
    setValidation(null);
  };

  const handleSignIn = async () => {
    // Reset errors
    setEmailError("");
    setPasswordError("");
    setValidation(null);

    // Validate inputs
    let hasError = false;

    if (!email.trim()) {
      setEmailError("Email is required");
      hasError = true;
    } else if (!validateEmail(email)) {
      setEmailError("Please enter a valid email");
      hasError = true;
    }

    if (!password) {
      setPasswordError("Password is required");
      hasError = true;
    } else if (password.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      hasError = true;
    }

    if (hasError) return;

    setIsLoading(true);

    try {
      const details = { email: email.trim(), password };
      // console.log("serverUrl ",SERVER_URL);
      const response = await axios.post(
        `${SERVER_URL}/SignInDetails`,
        details,
        { headers: { "Content-Type": "application/json" } }
      );

      if (response.status === 200) {
        const { token, userId } = response.data;

        // Save JWT
        await AsyncStorage.setItem("token", token);

        // Navigate to Home
        navigation.reset({
          index: 0,
          routes: [{ name: "HomeScreen" }],
        });
      } else {
        setValidation(response.data?.message || "Login failed");
      }
    } catch (error) {
      console.log("Login error:", error.message);
      if (error.response?.status === 401) {
        setValidation("Invalid email or password");
      } else if (error.response?.status === 404) {
        setValidation("Account not found");
      } else {
        setValidation("Connection error. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };
  const handleAppleSignIn = async () => {
  try {
    console.log("Apple available:", await AppleAuthentication.isAvailableAsync());
    console.log("Apple user:", await AppleAuthentication.getCredentialStateAsync("test").catch(()=>null));
    
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    // send credential.identityToken to your server
    console.log(credential);
  } catch (e) {
    if (e.code === 'ERR_CANCELED') {
      // user canceled
    } else {
      console.log(e);
    }
  }
};

  const EyeIcon = ({ visible }) => (
    <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      {visible ? (
        <Path
          d="M12 5C7 5 2.73 8.11 1 12.5 2.73 16.89 7 20 12 20s9.27-3.11 11-7.5C21.27 8.11 17 5 12 5zm0 12.5c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"
          fill="#666"
        />
      ) : (
        <Path
          d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"
          fill="#666"
        />
      )}
    </Svg>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {/* Logo Section */}
          <View style={styles.logoContainer}>
            <Image
              source={require("../assets/mago-logo-transparent.png")}
              style={styles.logo}
            />
            <Text style={styles.title}>Maggo</Text>
            {/* <Text style={styles.subtitle}>Sign in to continue</Text> */}
          </View>

          {/* Form Section */}
          <View style={styles.form}>
            {/* Global Error Message */}
            {validation && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>⚠️ {validation}</Text>
              </View>
            )}

            {/* Email Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                placeholder="Enter your email"
                value={email}
                onChangeText={handleEmailChange}
                style={[
                  styles.input,
                  emailError && styles.inputError,
                ]}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
              {emailError ? (
                <Text style={styles.fieldError}>{emailError}</Text>
              ) : null}
            </View>

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  placeholder="Enter your password"
                  value={password}
                  secureTextEntry={!showPassword}
                  onChangeText={handlePasswordChange}
                  style={[
                    styles.input,
                    styles.passwordInput,
                    passwordError && styles.inputError,
                  ]}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                >
                  <EyeIcon visible={showPassword} />
                </TouchableOpacity>
              </View>
              {passwordError ? (
                <Text style={styles.fieldError}>{passwordError}</Text>
              ) : null}
            </View>

            {/* Forgot Password */}
            <TouchableOpacity
              style={styles.forgotPassword}
              onPress={() => navigation.navigate("ForgotPassword")}
              disabled={isLoading}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>

            {/* Sign In Button */}
            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleSignIn}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>
            <View style={styles.signInButtons}>
            {/* Google Sign In */}
            <GoogleSignInButton disabled={isLoading} />
            {/* ios Sign In */}
            <AppleSignInButton />
            </View>
            {/* Sign Up Link */}
            <View style={styles.signUpContainer}>
              <Text style={styles.signUpText}>Don't have an account? </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate("SignUp")}
                disabled={isLoading}
              >
                <Text style={styles.signUpLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const isRTL = I18nManager.isRTL;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
    paddingTop: 25,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingBottom: 24,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  logo: {
    width: 150,
    height: 150,
    marginBottom: 16,
    resizeMode: "contain",
  },
  title: {
    fontSize: 52,
    fontWeight: "800",
    color: "#1e90ff",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  form: {
    width: "100%",
  },
  errorContainer: {
    backgroundColor: "#fee",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: "#dc3545",
  },
  errorText: {
    color: "#dc3545",
    fontSize: 14,
    fontWeight: "600",
    textAlign: isRTL ? "right" : "left",
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 8,
    textAlign: isRTL ? "right" : "left",
  },
  input: {
    borderWidth: 1.5,
    borderColor: "#e0e0e0",
    backgroundColor: "#f9f9f9",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    fontSize: 16,
    color: "#1a1a1a",
    textAlign: isRTL ? "right" : "left",
  },
  inputError: {
    borderColor: "#dc3545",
    backgroundColor: "#fff5f5",
  },
  fieldError: {
    color: "#dc3545",
    fontSize: 12,
    marginTop: 6,
    textAlign: isRTL ? "right" : "left",
  },
  passwordContainer: {
    position: "relative",
  },
  passwordInput: {
    paddingRight: isRTL ? 16 : 50,
    paddingLeft: isRTL ? 50 : 16,
  },
  eyeIcon: {
    position: "absolute",
    right: isRTL ? undefined : 16,
    left: isRTL ? 16 : undefined,
    top: 16,
    padding: 4,
  },
  forgotPassword: {
    alignSelf: isRTL ? "flex-start" : "flex-end",
    marginBottom: 24,
  },
  forgotPasswordText: {
    color: "#1e90ff",
    fontSize: 14,
    fontWeight: "600",
  },
  button: {
    backgroundColor: "#1e90ff",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    width: "100%",
    shadowColor: "#1e90ff",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    marginBottom: 24,
  },
  buttonDisabled: {
    backgroundColor: "#a0c4ff",
    shadowOpacity: 0.1,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
    textAlign: "center",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#e0e0e0",
  },
  dividerText: {
    marginHorizontal: 16,
    color: "#999",
    fontSize: 14,
    fontWeight: "500",
  },
  signInButtons: {
    flexDirection: "row",
    justifyContent: "center",
  },
  signUpContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 24,
  },
  signUpText: {
    fontSize: 14,
    color: "#666",
  },
  signUpLink: {
    fontSize: 14,
    color: "#1e90ff",
    fontWeight: "700",
  },
});

export default LoginScreen;