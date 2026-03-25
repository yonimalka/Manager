// useAuth.js
import { useState, useEffect, useCallback } from "react";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../services/api";
import jwtDecode from "jwt-decode";
// import { configureRevenueCat } from "../services/revenuecat";
import { refreshSubscriptionStatus } from "../services/subscription";
import { configureRevenueCat } from "../services/revenuecat";
// import { refreshSubscriptionStatus } from "../services/subscription";

export const useAuth = () => {
  const [auth, setAuth] = useState({
    userId: null,
    role: null,
    isAuthenticated: false,
    authLoading: true,
  });

  const [userDetails, setUserDetails] = useState({});

  const navigation = useNavigation();

  const loadAuth = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");

      if (!token) {
        setAuth({ userId: null, role: null, isAuthenticated: false, authLoading: false });
        navigation.reset({ index: 0, routes: [{ name: "LoginScreen" }] });
        return;
      }

      const decoded = jwtDecode(token);
      const now = Date.now() / 1000;

      if (decoded.exp && decoded.exp < now) {
        await AsyncStorage.removeItem("token");
        await AsyncStorage.removeItem("refreshToken");

        setAuth({ userId: null, role: null, isAuthenticated: false, authLoading: false });
        navigation.reset({ index: 0, routes: [{ name: "LoginScreen" }] });
        return;
      }

      // ✅ Set basic auth
      setAuth({
        userId: decoded.userId,
        role: decoded.role || null,
        isAuthenticated: true,
        authLoading: false,
      });

      await configureRevenueCat(decoded.userId);
      await refreshSubscriptionStatus().catch((error) => {
        console.error("Initial subscription refresh failed:", error);
      });

      // ✅ Fetch full user profile (INCLUDING currency)
      const res = await api.get(`/getUserDetails`);
      setUserDetails(res.data);

      // ✅ Configure RevenueCat
      await configureRevenueCat(decoded.userId);
      await refreshSubscriptionStatus().catch(() => {});

    } catch (err) {
      console.error("Auth failed:", err);
      setAuth({ userId: null, role: null, isAuthenticated: false, authLoading: false });
      navigation.reset({ index: 0, routes: [{ name: "LoginScreen" }] });
    }
  }, [navigation]);

  useEffect(() => {
    loadAuth();
  }, [loadAuth]);

  const logout = async () => {
    await AsyncStorage.removeItem("token");
    await AsyncStorage.removeItem("refreshToken");

    setAuth({ userId: null, role: null, isAuthenticated: false, authLoading: false });
    setUserDetails(null);

    navigation.reset({ index: 0, routes: [{ name: "LoginScreen" }] });
  };

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

  return {
    ...auth,
    userDetails,
    setUserDetails,
    logout,
    fetchWithAuth,
  };
};