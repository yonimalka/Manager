// hooks/useAuth.js
import { useState, useEffect } from "react";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import jwtDecode from "jwt-decode";

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
        if (token) {
          const decoded = jwtDecode(token);

          const now = Date.now() / 1000; // current time in seconds
          if (decoded.exp && decoded.exp < now) {
            console.log("Access token expired");
            await AsyncStorage.removeItem("token");
            await AsyncStorage.removeItem("refreshToken");
            setAuth({ userId: null, role: null, isAuthenticated: false });
            navigation.reset({ index: 0, routes: [{ name: "Login" }] });
            return;
          }

          setAuth({
            userId: decoded.userId,
            role: decoded.role || null,
            isAuthenticated: true,
          });
        } else {
          setAuth({ userId: null, role: null, isAuthenticated: false });
          navigation.reset({ index: 0, routes: [{ name: "LoginScreen" }] });
        }
      } catch (err) {
        console.error("Failed to decode token", err);
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
