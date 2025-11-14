import React, { useEffect } from 'react';
import { Button, Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';

WebBrowser.maybeCompleteAuthSession();

export default function GoogleSignInButton() {
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

      const userInfoResponse = await fetch(
        "https://www.googleapis.com/userinfo/v2/me",
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      const user = await userInfoResponse.json();
      Alert.alert('Logged in!', JSON.stringify(user, null, 2));
      // Now send this to your server
      handleLoginWithServer(user);
    }
  };

  getUserInfo();
      // You can now use authentication.accessToken to fetch user info
  }, [response]);

   const handleGoogleLogin = async (response) => {
    try {
      const accessToken = response.authentication.accessToken;

      // 1. Get google profile
      const userInfo = await fetch(
        "https://www.googleapis.com/userinfo/v2/me",
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const googleUser = await userInfo.json();

      // 2. Send user to backend
      const res = await axios.post(`${process.env.SERVER_URL}/GoogleSignIn`, {
        googleId: googleUser.id,
        email: googleUser.email,
        name: googleUser.name,
        avatar: googleUser.picture,
      });

      const { token } = res.data;

      // 3. Save login token locally
      await AsyncStorage.setItem("token", token);

      // 4. Navigate to home
      navigation.replace("Home");

    } catch (error) {
      console.log("Google login error:", error);
    }
  };

  return (
    <Button
      disabled={!request}
      title="Sign in with Google"
      onPress={() => {
        promptAsync();
      }}
    />
  );
}
