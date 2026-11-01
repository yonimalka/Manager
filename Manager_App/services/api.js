import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SERVER_URL } from "@env";
import { CommonActions } from "@react-navigation/native";
import { DeviceEventEmitter } from "react-native";
import { track } from "../utils/analytics";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || SERVER_URL;

// ── Navigator ref ──────────────────────────────────────────────────────────────
let _navigator = null;
export const setNavigator = (ref) => { _navigator = ref; };

// ── Session ────────────────────────────────────────────────────────────────────
const clearSessionAndRedirect = async () => {
  await AsyncStorage.multiRemove(["token", "refreshToken"]);
  if (_navigator) {
    _navigator.dispatch(
      CommonActions.reset({ index: 0, routes: [{ name: "LoginScreen" }] })
    );
  }
};

// ── JWT exp decoder (no library) ──────────────────────────────────────────────
const decodeTokenExp = (token) => {
  try {
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(b64));
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
};

// ── Refresh helpers ────────────────────────────────────────────────────────────
let isRefreshing = false;
let refreshQueue = [];

const processQueue = (err, token = null) => {
  refreshQueue.forEach(({ resolve, reject }) => (err ? reject(err) : resolve(token)));
  refreshQueue = [];
};

const doRefresh = async () => {
  const refreshToken = await AsyncStorage.getItem("refreshToken");
  if (!refreshToken) throw new Error("no_refresh_token");
  const res = await axios.post(`${BASE_URL}/refresh`, { token: refreshToken });
  const newToken = res.data.accessToken;
  await AsyncStorage.setItem("token", newToken);
  if (res.data.refreshToken) {
    await AsyncStorage.setItem("refreshToken", res.data.refreshToken);
  }
  return newToken;
};

// ── Proactive startup refresh (if token expires within 12 h) ──────────────────
let startupDone = false;
let startupPromise = null;

const checkStartupRefresh = () => {
  if (startupDone) return Promise.resolve();
  if (!startupPromise) {
    startupPromise = (async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        if (token) {
          const exp = decodeTokenExp(token);
          const secsLeft = exp != null ? exp - Math.floor(Date.now() / 1000) : Infinity;
          if (secsLeft < 12 * 3600) await doRefresh();
        }
      } catch {
        // Proactive refresh failed — response interceptor will handle it per-request
      } finally {
        startupDone = true;
      }
    })();
  }
  return startupPromise;
};

// ── Auth endpoints: their error responses must reach the caller unchanged ──────
const AUTH_ENDPOINTS = [
  "/SignInDetails",
  "/NewUser",
  "/GoogleSignIn",
  "/AppleSignIn",
  "/refresh",
];

// ── Network error banner events ────────────────────────────────────────────────
export const NETWORK_BANNER_SHOW = "maggo_network_show";
export const NETWORK_BANNER_HIDE = "maggo_network_hide";

let lastBannerAt = 0;

const emitBannerShow = () => {
  const now = Date.now();
  if (now - lastBannerAt < 5000) return; // dedupe within 5 s
  lastBannerAt = now;
  DeviceEventEmitter.emit(NETWORK_BANNER_SHOW);
};

const emitBannerHide = () => {
  DeviceEventEmitter.emit(NETWORK_BANNER_HIDE);
};

// ── URL sanitizer: path only, no IDs or query params ──────────────────────────
const sanitizeUrl = (url) => {
  if (!url) return url;
  return url
    .split("?")[0]
    .replace(/\/[a-f0-9]{24}/gi, "/:id")
    .replace(/\/\d+/g, "/:id");
};

// ── Error analytics (only when user sees an error) ────────────────────────────
const trackError = (error) => {
  try {
    track("error_shown", {
      url: sanitizeUrl(error?.config?.url),
      method: error?.config?.method ?? null,
      status: error?.response?.status ?? null,
      code: error?.response?.data?.code ?? null,
    });
  } catch {}
};

// ── Axios instance ─────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: BASE_URL,
  headers: { Accept: "application/json" },
});

// REQUEST: proactive startup refresh + attach token
api.interceptors.request.use(
  async (config) => {
    await checkStartupRefresh();
    const token = await AsyncStorage.getItem("token");
    if (token) config.headers = { ...config.headers, Authorization: `Bearer ${token}` };
    return config;
  },
  (error) => Promise.reject(error)
);

// RESPONSE: token refresh queue, network retry, banner, analytics
api.interceptors.response.use(
  (response) => {
    emitBannerHide();
    return response;
  },
  async (error) => {
    const cfg = error.config;
    const status = error.response?.status;
    const code = error.response?.data?.code;

    // Auth endpoints and unauthenticated requests bypass token lifecycle handling
    // so their 401/409 responses reach the calling screen unchanged.
    const isAuthEndpoint = AUTH_ENDPOINTS.some((ep) => cfg?.url?.includes(ep));
    const hasStoredToken = !!cfg?.headers?.Authorization;

    // ── 1 & 2: Token lifecycle ────────────────────────────────────────────────
    if (!isAuthEndpoint && hasStoredToken) {
      // Expired token: 401 TOKEN_EXPIRED or legacy 403 from auth middleware
      const isExpiredToken =
        (status === 401 && code === "TOKEN_EXPIRED") ||
        (status === 403 && !cfg?.url?.includes("/refresh"));

      if (isExpiredToken && !cfg._retry) {
        cfg._retry = true;

        if (isRefreshing) {
          // Queue behind the in-flight refresh — don't start a second one
          return new Promise((resolve, reject) => {
            refreshQueue.push({ resolve, reject });
          }).then((newToken) => {
            cfg.headers = { ...cfg.headers, Authorization: `Bearer ${newToken}` };
            return api(cfg);
          });
        }

        isRefreshing = true;
        try {
          const newToken = await doRefresh();
          processQueue(null, newToken);
          cfg.headers = { ...cfg.headers, Authorization: `Bearer ${newToken}` };
          return api(cfg);
        } catch (refreshErr) {
          processQueue(refreshErr);
          await clearSessionAndRedirect();
          return Promise.reject(refreshErr);
        } finally {
          isRefreshing = false;
        }
      }

      // Invalid token or failed refresh → sign out silently
      if (status === 401 || (cfg?.url?.includes("/refresh") && status === 403)) {
        await clearSessionAndRedirect();
        return Promise.reject(error);
      }
    }

    // ── 3. Network error: retry GET once after 1.5 s ──────────────────────────
    if (!error.response && cfg?.method?.toLowerCase() === "get" && !cfg._networkRetry) {
      cfg._networkRetry = true;
      await new Promise((r) => setTimeout(r, 1500));
      return api(cfg).catch((retryErr) => {
        emitBannerShow();
        trackError(retryErr);
        return Promise.reject(retryErr);
      });
    }

    // ── 4. Remaining failures: banner for network, analytics for all ──────────
    const isNetworkErr = !error.response;
    const isSilent = status === 404 || status === 401;

    if (!isSilent) {
      if (isNetworkErr) emitBannerShow();
      trackError(error);
    }

    return Promise.reject(error);
  }
);

export default api;
