import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, I18nManager, TouchableOpacity, Platform } from "react-native";
import Svg, { Circle } from "react-native-svg";
import axios from "axios";
import { SERVER_URL } from "@env";

const Project = ({ userId, projectName, totalAmount, id }) => {
  const [paidAmount, setPaidAmount] = useState(0);

  useEffect(() => {
    fetchProjectData();
  }, []);

  const fetchProjectData = async () => {
    try {
      const response = await axios.get(`${SERVER_URL}/getProject/${userId}/${id}`);
      setPaidAmount(response.data.paid);
    } catch (error) {
      console.error("Error fetching project data:", error);
    }
  };

  const paymentPercentage = (paidAmount / totalAmount) * 100;
  const strokeDasharray = 2 * Math.PI * 40; // היקף העיגול

  return (
    <View style={styles.card}>
      {/* עיגול התקדמות */}
      <View style={styles.circleWrapper}>
        <Svg height="80" width="80">
          <Circle
            cx="40"
            cy="40"
            r="35"
            stroke="#e0e0e0"
            strokeWidth="8"
            fill="none"
          />
          <Circle
            cx="40"
            cy="40"
            r="35"
            stroke={paymentPercentage >= 100 ? "#4caf50" : "#3b82f6"}
            strokeWidth="8"
            fill="none"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={
              strokeDasharray - (strokeDasharray * paymentPercentage) / 100
            }
            strokeLinecap="round"
          />
        </Svg>
        <View style={styles.circleOverlay}>
          {paymentPercentage >= 100 ? (
            <Text style={styles.check}>✔</Text>
          ) : (
            <Text style={styles.percent}>{Math.round(paymentPercentage)}%</Text>
          )}
        </View>
      </View>

      {/* טקסטים של פרויקט */}
      <View style={styles.details}>
        <Text style={styles.projectName}>{projectName}</Text>
        {paymentPercentage >= 100 ? (
          <Text style={styles.completed}>הושלם</Text>
        ) : (
          <Text style={styles.progressLabel}>התקדמות</Text>
        )}
        <View style={styles.amountRow}>
          <Text style={styles.paid}>₪{paidAmount.toLocaleString()}</Text>
          <Text style={styles.total}>/ ₪{totalAmount.toLocaleString()}</Text>
        </View>
      </View>
    </View>
  );
};

const isRTL = I18nManager.isRTL;

const styles = StyleSheet.create({
  card: {
    flexDirection: isRTL ? "row" : "row-reverse",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      },
      android: {
        elevation: 4,
        shadowColor: "#000",
      },
    }),
  },
  circleWrapper: {
    width: 80,
    height: 80,
    marginHorizontal: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  circleOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  percent: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  check: {
    fontSize: 28,
    color: "#4caf50",
    fontWeight: "bold",
  },
  details: {
    flex: 1,
  },
  projectName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#222",
    marginBottom: 4,
    textAlign: isRTL ? "right" : "left",
  },
  progressLabel: {
    fontSize: 13,
    color: "#777",
    marginBottom: 6,
    textAlign: isRTL ? "right" : "left",
  },
  completed: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4caf50",
    marginBottom: 6,
    textAlign: isRTL ? "right" : "left",
  },
  amountRow: {
    flexDirection: isRTL ? "row" : "row-reverse",
    alignItems: "center",
  },
  paid: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#4caf50",
    marginRight: 6,
  },
  total: {
    fontSize: 14,
    color: "#777",
  },
});

export default Project;
