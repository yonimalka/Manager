import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import axios from "axios";
import { SERVER_URL } from "@env";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const Expenses = ({ userId, refresh }) => {
  const [totalExpenses, setTotalExpenses] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchExpenses();
  }, [refresh]);

  const fetchExpenses = async () => {
    try {
      const response = await axios.get(`${SERVER_URL}/getTotalExpenses/${userId}`);
      setTotalExpenses(response.data);
    } catch (err) {
      console.error("Error occurred while fetching total expenses: " + err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="cash-minus" size={24} color="#d32f2f" />
        <Text style={styles.title}>הוצאות</Text>
      </View>
      {loading ? (
        <ActivityIndicator size="large" color="#d32f2f" />
      ) : (
        <Text style={styles.amount}>{totalExpenses ? `₪${totalExpenses}` : "₪0"}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: 170,
    height: 130,
    backgroundColor: "#fff0f0",
    borderRadius: 16,
    padding: 16,
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#d32f2f",
  },
  amount: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#d32f2f",
    textAlign: "right",
  },
});

export default Expenses;

