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
       console.log(res.data);
      if (!res.data.businessName || !res.data.businessId || !res.data.address) {
            Alert.alert("Hi, please fill all required fields")
            navigation.navigate("ProfileDetails");
          } else {
           // Navigate to home
        navigation.reset({
        index: 0,
        routes: [{ name: "HomeScreen" }],
      });
          }
      

    } catch (error) {
      console.log("Google login error:", error);
    }
  };

  return (
    <Pressable
      style={[styles.button, { flexDirection: !isRTL ? "row-reverse" : "row" }]}
      disabled={!request}
      onPress={() => promptAsync()}
    >
      {/* <Text style={styles.text}>Sign in with Google</Text> */}
      <Image
        source={require("../assets/google.png")}
        style={styles.icon}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: "#FFFFFF",
    borderRadius: 50,
    borderWidth: 1,
    borderColor: "#DADCE0",
    // paddingVertical: 9,
    // width: "100%",
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    // paddingHorizontal: 10,
    // Shadow
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
    
  },
  text: {
    fontSize: 16,
    color: "#3C4043",
    fontWeight: "600",
    marginLeft: 10,
  },
});
