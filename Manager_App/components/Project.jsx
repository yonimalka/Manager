import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  I18nManager,
  TouchableOpacity,
  Platform,
  Modal,
  TextInput,
  Alert,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import axios from "axios";
import { SERVER_URL } from "@env";
import { useValue } from "./ValueContext";

const Project = ({ userId, projectName, totalAmount, id }) => {
  const [paidAmount, setPaidAmount] = useState(0);
  const [menuVisible, setMenuVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [paymentInput, setPaymentInput] = useState("");

  const { setValue } = useValue();

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

  const handleConfirmPayment = async () => {
    const amount = Number(paymentInput);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert("סכום לא חוקי");
      return;
    }

    const newPaidAmount = paidAmount + amount;
    setPaidAmount(newPaidAmount);
    setModalVisible(false);
    setMenuVisible(false);

    try {
      const response = await axios.post(
        `${SERVER_URL}/updatePayment/${userId}/${id}`,
        { paidAmount: amount }
      );
      setValue(response.data);
    } catch (error) {
      console.error("Error updating payment:", error);
    }
  };

  const paymentPercentage = (paidAmount / totalAmount) * 100;
  const strokeDasharray = 2 * Math.PI * 40;

  return (
    <View style={styles.card}>
      {/* שלוש נקודות תפריט */}
      <TouchableOpacity
        style={styles.menuButton}
        onPress={() => setMenuVisible(!menuVisible)}
      >
        <MaterialCommunityIcons name="dots-vertical" size={22} color="#555" />
      </TouchableOpacity>

      {menuVisible && (
        <View style={styles.menuContainer}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              setMenuVisible(false);
              setModalVisible(true);
            }}
          >
            <Text style={styles.menuText}>עדכון תשלום</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* עיגול התקדמות */}
      <View style={styles.circleWrapper}>
        <Svg height="80" width="80">
          <Circle cx="40" cy="40" r="35" stroke="#e0e0e0" strokeWidth="8" fill="none" />
          <Circle
            cx="40"
            cy="40"
            r="35"
            stroke={paymentPercentage >= 100 ? "#3b82f6" : "#4caf50"}
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
          <Text style={styles.total}>/ ₪{totalAmount.toLocaleString()}</Text>
          <Text style={styles.paid}>₪{paidAmount.toLocaleString()}</Text>
        </View>
      </View>

      {/* Modal לעדכון תשלום */}
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
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelText}>ביטול</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirmPayment}
                style={styles.confirmButton}
              >
                <Text style={styles.confirmText}>אישור</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    position: "relative",
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
  menuButton: {
    position: "absolute",
    top: 10,
    left: !isRTL ? 10 : undefined,
    right: isRTL ? 10 : undefined,
    padding: 6,
    zIndex: 2,
  },
  menuContainer: {
    position: "absolute",
    top: 40,
    left: !isRTL ? 10 : undefined,
    right: isRTL ? 10 : undefined,
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    zIndex: 3,
  },
  menuItem: {
    paddingVertical: 6,
  },
  menuText: {
    fontSize: 14,
    color: "#333",
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
    textAlign: isRTL ? "left" : "right",
  },
  progressLabel: {
    fontSize: 13,
    color: "#777",
    marginBottom: 6,
    textAlign: isRTL ? "left" : "right",
  },
  completed: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4caf50",
    marginBottom: 6,
    textAlign: isRTL ? "left" : "right",
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: "80%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
    textAlign: "center",
  },
  modalInput: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
    textAlign: "right",
  },
  modalButtons: {
    flexDirection:  isRTL ? "row-reverse" : "row",
    justifyContent: "space-between",
    width: "100%",
  },
  cancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#eee",
    marginRight: 8,
    alignItems: "center",
  },
  cancelText: {
    color: "#333",
    fontWeight: "500",
  },
  confirmButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#3b82f6",
    alignItems: "center",
  },
  confirmText: {
    color: "#fff",
    fontWeight: "600",
  },
});

export default Project;
