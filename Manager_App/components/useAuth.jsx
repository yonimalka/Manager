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
  const [authLoading, setLoading] = useState(true); // 👈 NEW state

  const navigation = useNavigation();

  useEffect(() => {
    const loadAuth = async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        
        if (token) {
          const decoded = jwtDecode(token);

          const now = Date.now() / 1000;
          if (decoded.exp && decoded.exp < now) {
            console.log("JWT expired");
            await AsyncStorage.removeItem("token");
            setAuth({ userId: null, role: null, isAuthenticated: false });
          } else {
            setAuth({
              userId: decoded.userId,
              role: decoded.role || null,
              isAuthenticated: true,
            });
          }
        } else {
          setAuth({ userId: null, role: null, isAuthenticated: false });
        }
      } catch (err) {
        console.error("Failed to decode token", err);
        setAuth({ userId: null, role: null, isAuthenticated: false });
      } finally {
        setLoading(false); // 👈 finish loading no matter what
      }
    };

    loadAuth();
  }, []);

  const logout = async () => {
    await AsyncStorage.removeItem("token");
    setAuth({ userId: null, role: null, isAuthenticated: false });
    navigation.reset({
      index: 0,
      routes: [{ name: "LoginScreen" }],
    });
  };

  return { ...auth, authLoading, logout };
};
