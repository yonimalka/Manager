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
} from "react-native";
import { SERVER_URL } from "@env";
import axios from "axios";
import { TextInput } from "react-native-gesture-handler";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import GoogleSignInButton from "./GoogleSignInButton";
import AppleSignInButton from "./AppleSignInButton";
import Svg, { Path } from "react-native-svg";

const isRTL = I18nManager.isRTL;

const EyeIcon = ({ visible }) => (
  <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    {visible ? (
      <Path
        d="M12 5C7 5 2.73 8.11 1 12.5 2.73 16.89 7 20 12 20s9.27-3.11 11-7.5C21.27 8.11 17 5 12 5zm0 12.5c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"
        fill="#94A3B8"
      />
    ) : (
      <Path
        d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"
        fill="#94A3B8"
      />
    )}
  </Svg>
);

const LoginScreen = () => {
  const navigation = useNavigation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [validation, setValidation] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

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
    setEmailError("");
    setPasswordError("");
    setValidation(null);

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
      const response = await axios.post(
        `${SERVER_URL}/SignInDetails`,
        { email: email.trim(), password },
        { headers: { "Content-Type": "application/json" } }
      );

      if (response.status === 200) {
        const { token } = response.data;
        await AsyncStorage.setItem("token", token);
        navigation.reset({ index: 0, routes: [{ name: "HomeScreen" }] });
      } else {
        setValidation(response.data?.message || "Login failed");
      }
    } catch (error) {
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

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.logoSection}>
          <Image
            source={require("../assets/MaggoLogo-transparent.png")}
            style={styles.logo}
          />
          <Text style={styles.tagline}>Welcome back</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>

          {validation && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{validation}</Text>
            </View>
          )}

          {/* Email */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Email</Text>
            <TextInput
              placeholder="your@email.com"
              placeholderTextColor="#C0CADB"
              value={email}
              onChangeText={handleEmailChange}
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
              style={[
                styles.input,
                emailFocused && styles.inputFocused,
                emailError && styles.inputError,
              ]}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />
            {emailError ? <Text style={styles.fieldError}>{emailError}</Text> : null}
          </View>

          {/* Password */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Password</Text>
            <View style={styles.passwordWrap}>
              <TextInput
                placeholder="••••••••"
                placeholderTextColor="#C0CADB"
                value={password}
                secureTextEntry={!showPassword}
                onChangeText={handlePasswordChange}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                style={[
                  styles.input,
                  styles.passwordInput,
                  passwordFocused && styles.inputFocused,
                  passwordError && styles.inputError,
                ]}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPassword(!showPassword)}
                disabled={isLoading}
              >
                <EyeIcon visible={showPassword} />
              </TouchableOpacity>
            </View>
            {passwordError ? <Text style={styles.fieldError}>{passwordError}</Text> : null}
          </View>

          {/* Forgot Password */}
          <TouchableOpacity
            style={styles.forgotWrap}
            onPress={() => navigation.navigate("ForgotPassword")}
            disabled={isLoading}
          >
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          {/* Sign In Button */}
          <TouchableOpacity
            style={[styles.signInBtn, isLoading && styles.signInBtnDisabled]}
            onPress={handleSignIn}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.signInBtnText}>Sign In</Text>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerLabel}>or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Social */}
          <View style={styles.socialRow}>
            <GoogleSignInButton disabled={isLoading} />
            <AppleSignInButton />
          </View>

          {/* Sign Up */}
          <View style={styles.signUpRow}>
            <Text style={styles.signUpText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate("SignUp")} disabled={isLoading}>
              <Text style={styles.signUpLink}>Sign up</Text>
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FAFBFF",
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: Platform.OS === "ios" ? 70 : 50,
    paddingBottom: 40,
  },

  // ── Logo ─────────────────────────────────────────────────
  logoSection: {
    alignItems: "center",
    marginBottom: 44,
  },
  logo: {
    width: 200,
    height: 200,
    resizeMode: "contain",
    marginBottom: 4,
  },
  tagline: {
    fontSize: 17,
    color: "#94A3B8",
    fontWeight: "500",
    letterSpacing: 0.2,
  },

  // ── Form ─────────────────────────────────────────────────
  form: {
    width: "100%",
  },
  errorBanner: {
    backgroundColor: "#FFF1F2",
    borderWidth: 1,
    borderColor: "#FECDD3",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 22,
  },
  errorBannerText: {
    color: "#BE123C",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },

  // ── Fields ───────────────────────────────────────────────
  field: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 8,
    letterSpacing: 0.2,
    textAlign: isRTL ? "right" : "left",
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#E8EDF5",
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 16,
    fontSize: 15,
    color: "#1E293B",
    textAlign: isRTL ? "right" : "left",
    shadowColor: "#94A3B8",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  inputFocused: {
    borderColor: "#93C5FD",
    backgroundColor: "#F8FBFF",
    shadowOpacity: 0.1,
  },
  inputError: {
    borderColor: "#FCA5A5",
    backgroundColor: "#FFF8F8",
  },
  fieldError: {
    color: "#EF4444",
    fontSize: 12,
    marginTop: 6,
    fontWeight: "500",
    textAlign: isRTL ? "right" : "left",
  },
  passwordWrap: {
    position: "relative",
  },
  passwordInput: {
    paddingRight: isRTL ? 16 : 50,
    paddingLeft: isRTL ? 50 : 16,
  },
  eyeBtn: {
    position: "absolute",
    right: isRTL ? undefined : 14,
    left: isRTL ? 14 : undefined,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    padding: 4,
  },

  // ── Forgot ───────────────────────────────────────────────
  forgotWrap: {
    alignSelf: isRTL ? "flex-start" : "flex-end",
    marginBottom: 28,
  },
  forgotText: {
    fontSize: 13,
    color: "#3B82F6",
    fontWeight: "600",
  },

  // ── Sign In Button ───────────────────────────────────────
  signInBtn: {
    backgroundColor: "#2563EB",
    paddingVertical: 17,
    borderRadius: 16,
    alignItems: "center",
    shadowColor: "#2563EB",
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    marginBottom: 30,
  },
  signInBtnDisabled: {
    backgroundColor: "#93C5FD",
    shadowOpacity: 0.1,
  },
  signInBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
    letterSpacing: 0.3,
  },

  // ── Divider ──────────────────────────────────────────────
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E8EDF5",
  },
  dividerLabel: {
    fontSize: 13,
    color: "#94A3B8",
    fontWeight: "500",
  },

  // ── Social ───────────────────────────────────────────────
  socialRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginBottom: 32,
  },

  // ── Sign Up ──────────────────────────────────────────────
  signUpRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  signUpText: {
    fontSize: 14,
    color: "#94A3B8",
  },
  signUpLink: {
    fontSize: 14,
    color: "#2563EB",
    fontWeight: "700",
  },
});

export default LoginScreen;
