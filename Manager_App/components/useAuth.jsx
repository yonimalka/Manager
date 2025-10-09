// useAuth.js
import { useState, useEffect, useCallback } from "react";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../services/api";
import jwtDecode from "jwt-decode";

export const useAuth = () => {
  const [auth, setAuth] = useState({
    userId: null,
    role: null,
    isAuthenticated: false,
    authLoading: true, // new: track loading state
  });

  const navigation = useNavigation();

  // Load token from storage and validate
  const loadAuth = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");

      if (token) {
        const decoded = jwtDecode(token);

        const now = Date.now() / 1000; // current time in seconds
        if (decoded.exp && decoded.exp < now) {
          console.log("Access token expired");
          await AsyncStorage.removeItem("token");
          await AsyncStorage.removeItem("refreshToken");
          setAuth({ userId: null, role: null, isAuthenticated: false, loading: false });
          navigation.reset({ index: 0, routes: [{ name: "LoginScreen" }] });
          return;
        }

        setAuth({
          userId: decoded.userId,
          role: decoded.role || null,
          isAuthenticated: true,
          loading: false,
        });
      } else {
        setAuth({ userId: null, role: null, isAuthenticated: false, loading: false });
        navigation.reset({ index: 0, routes: [{ name: "LoginScreen" }] });
      }
    } catch (err) {
      console.error("Failed to decode token", err);
      setAuth({ userId: null, role: null, isAuthenticated: false, loading: false });
      navigation.reset({ index: 0, routes: [{ name: "LoginScreen" }] });
    }
  }, [navigation]);

  useEffect(() => {
    loadAuth();
  }, [loadAuth]);

  // Logout function
  const logout = async () => {
    await AsyncStorage.removeItem("token");
    await AsyncStorage.removeItem("refreshToken");
    setAuth({ userId: null, role: null, isAuthenticated: false, loading: false });
    navigation.reset({ index: 0, routes: [{ name: "LoginScreen" }] });
  };

  // Optional: helper to make authenticated API calls
  const fetchWithAuth = async (requestCallback) => {
    if (!auth.isAuthenticated) throw new Error("User not authenticated");
    try {
      const result = await requestCallback(api);
      return result;
    } catch (err) {
      console.error("API request failed:", err);
      throw err;
    }
  };

  return { ...auth, logout, fetchWithAuth };
};
