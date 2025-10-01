import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SERVER_URL } from "@env";

const api = axios.create({
  baseURL: SERVER_URL,
});

// Attach token before every request
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 → refresh token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await AsyncStorage.getItem("refreshToken");
        if (!refreshToken) throw new Error("No refresh token");

        const res = await axios.post(`${SERVER_URL}/refresh`, {
          token: refreshToken,
        });

        const newAccessToken = res.data.accessToken;
        await AsyncStorage.setItem("token", newAccessToken);

        // retry with new token
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (err) {
        console.error("Refresh token failed:", err);
        // optional: clear storage + redirect to login
        await AsyncStorage.removeItem("token");
        await AsyncStorage.removeItem("refreshToken");
      }
    }

    return Promise.reject(error);
  }
);

export default api;
