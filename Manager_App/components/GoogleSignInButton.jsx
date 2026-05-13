import React, { useEffect } from 'react';
import { Pressable, Text, Image, StyleSheet, Alert, I18nManager } from 'react-native';
import { useNavigation, useRoute } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import axios from "axios";
import {SERVER_URL} from "@env";
import api from "../services/api";

WebBrowser.maybeCompleteAuthSession();

export default function GoogleSignInButton() {

 const navigation = useNavigation();
  const isRTL = I18nManager.isRTL;
  // Create the Google Sign-In request
  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: '717125560385-pg4scnvjueo0d674ha1epbal1v8f2ihv.apps.googleusercontent.com',
    androidClientId: '717125560385-vcrk16p32k67biaa2c6s9dvqinds9kdh.apps.googleusercontent.com',
    webClientId: '717125560385-la93i0qs4qdns1ahcrr59r8dv20l07od.apps.googleusercontent.com',
  });

  // Handle the sign-in result
  useEffect(() => {
  const getUserInfo = async () => {
    if (response?.type === "success") {
      const accessToken = response.authentication.accessToken;

    //   const userInfoResponse = await fetch(
    //     "https://www.googleapis.com/userinfo/v2/me",
    //     { headers: { Authorization: `Bearer ${accessToken}` } }
    //   );

    //   const user = await userInfoResponse.json();
    //   Alert.alert('Logged in!', JSON.stringify(user, null, 2));
      // Now send this to your server
      await handleGoogleLogin(accessToken);
    }
  };

  getUserInfo();
      // You can now use authentication.accessToken to fetch user info
  }, [response]);

   const handleGoogleLogin = async (accessToken) => {
    try {
    //   const accessToken = response.authentication.accessToken;

      // 1. Get google profile
      const userInfo = await fetch(
        "https://www.googleapis.com/userinfo/v2/me",
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const googleUser = await userInfo.json();
//    Alert.alert('Logged in0000!', JSON.stringify(googleUser, null, 2));
// console.log( "google user: ,", googleUser);

      // Send user to backend
      
      const response = await axios.post(`${SERVER_URL}/GoogleSignIn`, {
        googleId: googleUser.id,
        email: googleUser.email,
        name: googleUser.name,
        avatar: googleUser.picture,
      },
    { headers: { "Content-Type": "application/json" } });

      const { token } = response.data;
      
      // Save login token locally
      await AsyncStorage.setItem("token", token);
      const res = await api.get("/getUserDetails");
      // New user: no business name or currency set yet → quick setup
      if (!res.data.businessName || !res.data.currency) {
        navigation.reset({ index: 0, routes: [{ name: "QuickSetup" }] });
      } else {
        navigation.reset({ index: 0, routes: [{ name: "HomeScreen" }] });
      }
      

    } catch (error) {
      console.log("Google login error:", error);
    }
  };

  return (
    <Pressable
      style={[styles.button, !request && { opacity: 0.5 }]}
      disabled={!request}
      onPress={() => promptAsync()}
    >
      <Image
        source={require("../assets/google.png")}
        style={styles.icon}
      />
      <Text style={styles.text}>Continue with Google</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    paddingVertical: 15,
    paddingHorizontal: 20,
    width: "100%",
    gap: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    marginBottom: 12,
  },
  icon: {
    width: 25,
    height: 25,
  },
  text: {
    fontSize: 15,
    color: "#1E293B",
    fontWeight: "600",
  },
});
