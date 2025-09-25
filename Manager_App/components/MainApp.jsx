import { View, Text, Button, ActivityIndicator, FlatList, TouchableOpacity, I18nManager, Platform  } from "react-native";
import React, { useEffect, useState, useCallback } from "react";
import * as Updates from 'expo-updates';
import AsyncStorage from '@react-native-async-storage/async-storage';
// if (!I18nManager.isRTL) {
//       I18nManager.allowRTL(true);
//       I18nManager.forceRTL(true);
//       // Alert.alert(
//       //   'RTL mode enabled',
//       //   'Please restart the app to apply right-to-left layout.'
//       // );
      
//     }
import { NavigationContainer, useFocusEffect } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import axios from "axios";
import { SERVER_URL } from "@env";

// Import Screens
import HomeScreen from "./HomeScreen";
import Incomes from "./Incomes";
import Expenses from "./Expenses";
import NewProject from "./NewProject";
import Project from "./Project";
import AboutProject from "./AboutProject";
import Receipts from "./Receipts";
import SignUp from "./SignUp";
import LoginScreen from "./LoginScreen";
import { ValueProvider } from "./ValueContext";
import PriceOffer from "./PriceOffer";
import PdfPreview from "./PdfPreview";
import CashFlow from "./CashFlow";
import ProfileDetails from "./ProfileDetails";
import ReceiptPreview from "./ReceiptPreview";
import { useAuth } from "./useAuth";
// React Navigation Setup
const Stack = createStackNavigator();

const MainApp = () => {

  // useEffect(() => {
  //   if (!I18nManager.isRTL) {
  //     I18nManager.allowRTL(true);
  //     I18nManager.forceRTL(true);
  //     Alert.alert(
  //       'RTL mode enabled',
  //       'Please restart the app to apply right-to-left layout.'
  //     );
  //     // You can prompt the user to reload or just set the state to false so the app shows a message or blank screen to reload
  //   } else {
  //     setIsRtlReady(true);
  //   }
  // }, []);

  // if (!isRtlReady) {
  //   return null; // or a splash/loading screen to wait for reload
  // }


  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="LoginScreen">
        <Stack.Screen name="PdfPreview" component={PdfPreview} options={{ headerShown: false }}/>
        <Stack.Screen name="ProfileDetails" component={ProfileDetails} options={{ headerShown: false }}/>
        <Stack.Screen name="LoginScreen" component={LoginScreen} options={{ headerShown: false }}/>
        <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }}/>
        <Stack.Screen name="SignUp" component={SignUp} options={{ headerShown: false }}/>
        <Stack.Screen name="AboutProject" component={AboutProject} options={{ headerShown: false }}/>
        <Stack.Screen name="NewProject" component={NewProject} options={{ headerShown: false }}/>
        <Stack.Screen name="PriceOffer" component={PriceOffer} options={{ headerShown: false }}/>
        <Stack.Screen name="Receipts" component={Receipts} options={{ headerShown: false }}/>
        <Stack.Screen name="ReceiptPreview" component={ReceiptPreview} options={{ headerShown: false }}/>
        <Stack.Screen name="CashFlow" component={CashFlow} options={{ headerShown: false }}/>
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default MainApp;
