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
import api from "../services/api";
// import Constants from 'expo-constants';
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "./useAuth";
import MaterialsInputModal from "./MaterialsInputModal";
import TaskInputModal from "./TasksInputModal";
import { Ionicons } from "@expo/vector-icons";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage, auth, signInFirebase } from "./firebase";
// const SERVER_URL = Constants.expoConfig.extra.SERVER_URL;

const ProfileDetails = () => {
   const navigation = useNavigation();
     const route = useRoute();
    //  const userId = route.params?.userId;
    const { userId } = useAuth();
    const [userDetails, setUserDetails] = useState([]);
    const [image, setImage] = useState(null);
    useEffect(() =>{
     fetchData();
    //  console.log("user Details:", userDetails);
    }, [userId])

    const fetchData = async () =>{
      try {
      const response = await api.get(`/getUserDetails/${userId}`);
      setUserDetails(response.data);
      // console.log("response:", response.data);
      
      } catch (error){
        console.error("Error occurred: " + error);
      }
    }
    const pickImage = async (fromCamera = false) => {
      try {
        // Request permission
        const permission = fromCamera
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
    
        if (!permission.granted) {
          Alert.alert(
            "Permission denied",
            "You need to allow access to your camera or gallery."
          );
          return;
        }
    
        const result = fromCamera
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images, 
              quality: 0.7,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.7,
            });
    
        if (!result.canceled) {
          setImage(result.assets[0].uri);
        }
        uploadLogo();
      } catch (err) {
        console.error("ImagePicker error:", err);
        Alert.alert("Error", "Could not open camera/gallery");
      }
    };

    const uploadLogo = async () => {
     try {
         // Sign in if not authenticated
      if (!auth.currentUser) {
        await signInFirebase();
      }

      // Convert image to blob
      const response = await fetch(image);
      const blob = await response.blob();

      // Create unique storage path
      const filePath = `/logos/${userId}/logo.jpg`;
      const fileRef = ref(storage, filePath);

      // Upload with progress
      const uploadTask = uploadBytesResumable(fileRef, blob);
      uploadTask.on(
        "state_changed",
        snapshot => {
          const prog = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setProgress(Math.round(prog));
        },
        error => {
          console.error("Firebase Storage upload error:", error);
          Alert.alert("Upload error", error.message);
          setLoading(false);
        },
        async () => {
          const downloadURL = await getDownloadURL(fileRef);
          // console.log("File uploaded to:", filePath);
          // console.log("Download URL:", downloadURL);

          await api.post("/uploadLogo", {
            imageUrl: downloadURL,
          });

          Alert.alert("Success", "Receipt uploaded successfully!");
          navigation.goBack();
        }
      );
    } catch (err) {
      console.error("Upload exception:", err);
      Alert.alert("Error", "Upload failed: " + (err.message || err.code));
    } finally {
      setLoading(false);
    }
   };
    const handleDelete = async () => {
      navigation.navigate("LoginScreen")
      const res = await api.delete(`/deleteUser/${userId}`)
      console.log(res.data);
      
    
    }
    
    return (
       <View style={styles.container}>
        <Text style={styles.headTitle}>איזור אישי</Text>
        <Text style={styles.card}>שם פרטי: {userDetails ? userDetails.name : null}</Text> 
        <Text style={styles.card}>שם משפחה: {userDetails ? userDetails.surname : null}</Text>
        <Text style={styles.card}>אימייל: {userDetails ? userDetails.email : null}</Text>
        <TouchableOpacity style={styles.card} onPress={() => pickImage(false)}>
                   <Text>הוסף לוגו</Text>
                 </TouchableOpacity>
        <TouchableOpacity
         style={styles.actionButton}
         onPress={handleDelete}
         >
         <Text style={styles.deleteText}>מחק חשבון</Text></TouchableOpacity>
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
    textAlign: isRTL ? "left" : "right",
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