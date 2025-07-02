import React, { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, Button, TouchableOpacity, Image, Alert, StyleSheet, I18nManager, } from "react-native";
import {SERVER_URL} from "@env";
import Constants from 'expo-constants';
import axios from "axios";
import { TextInput } from "react-native-gesture-handler";
import { useNavigation, NavigationContainer, useFocusEffect } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";

// const SERVER_URL = Constants.expoConfig.extra.SERVER_URL;

const SignUp = () => {
  const navigation = useNavigation();

  const [name, setName] = useState();
  const [surname, setSurname] = useState();
  const [email, setEmail] = useState();
  const [password, setPassword] = useState();

 const handleSignUp = () => {
    // console.log(name, surname, email, password);
    const newUserDetails = {
        name,
        surname,
        email,
        password,
    }
    
    
     axios.post(`${SERVER_URL}/NewUser`, newUserDetails, {
        headers: { "Content-Type": "application/json"},
        
     })
     navigation.navigate("LoginScreen")
 }

  return (
    <View style={styles.container}>
    <Text style={styles.title}>Sign Up</Text>

    <View style={styles.form}>
    <TextInput
        placeholder="First Name"
        value={name}
        onChangeText={setName}
        style={styles.input}
    />
    <TextInput
        placeholder="Last Name"
        value={surname}
        onChangeText={setSurname}
        style={styles.input}
    />
    <TextInput
        placeholder="Email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
    />
    <TextInput
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={styles.input}
    />
    </View>
    <TouchableOpacity style={styles.button} onPress={handleSignUp}>
    <Text style={styles.buttonText}>Sign Up</Text>
    </TouchableOpacity>
    </View>
  )
}

const isRTL = I18nManager.isRTL;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: isRTL ? "right" : "left",
    width: "100%", // to make textAlign work properly inside centered container
  },
  form: {
    width: "100%",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    backgroundColor: "white",
    padding: 12,
    marginBottom: 10,
    borderRadius: 5,
    width: "100%",
    textAlign: isRTL ? "right" : "left",
  },
  button: {
    backgroundColor: "blue",
    padding: 12,
    borderRadius: 5,
    alignItems: "center",
    width: "100%",
  },
  buttonText: {
    color: "white",
    fontWeight: "bold",
    textAlign: "center", // buttons usually center text regardless of RTL
  },
});


export default SignUp;