// components/BottomNavBar.js
import React from "react";
import { View, TouchableOpacity, Text, StyleSheet, Platform } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

export default function BottomNavBar({ userId }) {
  const navigation = useNavigation();

  const tabs = [
    { name: "CashFlow", icon: "trending-up-outline", label: "תזרים" },
    { name: "NewProject", icon: "add-circle-outline", label: "חדש" },
    { name: "PriceOffer", icon: "cash-outline", label: "הצעה" },
    { name: "ProfileDetails", icon: "person-outline", label: "פרופיל" },
  ];

  return (
    <View style={styles.navContainer}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.name}
          style={styles.navButton}
          onPress={() => navigation.navigate(tab.name, { userId })}
        >
          <Ionicons name={tab.icon} size={24} color="#00796b" />
          <Text style={styles.navText}>{tab.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  navContainer: {
    height: 80,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: "#ffffff",
    paddingVertical: 7,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowOffset: { width: 0, height: -2 },
        shadowRadius: 5,
      },
      android:{
        elevation: 5,
        shadowColor: "#000",
      }
    }),
  },
  navButton: {
    alignItems: "center",
    justifyContent: "center",
  },
  navText: {
    fontSize: 12,
    color: "#00796b",
    marginTop: 4,
    fontWeight: "500",
  },
});
