import React, { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert, Keyboard, Dimensions, I18nManager, ActivityIndicator } from "react-native";
import axios from "axios";
import { useNavigation, useRoute } from "@react-navigation/native";
import { SERVER_URL } from "@env";
import { ScrollView } from "react-native-gesture-handler";
import Ionicons from "@expo/vector-icons/Ionicons";
import api from "../services/api";

const isRTL = I18nManager.isRTL;

const Employees = () =>{
    
    const navigation = useNavigation();

    const [employees, setEmployees] = useState();
    const [loading, setLoading] = useState(true);
    const fetchEmployees = async () => {
    try {
      const res = await api.get("/employees");
      setEmployees(res.data);
    } catch (err) {
      console.error("Error fetching employees:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const renderEmployee = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.headerRow}>
      <Ionicons name="person-outline" size={22} color="#007AFF" />
        <Text style={styles.name}>{item.name}</Text>
      </View>
      <Text style={styles.role}>תפקיד: {item.role}</Text>
      <Text style={styles.phone}>{item.phone}</Text>
      <View style={styles.salaryContainer}>
        <Ionicons name="cash-outline" size={18} color="#007AFF" />
        <Text style={styles.salaryText}>
          {item.salaryType === "hourly" ? "שכר לשעה" : "שכר יומי"}: ₪{item.salaryRate}
        </Text>
      </View>

      {item.salaryType === "hourly" && item.totalHoursWorked > 0 && (
        <Text style={styles.infoText}>סה״כ שעות: {item.totalHoursWorked}</Text>
      )}
      {item.salaryType === "daily" && item.totalDaysWorked > 0 && (
        <Text style={styles.infoText}>סה״כ ימים: {item.totalDaysWorked}</Text>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{ marginTop: 10, color: "#555" }}>טוען עובדים...</Text>
      </View>
    );
  }

    return (
    <View style={styles.container}>
      <Text style={styles.title}>עובדים</Text>

      {employees.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>אין עובדים להצגה</Text>
        </View>
      ) : (
        <FlatList
          data={employees}
          keyExtractor={(item) => item._id}
          renderItem={renderEmployee}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate("AddEmployee")}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9F9F9",
    paddingHorizontal: 16,
    paddingTop: 50,
    direction: !isRTL ? "rtl" : "ltr",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#333",
    marginBottom: 20,
    textAlign: isRTL ? "right" : "left",
  },
  listContainer: {
    paddingBottom: 100,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 46,
    paddingHorizontal: 20,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  headerRow: {
    position: "absolute",
    margin: 20,
    flexDirection: !isRTL ? "row" : "row-reverse",
    // justifyContent: "space-between",
    alignItems: "center",
  },
  name: {
    marginRight: 15,
    fontSize: 18,
    fontWeight: "600",
    color: "#222",
  },
  role: {
    fontSize: 15,
    color: "#666",
    marginTop: 8,
    textAlign: isRTL ? "right" : "left",
  },
  phone: {
    fontSize: 15,
    color: "#666",
    marginTop: 18,
    textAlign: isRTL ? "right" : "left",
  },
  salaryContainer: {
    flexDirection: !isRTL ? "row" : "row-reverse",
    alignItems: "center",
    marginTop: 10,
  },
  salaryText: {
    fontSize: 15,
    color: "#007AFF",
    marginStart: 5,
  },
  infoText: {
    fontSize: 14,
    color: "#555",
    marginTop: 6,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9F9F9",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    color: "#777",
  },
  addButton: {
    position: "absolute",
    bottom: 30,
    right: 20,
    backgroundColor: "#007AFF",
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
});

export default Employees;