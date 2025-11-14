import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  ScrollView,
  StyleSheet,
  I18nManager,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import axios from "axios";
import { SERVER_URL } from "@env";
// import Constants from 'expo-constants';

import MaterialsInputModal from "./MaterialsInputModal";
import TaskInputModal from "./TasksInputModal";
import { Ionicons } from "@expo/vector-icons";

// const SERVER_URL = Constants.expoConfig.extra.SERVER_URL;

const ProfileDetails = () => {
   const navigation = useNavigation();
     const route = useRoute();
     const userId = route.params?.userId;
    const [userDetails, setUserDetails] = useState([]);

    useEffect(() =>{
     fetchData();
     console.log("user Details:", userDetails);
    }, [])

    const fetchData = async () =>{
      try {
      const response = await axios.get(`${SERVER_URL}/getUserDetails/${userId}`);
      setUserDetails(response.data);
      console.log("response:", response.data);
      
      } catch (error){
        console.error("Error occurred: " + error);
      }
    }
    const handleDelete = async () => {
      navigation.navigate("LoginScreen")
      const res = await axios.delete(`${SERVER_URL}/deleteUser/${userId}`)
      console.log(res.data);
      
    
    }
    
    return (
       <View style={styles.container}>
        <Text style={styles.headTitle}>איזור אישי</Text>
        <Text style={styles.card}>שם פרטי: {userDetails ? userDetails.name : null}</Text> 
        <Text style={styles.card}>שם משפחה: {userDetails ? userDetails.surname : null}</Text>
        <Text style={styles.card}>אימייל: {userDetails ? userDetails.email : null}</Text>
        <TouchableOpacity
         style={styles.actionButton}
         onPress={handleDelete}
         ><Text style={styles.deleteText}>מחק חשבון</Text></TouchableOpacity>
       </View>
    )
}

const isRTL = I18nManager.isRTL;

const styles = StyleSheet.create({
  container: {
    paddingTop: 70,
    paddingBottom: 700,
    padding: 16,
    backgroundColor: "#f9f9f9",
  },
  headTitle: {
    fontSize: 26,
    fontWeight: "bold",
    textAlign: isRTL ? "left" : "right",
    marginBottom: 20,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 2,
  },
  actionButton: {
    backgroundColor: "#fff0f0",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.10,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 2,
  },
  deleteText: {
    color: "#d32f2f",
    textAlign: isRTL ? "right" : "left",
  }
});
export default ProfileDetails;