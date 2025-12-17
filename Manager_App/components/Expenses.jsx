import React, { useState, useEffect } from "react";
import { Text, TouchableOpacity, View, StyleSheet, ActivityIndicator } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from "@expo/vector-icons";
import api from "../services/api";

const Expenses = ({ userId, refresh }) => {
  const [totalExpenses, setTotalExpenses] = useState(null);
  const [loading, setLoading] = useState(true);
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

      const uri = `${process.env.SERVER_URL}/downloadAllReceiptsZip`;
      const fileUri = FileSystem.documentDirectory + "הוצאות.zip";

  const { uri: downloadedUri } = await FileSystem.downloadAsync(uri, fileUri, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  await Sharing.shareAsync(downloadedUri);
    } catch (err) {
      console.log("ZIP download error:", err);
    }
  };

  return (
   <View>
      <TouchableOpacity onPress={downloadAllReceiptsZip}>
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
                <Text style={styles.summaryTitleWhite}>הוצאות</Text>
              </View>
              {!loading ? (
                <ActivityIndicator size="small" color="#fff" style={{ marginTop: 12 }} />
              ) : (
                <Text style={styles.summaryAmount}> 
               {totalExpenses ? `${totalExpenses}₪` : "0₪"}
                </Text>
              )}
              <MaterialIcons
                name="shopping-cart"
                size={100}
                color="rgba(255,255,255,0.2)"
                style={styles.bgIcon}
              />
            </LinearGradient>
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
  summaryHeader: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  iconCircle: { backgroundColor: "rgba(255,255,255,0.2)", padding: 6, borderRadius: 50 },
  summaryTitleWhite: { fontSize: 14, fontWeight: "600", color: "#fff" },
  gradientCard: {  borderRadius: 20, padding: 16, marginHorizontal: 6, overflow: "hidden", position: "static", },
  summaryHeader: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  summaryAmount: { fontSize: 20, fontWeight: "700", color: "#fff" },
  bgIcon: { position: "absolute", bottom: -20, right: -20, transform: [{ rotate: "-12deg" }] },
});

