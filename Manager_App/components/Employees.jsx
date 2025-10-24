import React, { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert, Keyboard, Dimensions, I18nManager } from "react-native";
import axios from "axios";
import { useNavigation, useRoute } from "@react-navigation/native";
import { SERVER_URL } from "@env";
import { ScrollView } from "react-native-gesture-handler";
import Ionicons from "@expo/vector-icons/Ionicons";
const Employees = () =>{
   const navigation = useNavigation();
    
    return (
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style= {styles.fabButton} onPress={()=> navigation.navigate("AddEmployee")}>
            <Ionicons name="add" size={28} color="#FFF" />
        </TouchableOpacity>
         <View style={styles.card}>
           <Text style={styles.name}>ידידיה אלפי</Text>
           <Text style={styles.wage}>שכר:</Text>
         </View>
        </ScrollView>
        
    )
}

const { width } = Dimensions.get("window");
const isRTL = I18nManager.isRTL;

const styles = StyleSheet.create({
container: {
    paddingTop: 70,
    paddingStart: width * 0.05,
    paddingEnd: width * 0.05,
    paddingBottom: 40,
    backgroundColor: "#F9F9F9",
    flexGrow: 1,
  },
  card: {
    // flexDirection: isRTL ? "row" : "row-reverse",
    alignItems: isRTL ? "flex-start" : "flex-end", 
    padding: 30,
    backgroundColor: "#fff",
    borderRadius: 15,
    // flex: 1
  },
  name: {
    fontSize: 20,
    color: "#333",
    
  },
  wage: {
    fontSize: 15,
    color: "#333",
   marginVertical: 7,
  },
  fabButton: {
    bottom: 0,
    marginTop: 10,
    backgroundColor: "#333",
    borderRadius: 28,
    width: 56,
    height: 56,
    justifyContent: "center", 
    alignItems: "center",
    flexDirection: isRTL ? "row" : "row-reverse",
    alignSelf: isRTL ? "flex-end" : "flex-start"
    },
})

export default Employees;