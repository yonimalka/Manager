import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ScrollView,
  I18nManager,
} from "react-native";
import axios from "axios";
import { useNavigation, useRoute } from "@react-navigation/native";
import { SERVER_URL } from "@env";
import Constants from 'expo-constants';

// const SERVER_URL = Constants.expoConfig.extra.SERVER_URL;

const CashFlow = () => {
  
  const navigation = useNavigation();
  const route = useRoute();
  const userId = route.params?.userId;

  const [expenses, setExpenses] = useState([]);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [incomesData, setIncomesData] = useState([]);
  const [totalIncomes, setTotalIncomes] = useState(0);
  const [thisMonth, setThisMonth] = useState(null);

  const monthNames = [
 "ינואר",    // January
  "פברואר",   // February
  "מרץ",      // March
  "אפריל",    // April
  "מאי",      // May
  "יוני",     // June
  "יולי",     // July
  "אוגוסט",   // August
  "ספטמבר",   // September
  "אוקטובר",  // October
  "נובמבר",   // November
  "דצמבר"     // December
];
  useEffect(() => {
    fetchData();
    const now = new Date();
    setThisMonth(monthNames[now.getMonth()]);
  }, []);

  const fetchData = async () => {
    const incomesResponse = await axios.get(`${SERVER_URL}/getCashFlowIncomes/${userId}`);
    setIncomesData(incomesResponse.data);
    setTotalIncomes(incomesResponse.data.reduce((sum, item) => sum + item.payments.amount, 0));

    const expensesResponse = await axios.get(`${SERVER_URL}/getCashFlowExpenses/${userId}`);
    setExpenses(expensesResponse.data);
    setTotalExpenses(expensesResponse.data.reduce((sum, item) => sum + item.payments.sumOfReceipt, 0));
  };

  const renderIncomeCard = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <Text style={styles.label}>סעיף:</Text>
        <Text style={styles.value}>{item.projectName}</Text>
      </View>
      <View style={styles.cardRow}>
        <Text style={styles.label}>סכום:</Text>
        <Text style={[styles.value, styles.amount]}>{item.payments.amount}₪ </Text>
      </View>
      <View style={styles.cardRow}>
        <Text style={styles.label}>סוג פעולה:</Text>
        <Text style={styles.value}>מזומן נכנס</Text>
      </View>
    </View>
  );

  const renderExpenseCard = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <Text style={styles.label}>סוג פעולה:</Text>
        <Text style={styles.value}>מזומן יוצא</Text>
      </View>
      <View style={styles.cardRow}>
        <Text style={styles.label}>סכום:</Text>
        <Text style={[styles.value, styles.amount]}>{item.payments.sumOfReceipt}₪ </Text>
      </View>
      <View style={styles.cardRow}>
        <Text style={styles.label}>סעיף:</Text>
        <Text style={styles.value}>
          {item.payments.filename}, {item.projectName}
        </Text>
      </View>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.headTitle}>תזרים מזומנים</Text>
      <Text style={styles.monthTitle}> חודש {thisMonth}</Text>
      <View style={styles.kpiContainer}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiTitle}>סה"כ הכנסות</Text>
          <Text style={styles.kpiValue}>₪ {totalIncomes}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiTitle}>סה"כ הוצאות</Text>
          <Text style={styles.kpiValue}>₪ {totalExpenses}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>הכנסות</Text>
        <FlatList
          data={incomesData}
          scrollEnabled={false}
          keyExtractor={(item, index) => index.toString()}
          renderItem={renderIncomeCard}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>הוצאות</Text>
        <FlatList
          data={expenses}
          scrollEnabled={false}
          keyExtractor={(item, index) => index.toString()}
          renderItem={renderExpenseCard}
        />
      </View>
    </ScrollView>
  );
};

const isRTL = I18nManager.isRTL;

const styles = StyleSheet.create({
  container: {
    paddingTop: 70,
    padding: 16,
    backgroundColor: "#f9f9f9",
  },
  headTitle: {
    fontSize: 26,
    fontWeight: "bold",
    textAlign: isRTL ? "right" : "left",
    marginBottom: 20,
  },
  monthTitle: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: isRTL ? "right" : "left",
    marginBottom: 20,
  },
  kpiContainer: {
    flexDirection: isRTL ? "row-reverse" : "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: "#e6f7f7",
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 5,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 3,
  },
  kpiTitle: {
    fontSize: 16,
    color: "#333",
    textAlign: "center",
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#00796b",
    textAlign: "center",
    marginTop: 4,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: isRTL ? "right" : "left",
    marginBottom: 10,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 2,
  },
  cardRow: {
    flexDirection: isRTL ? "row-reverse" : "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  label: {
    fontWeight: "bold",
    fontSize: 14,
    color: "#333",
    textAlign: isRTL ? "right" : "left",
  },
  value: {
    fontSize: 14,
    color: "#555",
    flexShrink: 1,
    textAlign: isRTL ? "right" : "left",
  },
  amount: {
    color: "#00796b",
    fontWeight: "bold",
  },
});

export default CashFlow;
