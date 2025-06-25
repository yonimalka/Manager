import React, { useEffect, useState, useCallback } from "react";
import { View, Text, Button, ActivityIndicator, FlatList, TouchableOpacity } from "react-native";
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
// React Navigation Setup
const Stack = createStackNavigator();

const MainApp = () => {
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
