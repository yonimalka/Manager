import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import { getStorage } from "firebase/storage";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";
import { signInAnonymously } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyADq95VEceWx_4qNHyV5r6fLyH3_2Abv9E",
  authDomain: "manager-app-eeda3.firebaseapp.com",
  projectId: "manager-app-eeda3",
  storageBucket: "manager-app-eeda3.firebasestorage.app",
  messagingSenderId: "843969483652",
  appId: "1:843969483652:web:ba1e8d33907d678f9743d1"
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage),
});

export const storage = getStorage(app);

// Optional: sign in anonymously for testing
export const signInFirebase = async () => {
  try {
    await signInAnonymously(auth);
    console.log("Signed in to Firebase anonymously");
  } catch (err) {
    console.error("Firebase auth error:", err);
  }
};
