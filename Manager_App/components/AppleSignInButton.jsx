import React from "react";
import {
  TouchableOpacity,
  View,
  Text,
  Image,
  StyleSheet,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import * as AppleAuthentication from "expo-apple-authentication";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

const SERVER_URL = Constants.expoConfig.extra.SERVER_URL;

export default function AppleSignInButton() {
  const navigation = useNavigation();
const signInWithApple = async () => {
  try {

    // Check availability
    const available = await AppleAuthentication.isAvailableAsync();

    if (!available) {
      throw new Error("Apple Sign-In not available");
    }

    // Apple login popup
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      throw new Error("No identityToken received");
    }

    // Send to backend
    const response = await axios.post(
      `${SERVER_URL}/AppleSignIn`,
      {
        identityToken: credential.identityToken,
        fullName: credential.fullName,
      }
    );

    const { token, refreshToken } = response.data;

    // Save tokens locally
    await AsyncStorage.setItem("token", token);
    await AsyncStorage.setItem("refreshToken", refreshToken);
     // Navigate to home
        navigation.reset({
        index: 0,
        routes: [{ name: "HomeScreen" }],
      });
    return {
      success: true,
      token,
      refreshToken,
    };

  } catch (error) {

    if (error.code === "ERR_CANCELED") {

      return { success: false, cancelled: true };

    }

    console.error("Apple Sign-In Error:", error);

    return {
      success: false,
      error: error.message,
    };
  }
};
const handleLogin = async () => {

    const result = await signInWithApple();

    if (result.success) {

      console.log("Login success");

      // Navigate to main screen
      // navigation.replace("Home");

    }

  };

  return (
    <TouchableOpacity style={styles.button} onPress={handleLogin}>
      
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        
        <Image
          source={require("../assets/apple-logo.png")}
          style={styles.icon}
          resizeMode="contain"
        />

        {/* <Text style={styles.text}>
          Sign in with Apple
        </Text> */}

      </View>

    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({

  button: {
    backgroundColor: "#0000",
    borderRadius: 38,
    borderWidth: 1,
    borderColor: "#DADCE0",
    // paddingVertical: 9,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    // paddingHorizontal: 10,

    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    marginHorizontal: 10,
    marginTop: 20,
    marginBottom: 20,
  },

  icon: {
    width: 60,
    height: 60,
    // borderWidth: 1,
    borderRadius: 50,
  },

  text: {
    fontSize: 16,
    color: "#3C4043",
    fontWeight: "600",
    marginLeft: 10,
  },

});