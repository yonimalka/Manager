import React, { useState, useEffect } from "react";
import { Text, TouchableOpacity, View, StyleSheet, ActivityIndicator } from "react-native";
import { useRoute, useNavigation, useIsFocused } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from "@expo/vector-icons";
import {SERVER_URL} from "@env";
import api from "../services/api";


const Expenses = ({ userId, refresh }) => {
  const navigation = useNavigation();

  const [totalExpenses, setTotalExpenses] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetchExpenses();
  }, [refresh, totalExpenses]);

  const fetchExpenses = async () => {
    try {
      const response = await api.get(`/getTotalExpenses`);
      // console.log("dss",response.data);
      setTotalExpenses(response.data.totalExpenses);
    } catch (err) {
      console.error("Error fetching expenses: ", err);
    }
  };

  return (
   <View style={styles.financeCard}>
        <LinearGradient
              colors={["#f87171", "#ef4444"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gradientCard}
            >
              <View style={styles.summaryHeader}>
                <View style={styles.iconCircle}>
                  <MaterialIcons name="trending-down" size={24} color="#fff" />
                </View>
                <Text style={styles.summaryTitleWhite}>Expenses</Text>
              </View>
              {!loading ? (
                <ActivityIndicator size="small" color="#fff" style={{ marginTop: 12 }} />
              ) : (
                <Text style={styles.summaryAmount}> 
               {totalExpenses ? `${totalExpenses}£` : "0£"}
                </Text>
              )}
              <MaterialIcons
                name="shopping-cart"
                size={100}
                color="rgba(255,255,255,0.2)"
                style={styles.bgIcon}
              />
            </LinearGradient>
    </View>
  );
};

export default Expenses;

const styles = StyleSheet.create({
  financeCard: {
    flex: 1,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  gradientCard: {  
    padding: 20,
    minHeight: 150,
  },
  expensesText: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 10,
    color: "white",
  },
  buttonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 14,
  },
  summaryHeader: { 
    flexDirection: "row", 
    alignItems: "center", 
    gap: 8 
  },
  iconCircle: { 
     width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  summaryTitleWhite: { 
    fontSize: 18, 
    fontWeight: "600", 
    color: "#fff",
    marginBottom: 12,
  },
  summaryHeader: { 
    flexDirection: "row", 
    alignItems: "center", 
    gap: 8 
  },
  summaryAmount: { 
    fontSize: 20, 
    fontWeight: "700", 
    color: "#fff", 
    alignSelf: "flex-end" 
  },
  bgIcon: { 
    position: "absolute", 
    bottom: -20, 
    left: -20, 
    transform: [{ rotate: "-12deg" }] 
  },
});

// financeCard: {
//     flex: 1,
//     borderRadius: 20,
//     overflow: "hidden",
//     shadowColor: "#000",
//     shadowOpacity: 0.1,
//     shadowRadius: 12,
//     shadowOffset: { width: 0, height: 4 },
//     elevation: 6,
//   },
//   financeCardGradient: {
//     padding: 20,
//     minHeight: 140,
//   },
//   financeIconContainer: {
//     width: 40,
//     height: 40,
//     borderRadius: 20,
//     backgroundColor: "rgba(255, 255, 255, 0.2)",
//     alignItems: "center",
//     justifyContent: "center",
//     marginBottom: 12,
//   },