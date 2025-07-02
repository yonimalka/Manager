import { I18nManager, Platform, View, ActivityIndicator } from "react-native";

if (!I18nManager.isRTL) {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
  Updates.reloadAsync(); // must restart immediately
}
import React, { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Updates from "expo-updates";
import MainApp from "./MainApp";

const App = () => {
//   const [isReady, setIsReady] = useState(false);

//   useEffect(() => {
//     async function setupRTL() {
//       try {
//         const rtlApplied = await AsyncStorage.getItem("rtlApplied");

//         if (!I18nManager.isRTL && rtlApplied !== "true") {
//           I18nManager.allowRTL(true);
//           I18nManager.forceRTL(true);
//           await AsyncStorage.setItem("rtlApplied", "true");

//           if (Platform.OS !== "web") {
//             await Updates.reloadAsync(); // This restarts the app immediately
//             return; // Don't render anything this run
//           }
//         }
//       } catch (error) {
//         console.error("RTL setup failed:", error);
//       }

//       setIsReady(true);
//     }

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
