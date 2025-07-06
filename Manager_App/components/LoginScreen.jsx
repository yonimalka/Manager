import React, { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, Button, TouchableOpacity, Image, Alert, StyleSheet, I18nManager } from "react-native";
import {SERVER_URL} from "@env";
import Constants from 'expo-constants';
import axios from "axios";
import { TextInput } from "react-native-gesture-handler";
import { NavigationContainer, useFocusEffect } from "@react-navigation/native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import SignUp from "./SignUp";

// const SERVER_URL = Constants.expoConfig.extra.SERVER_URL;

const LoginScreen = () => {
  

    const navigation = useNavigation();

    const [email, setEmail] = useState();
    const [password, setPassword] = useState();
    const [login, setLogin] = useState(false);
    const [validation, setValidation] = useState();


//        useEffect(() => {
//   Alert.alert("Testing", "Making request to: " + SERVER_URL + "/ping");

//   axios.get(`${SERVER_URL}/ping`)
//     .then(res => {
//       console.log("Server response:", res.data);
//       Alert.alert("Success", "Server responded: " + JSON.stringify(res.data));
//     })
//     .catch(err => {
//       console.log("Request failed:", err.message);
//       Alert.alert("Error", "Request failed: " + err.message);
//     });
// }, []);

    const handleSignIn = async () => {
      
        const details = {
            email,
            password
        }
        
        const response = await axios.post(`${SERVER_URL}/SignInDetails`, details, {
            headers: {"Content-Type": "application/json"},
        })
        // const message = response;
        console.log("response: ",response.data);
        const userId = response.data.userId;
        console.log(userId);
        
        if(response.status === 200){
            setLogin(true);
            navigation.navigate("Home", {userId})
        } else {
          setValidation(message);
        }
        // if (!response.ok){
        //     throw new Error(result.message);
        // }
        // console.log('Success:', result.message);
    }
    return (
        <View style={styles.container}>
        <Image source={require("../assets/managoLogoTransparent.png")} style={styles.logo} />
            <Text style={styles.title}>Welcome</Text>

            <View style={styles.form}>
                <TextInput
                    placeholder="Email"
                    value={email}
                    onChangeText={setEmail}
                    style={styles.input}
                />
                <TextInput
                    placeholder="Password"
                    value={password}
                    secureTextEntry
                    onChangeText={setPassword}
                    style={styles.input}
                />
            </View>
            <TouchableOpacity style={styles.button} onPress={handleSignIn}>
                <Text style={styles.buttonText}>Sign In</Text>
            </TouchableOpacity>
            <Text>Don't have account? Sign Up!</Text>
            <Button title="Sign Up" onPress={()=> navigation.navigate("SignUp")}/>
        </View>
        
    )
}
const isRTL = I18nManager.isRTL;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    backgroundColor: "#f9f9f9",
    direction: isRTL ? "rtl" : "ltr",
  },
  logo: {
    width: 150,
    height: 150,
    marginBottom: 30,
    resizeMode: "contain",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 24,
    color: "#333",
    textAlign: "center",
    alignSelf: "stretch",
  },
  form: {
    width: "100%",
    direction: isRTL ? "rtl" : "ltr",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
    paddingVertical: 14,
    paddingStart: 16,
    paddingEnd: 16,
    marginBottom: 16,
    borderRadius: 8,
    fontSize: 16,
    textAlign: isRTL ? "right" : "left",
    direction: isRTL ? "rtl" : "ltr",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  button: {
    backgroundColor: "#1e90ff",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    width: "100%",
    shadowColor: "#1e90ff",
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
    textAlign: "center",
    paddingStart: 16,
    paddingEnd: 16,
    alignSelf: "stretch",
  },
});

export default LoginScreen;