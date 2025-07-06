import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Alert,
  TouchableOpacity,
  StyleSheet,
  I18nManager,
} from "react-native";
import axios from "axios";
import Svg, { Circle } from "react-native-svg";
import { SERVER_URL } from "@env";
import Constants from 'expo-constants';
import { useValue } from "./ValueContext";

// const SERVER_URL = Constants.expoConfig.extra.SERVER_URL;

const Project = ({ userId, projectName, totalAmount, totalDays, id }) => {
  const { setValue } = useValue();

  const [paidAmount, setPaidAmount] = useState(0);
  const [daysPassed, setDaysPassed] = useState(0);

  useEffect(() => {
    fetchProjectData();
    const intervalId = startDayCounter();
    return () => clearInterval(intervalId);
  }, []);

  const fetchProjectData = async () => {
    try {
      const response = await axios.get(`${SERVER_URL}/getProject/${userId}/${id}`);
      setPaidAmount(response.data.paid);
      setDaysPassed(response.data.daysPassed || 0);
    } catch (error) {
      console.error("Error fetching project data:", error);
    }
  };

  const startDayCounter = () => {
    const now = new Date();
    const checkTime = () => {
      if (now.getHours() === 16) {
        setDaysPassed((prev) => prev + 1);
        axios.post(`${SERVER_URL}/updateDays/${id}`, { daysPassed: daysPassed + 1 });
      }
    };
    return setInterval(checkTime, 3600000);
  };

  const handlePaymentUpdate = () => {
    Alert.prompt(
      "עדכון תשלום",
      "כמה ברצונך להוסיף?",
      [
        { text: "ביטול", style: "cancel" },
        {
          text: "אישור",
          onPress: async (payment) => {
            const amount = Number(payment);
            if (isNaN(amount) || amount <= 0) {
              Alert.alert("סכום לא חוקי");
              return;
            }
            const newPaidAmount = paidAmount + amount;
            setPaidAmount(newPaidAmount);
            try {
              const response = await axios.post(`${SERVER_URL}/updatePayment/${userId}/${id}`, {
                paidAmount: amount,
              });
              setValue(response.data);
            } catch (error) {
              console.error("Error updating payment:", error);
            }
          },
        },
      ],
      "plain-text"
    );
  };

  const paymentPercentage = (paidAmount / totalAmount) * 100;
  const daysPercentage = (daysPassed / totalDays) * 100;

  return (
    <View style={styles.card}>
      <Text style={styles.projectName}>{projectName}</Text>
      <View style={styles.progressRow}>
        {/* Payment Circle */}
        <TouchableOpacity onPress={handlePaymentUpdate} style={styles.circleWrapper}>
          <Svg height="100" width="100">
            <Circle cx="50" cy="50" r="45" stroke="#e0e0e0" strokeWidth="10" fill="none" />
            <Circle
              cx="50"
              cy="50"
              r="45"
              stroke="#4caf50"
              strokeWidth="10"
              fill="none"
              strokeDasharray="282"
              strokeDashoffset={282 - (282 * paymentPercentage) / 100}
            />
          </Svg>
          <View style={styles.overlay}>
            <Text style={styles.amountText}>₪{paidAmount} / ₪{totalAmount}</Text>
            <Text style={styles.labelText}>
              {paidAmount >= totalAmount ? "שולם ✅" : "תשלום"}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Days Circle */}
        <View style={styles.circleWrapper}>
          <Svg height="100" width="100">
            <Circle cx="50" cy="50" r="45" stroke="#e0e0e0" strokeWidth="10" fill="none" />
            <Circle
              cx="50"
              cy="50"
              r="45"
              stroke="#2196f3"
              strokeWidth="10"
              fill="none"
              strokeDasharray="282"
              strokeDashoffset={282 - (282 * daysPercentage) / 100}
            />
          </Svg>
          <View style={styles.overlay}>
            <Text style={styles.amountText}>{daysPassed} / {totalDays}</Text>
            <Text style={styles.labelText}>ימים</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const isRTL = I18nManager.isRTL;

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    alignItems: "center",
  },
  projectName: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 16,
    color: "#333",
    textAlign: "center", // Keep center text alignment as is
  },
  progressRow: {
    flexDirection: isRTL ? "row" : "row-reverse",
    justifyContent: "space-around",
    width: "100%",
    gap: 10,
    position: "relative",
  },
  circleWrapper: {
    alignItems: "center",
    // position: "relative",
  },
  
  overlay: {
  ...StyleSheet.absoluteFillObject,
  justifyContent: "center",
  alignItems: "center",
  },
  
  amountText: {
    fontWeight: "bold",
    fontSize: 14,
    color: "#333",
  },
  labelText: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
});

export default Project;
