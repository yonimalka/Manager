import React, { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, Button, TouchableOpacity, Image, Alert, StyleSheet } from "react-native";
import {SERVER_URL} from "@env";
import axios from "axios";
import { TextInput } from "react-native-gesture-handler";
import { NavigationContainer, useFocusEffect } from "@react-navigation/native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import SignUp from "./SignUp";

const LoginScreen = () => {
    const navigation = useNavigation();

    const [email, setEmail] = useState();
    const [password, setPassword] = useState();
    const [login, setLogin] = useState(false);
    const [validation, setValidation] = useState();

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
            <Text style={styles.title}>Welcome!</Text>

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
const styles = StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  form: {
    width: '100%',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: 'white',
    padding: 12,
    marginBottom: 10,
    borderRadius: 5,
    width: '100%',
  },
  button: {
    backgroundColor: 'blue',
    padding: 12,
    borderRadius: 5,
    alignItems: 'center',
    width: '100%',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  });

export default LoginScreen;