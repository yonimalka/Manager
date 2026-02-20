import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import axios from "axios";
import { SERVER_URL } from "@env";
import { useValue } from "./ValueContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from "@expo/vector-icons";
import api from "../services/api";

const Incomes = (refresh) => {
  const { value } = useValue();
  const [totalIncomes, setTotalIncomes] = useState(null);
  const [loading, setLoading] = useState(false);
  const [shouldRefresh, setShouldRefresh] = useState(false);

  const fetchIncomes = async () => {
    
    try {
      const token = await AsyncStorage.getItem("token");
      
      if (!token) {
            console.log("No token found on incomes");
            // Alert.alert("No token found, redirect to login")
            // navigation.reset({ index: 0, routes: [{ name: "Login" }] });
            return;
          }
      const response = await api.get(`/getTotalIncomes`);
       
      
      setTotalIncomes(response.data);
      setShouldRefresh(!refresh)
    } catch (err) {
      console.error("Error fetching incomes: ", err);
    }
  };

  useEffect(() => {
    fetchIncomes();
  }, [refresh, totalIncomes]);

  // מחזיר רק את הערך, בלי עיצוב
  return (
  <View style={styles.financeCard}>
 <LinearGradient
              colors={["#4ade80", "#10b981"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gradientCard}
            >
              <View style={styles.summaryHeader}>
                <View style={styles.iconCircle}>
                  <MaterialIcons name="trending-up" size={24} color="#fff" />
                </View>
                <Text style={styles.summaryTitleWhite}>Incomes</Text>
              </View>
              {loading ? (
                <ActivityIndicator size="small" color="#fff" style={{ marginTop: 12 }} />
              ) : (
                <Text style={styles.summaryAmount}>
                {value ? `${value}£` : totalIncomes ? `${totalIncomes}$` : "0$"}
                </Text>
              )}
              <MaterialIcons
                name="account-balance-wallet"
                size={100}
                color="rgba(255,255,255,0.2)"
                style={styles.bgIcon}
              />
            </LinearGradient>
  </View>
 )};

export default Incomes;

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
    marginBottom: 10,
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
})