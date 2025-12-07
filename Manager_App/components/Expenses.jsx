import React, { useState, useEffect } from "react";
import { Text, TouchableOpacity, View, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import api from "../services/api";

const Expenses = ({ userId, refresh }) => {
  const [totalExpenses, setTotalExpenses] = useState(null);

  useEffect(() => {
    fetchExpenses();
  }, [refresh]);

  const fetchExpenses = async () => {
    try {
      const response = await api.get(`/getTotalExpenses`);
      setTotalExpenses(response.data);
    } catch (err) {
      console.error("Error fetching expenses: ", err);
    }
  };

  // 🔥 ZIP download function
  const downloadAllReceiptsZip = async () => {
    try {
      const token = await AsyncStorage.getItem("token");

      const url = `${process.env.SERVER_URL}/downloadAllReceiptsZip`;
      const fileUri = FileSystem.documentDirectory + "receipts.zip";

      const downloadResumable = FileSystem.createDownloadResumable(
        url,
        fileUri,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const { uri } = await downloadResumable.downloadAsync();

      await Sharing.shareAsync(uri);
    } catch (err) {
      console.log("ZIP download error:", err);
    }
  };

  return (
    <View>
      <Text style={styles.expensesText}>
        {totalExpenses ? `${totalExpenses}₪` : "0₪"}
      </Text>

      {/* 🔘 Download Button */}
      <TouchableOpacity style={styles.button} onPress={downloadAllReceiptsZip}>
        <Text style={styles.buttonText}>📦 הורד את כל הקבלות</Text>
      </TouchableOpacity>
    </View>
  );
};

export default Expenses;

const styles = StyleSheet.create({
  expensesText: {
    fontSize: 22,
    fontWeight: "600",
    marginBottom: 10,
  },
  button: {
    backgroundColor: "#1e88e5",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  buttonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 14,
  },
});

