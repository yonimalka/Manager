import { useState, useEffect } from "react";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as jwt from "jwt-decode"; // import everything

export const useAuth = () => {
  const [auth, setAuth] = useState({
    userId: null,
    role: null,
    isAuthenticated: false,
  });

  const navigation = useNavigation();

  useEffect(() => {
    const loadAuth = async () => {
      try {
        const token = await AsyncStorage.getItem("token");

        if (token && typeof token === "string") {
          // Use .default to handle Hermes React Native quirks
          const decoded = jwt.default ? jwt.default(token) : jwt(token);

          const now = Date.now() / 1000; // current time in seconds

          if (decoded.exp && decoded.exp < now) {
            console.log("Access token expired");
            await AsyncStorage.removeItem("token");
            await AsyncStorage.removeItem("refreshToken");
            setAuth({ userId: null, role: null, isAuthenticated: false });
            navigation.reset({ index: 0, routes: [{ name: "LoginScreen" }] });
            return;
          }

          setAuth({
            userId: decoded.userId || null,
            role: decoded.role || null,
            isAuthenticated: true,
          });
        } else {
          console.log("Token missing or invalid");
          await AsyncStorage.removeItem("token");
          await AsyncStorage.removeItem("refreshToken");
          setAuth({ userId: null, role: null, isAuthenticated: false });
          navigation.reset({ index: 0, routes: [{ name: "LoginScreen" }] });
        }
      } catch (err) {
        console.error("Failed to decode token", err);
        await AsyncStorage.removeItem("token");
        await AsyncStorage.removeItem("refreshToken");
        setAuth({ userId: null, role: null, isAuthenticated: false });
        navigation.reset({ index: 0, routes: [{ name: "LoginScreen" }] });
      }
    };

    loadAuth();
  }, [navigation]);

  const logout = async () => {
    await AsyncStorage.removeItem("token");
    await AsyncStorage.removeItem("refreshToken");
    setAuth({ userId: null, role: null, isAuthenticated: false });
    navigation.reset({ index: 0, routes: [{ name: "LoginScreen" }] });
  };

  return { ...auth, logout };
};
