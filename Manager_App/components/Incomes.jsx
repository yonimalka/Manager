import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import axios from "axios";
import { SERVER_URL } from "@env";
import { useValue } from "./ValueContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";

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
    marginRight: 10,
  },
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1976d2",
  },
  amount: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1976d2",
    textAlign: "right",
  },
});

export default Incomes;
