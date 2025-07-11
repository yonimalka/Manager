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
  const [modalVisible, setModalVisible] = useState(false);
  const [paymentInput, setPaymentInput] = useState("");
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
  setPaymentInput("");
  setModalVisible(true);
};

const handleConfirmPayment = async () => {
  const amount = Number(paymentInput);
  if (isNaN(amount) || amount <= 0) {
    Alert.alert("סכום לא חוקי");
    return;
  }

  const newPaidAmount = paidAmount + amount;
  setPaidAmount(newPaidAmount);
  setModalVisible(false);

  try {
    const response = await axios.post(`${SERVER_URL}/updatePayment/${userId}/${id}`, {
      paidAmount: amount,
    });
    setValue(response.data);
  } catch (error) {
    console.error("Error updating payment:", error);
  }
};


  const paymentPercentage = (paidAmount / totalAmount) * 100;
  const daysPercentage = (daysPassed / totalDays) * 100;

  return (
 <View >
    <Modal visible={modalVisible} transparent animationType="fade">
     <View style={styles.modalOverlay}>
      <View style={styles.modalContainer}>
      <Text style={styles.modalTitle}>כמה ברצונך להוסיף?</Text>
      <TextInput
        style={styles.modalInput}
        keyboardType="numeric"
        value={paymentInput}
        onChangeText={setPaymentInput}
        placeholder="סכום"
        textAlign="right"
      />
      <View style={styles.modalButtons}>
        <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.cancelButton}>
          <Text style={styles.cancelText}>ביטול</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleConfirmPayment} style={styles.confirmButton}>
          <Text style={styles.confirmText}>אישור</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
</Modal>

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
    // shadowOffset: { width: 0, height: 2 },
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
    textAlign: "center",
  },
  labelText: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
    textAlign: "center",
  },
  modalOverlay: {
  flex: 1,
  backgroundColor: "rgba(0,0,0,0.5)",
  justifyContent: "center",
  alignItems: "center",
},
modalContainer: {
  backgroundColor: "#fff",
  borderRadius: 16,
  padding: 20,
  width: "80%",
  elevation: 5,
},
modalTitle: {
  fontSize: 18,
  fontWeight: "bold",
  marginBottom: 12,
  textAlign: "right",
},
modalInput: {
  borderWidth: 1,
  borderColor: "#ccc",
  borderRadius: 8,
  padding: 10,
  marginBottom: 16,
  textAlign: "right",
},
modalButtons: {
  flexDirection: "row",
  justifyContent: "space-between",
},
cancelButton: {
  backgroundColor: "#e0e0e0",
  paddingVertical: 10,
  paddingHorizontal: 15,
  borderRadius: 8,
  flex: 1,
  marginEnd: 5,
},
confirmButton: {
  backgroundColor: "#4caf50",
  paddingVertical: 10,
  paddingHorizontal: 15,
  borderRadius: 8,
  flex: 1,
  marginStart: 5,
},
cancelText: {
  textAlign: "center",
  color: "#000",
},
confirmText: {
  textAlign: "center",
  color: "#fff",
},
});

export default Project;
