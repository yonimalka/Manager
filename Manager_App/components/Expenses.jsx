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
      // console.log(response.data);
      setTotalExpenses(response.data.totalExpenses);
    } catch (err) {
      console.error("Error fetching expenses: ", err);
    }
  };

  return (
   <View>
        <LinearGradient
              colors={["#f87171", "#ef4444"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gradientCard}
            >
              <View style={styles.summaryHeader}>
                <View style={styles.iconCircle}>
                  <MaterialIcons name="trending-down" size={22} color="#fff" />
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
  expensesText: {
    fontSize: 22,
    fontWeight: "600",
    marginBottom: 10,
    color: "white",
  },
  // button: {
  //   backgroundColor: "#1e88e5",
  //   paddingVertical: 10,
  //   paddingHorizontal: 16,
  //   borderRadius: 8,
  //   alignSelf: "flex-start",
  // },
  buttonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 14,
  },
  summaryHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconCircle: { backgroundColor: "rgba(255,255,255,0.2)", padding: 6, borderRadius: 50 },
  summaryTitleWhite: { fontSize: 14, fontWeight: "600", color: "#fff" },
  gradientCard: {  borderRadius: 20, padding: 16, marginHorizontal: 6, overflow: "hidden", position: "static", },
  summaryHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  summaryAmount: { fontSize: 20, fontWeight: "700", color: "#fff", alignSelf: "flex-end" },
  bgIcon: { position: "absolute", bottom: -20, left: -20, transform: [{ rotate: "-12deg" }] },
});

