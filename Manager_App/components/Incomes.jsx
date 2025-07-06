import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet, I18nManager, } from "react-native";
import axios from "axios";
import { SERVER_URL } from "@env";
import Constants from 'expo-constants'; 
import { useValue } from "./ValueContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";

// const SERVER_URL = Constants.expoConfig.extra.SERVER_URL;

const Incomes = ({ userId }) => {
  
  const { value } = useValue();
  const [totalIncomes, setTotalIncomes] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchIncomes();
  }, [value]);

  const fetchIncomes = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${SERVER_URL}/getTotalIncomes/${userId}`);
      setTotalIncomes(response.data);
    } catch (err) {
      console.error("Error fetching incomes: ", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="cash-plus" size={24} color="#1976d2" />
        <Text style={styles.title}>הכנסות</Text>
      </View>
      {loading ? (
        <ActivityIndicator size="large" color="#1976d2" />
      ) : (
        <Text style={styles.amount}>
          {value ? `₪${value}` : totalIncomes ? `₪${totalIncomes}` : "₪0"}
        </Text>
      )}
    </View>
  );
};

const isRTL = I18nManager.isRTL;

const styles = StyleSheet.create({
  card: {
    width: 170,
    height: 130,
    backgroundColor: "#e6f0fa",
    borderRadius: 16,
    padding: 16,
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    // Use marginLeft if RTL, marginRight if LTR for proper spacing
    marginRight: isRTL ? 0 : 10,
    marginLeft: isRTL ? 10 : 0,
  },
  header: {
    flexDirection: isRTL ? "row" : "row-reverse", // flip direction for RTL
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1976d2",
    textAlign: isRTL ? "left" : "right",  // flip textAlign to keep it visually consistent
  },
  amount: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1976d2",
    textAlign: isRTL ? "right" : "left",
  },
});

export default Incomes;
