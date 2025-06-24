import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import axios from "axios";
import { SERVER_URL } from "@env";
import MaterialsInputModal from "./MaterialsInputModal";
import TaskInputModal from "./TasksInputModal";
import { Ionicons } from "@expo/vector-icons";


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
      await setUserDetails(response.data);
      console.log("response:", response.data);
      console.log("user Details:", userDetails);
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
       <View style={StyleSheet.container}>
        <Text style={styles.headTitle}>איזור אישי</Text>
        <Text style={styles.card}>Name: {userDetails ? userDetails.name : null}</Text> 
        <Text style={styles.card}>Surname: {userDetails ? userDetails.surname : null}</Text>
        <Text style={styles.card}>Email: {userDetails ? userDetails.email : null}</Text>
        <TouchableOpacity
         style={styles.actionButton}
         onPress={handleDelete}
         ><Text>Delete Profile</Text></TouchableOpacity>
       </View>
    )
}

const styles = StyleSheet.create({
    container: {
      marginTop: 60,
      padding: 16,
      backgroundColor: "#f9f9f9",
    },
    headTitle: {
    fontSize: 26,
    fontWeight: "bold",
    textAlign: "right",
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
    backgroundColor: "#ffffff",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 2,
  },
})
export default ProfileDetails;