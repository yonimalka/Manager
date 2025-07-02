import { I18nManager, Platform, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Updates from "expo-updates";

(async () => {
  const alreadySet = await AsyncStorage.getItem("rtlApplied");
  if (!I18nManager.isRTL && alreadySet !== "true") {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(true);
    await AsyncStorage.setItem("rtlApplied", "true");

    if (Platform.OS !== "web") {
      await Updates.reloadAsync();
    }
  }
})();
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import MainApp from "./MainApp";

const App = () => {
//   const [isReady, setIsReady] = useState(false);

//   useEffect(() => {
//     const setupRTL = async () => {
//       try {
//         const rtlFlag = await AsyncStorage.getItem("rtlApplied");

//         if (!I18nManager.isRTL && rtlFlag !== "true") {
//           I18nManager.allowRTL(true);
//           I18nManager.forceRTL(true);
//           await AsyncStorage.setItem("rtlApplied", "true");

//           if (Platform.OS !== "web") {
//             await Updates.reloadAsync(); // Restarts the app once
//             return;
//           }
//         }

//         setIsReady(true);
//       } catch (err) {
//         Alert.alert("Failed to apply RTL:", err);
//         setIsReady(true); // Allow app to load even on failure
//       }
//     };

//     setupRTL();
//   }, []);

//   if (!isReady) {
//     return (
//       <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
//         <ActivityIndicator size="large" />
//       </View>
//     );
//   }

  return <MainApp />;
};

export default App;