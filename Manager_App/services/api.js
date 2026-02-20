// api.js
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SERVER_URL } from "@env";
console.log("");

// Create Axios instance
const api = axios.create({
  baseURL: SERVER_URL,
  headers: {
    Accept: "application/json",
  },
});

// REQUEST INTERCEPTOR: attach token to every request
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem("token");
    if (token) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      };
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// RESPONSE INTERCEPTOR: handle 401 (expired token)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Only attempt refresh once
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url.includes("/refresh")
    ) {
      originalRequest._retry = true;

      try {
        const refreshToken = await AsyncStorage.getItem("refreshToken");
        if (!refreshToken) throw new Error("No refresh token available");

        // Call backend refresh endpoint
        const res = await axios.post(`${SERVER_URL}/refresh`, {
          token: refreshToken,
        });

        const newAccessToken = res.data.accessToken;
        await AsyncStorage.setItem("token", newAccessToken);

        // Retry original request with new token
        originalRequest.headers = {
          ...originalRequest.headers,
          Authorization: `Bearer ${newAccessToken}`,
        };
        return api(originalRequest);
      } catch (refreshError) {
        console.error("Refresh token failed:", refreshError);
        // Optional: clear storage or navigate to login
        await AsyncStorage.removeItem("token");
        await AsyncStorage.removeItem("refreshToken");
      }
    }

    return Promise.reject(error);
  }
);

export default api;
