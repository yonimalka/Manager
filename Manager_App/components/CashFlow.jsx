import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  I18nManager,
  ActivityIndicator,
} from "react-native";
import axios from "axios";
import { useRoute } from "@react-navigation/native";
import { SERVER_URL } from "@env";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from "@expo/vector-icons";
// import { LineChart, Grid } from "react-native-svg-charts";
import { LineChart } from "react-native-chart-kit";

const isRTL = I18nManager.isRTL;

const CashFlow = () => {
  const route = useRoute();
  const userId = route.params?.userId;

  const [selectedPeriod, setSelectedPeriod] = useState("חודשי");
  const [periods] = useState(["חודשי", "3 חודשים", "שנתי"]);

  const [loading, setLoading] = useState(false);
  const [incomes, setIncomes] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [totalIncomes, setTotalIncomes] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [prevTotals, setPrevTotals] = useState({ incomes: 0, expenses: 0 });

  // גרף
  const [chartData, setChartData] = useState([]);

  const monthNames = [
    "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
    "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"
  ];
  const [thisMonth, setThisMonth] = useState("");

  useEffect(() => {
    const now = new Date();
    setThisMonth(monthNames[now.getMonth()]);
    fetchData(selectedPeriod);
  }, [selectedPeriod]);

  const fetchData = async (period) => {
    try {
      setLoading(true);
      // Incomes
      const incomesResponse = await axios.get(
        `${SERVER_URL}/getCashFlowIncomes/${userId}?period=${period}`
      );
      
const incomesData = incomesResponse.data;

// Ensure we always work with an array
const safeIncomes = Array.isArray(incomesData) ? incomesData : [];

setIncomes(safeIncomes);

// Safely calculate total incomes
const totalInc = safeIncomes.reduce((sum, i) => {
  // make sure payments exists and has amount
  const amount = i?.payments?.amount ?? 0;
  return sum + amount;
}, 0);

setPrevTotals((prev) => ({ ...prev, incomes: totalInc }));
setTotalIncomes(totalInc);

      // Expenses
      const expensesResponse = await axios.get(
        `${SERVER_URL}/getCashFlowExpenses/${userId}?period=${period}`
      );
      const expensesData = expensesResponse.data;
      const safeExpenses = Array.isArray(expensesData) ? expensesData : [];
      setExpenses(safeExpenses);

      const totalExp = safeExpenses.reduce((sum, e) => {
        const amount = e?.payments?.sumOfReceipt ?? 0;
      return sum + amount;
     }, 0);
    
      setPrevTotals((prev) => ({ ...prev, expenses: totalExp }));
      setTotalExpenses(totalExp);

      // גרף – ממזג הכנסות והוצאות לפי תאריך
      const merged = [];
      incomesData.forEach((i) => merged.push({ date: i.payments.date.day, value: i.payments.amount, type: "income" }));
      expensesData.forEach((e) => merged.push({ date: e.payments.date.day, value: -e.payments.sumOfReceipt, type: "expense" }));
      merged.sort((a, b) => a.date - b.date);
      setChartData(merged.map((m) => m.value));
    } catch (err) {
      console.error("Error fetching CashFlow data:", err);
    } finally {
      setLoading(false);
    }
  };

  const renderIncomeCard = ({ item }) => (
    <View style={[styles.card, { borderLeftColor: "#10b981", borderLeftWidth: 4 }]}>
      <View style={styles.cardRow}>
        <Text style={styles.label}>סעיף:</Text>
        <Text style={styles.value}>{item.projectName}</Text>
      </View>
      <View style={styles.cardRow}>
        <Text style={styles.label}>סכום:</Text>
        <Text style={[styles.value, styles.amount, { color: "#10b981" }]}>{item.payments.amount}₪</Text>
      </View>
    </View>
  );

  const renderExpenseCard = ({ item }) => (
    <View style={[styles.card, { borderLeftColor: "#ef4444", borderLeftWidth: 4 }]}>
      <View style={styles.cardRow}>
        <Text style={styles.label}>סעיף:</Text>
        <Text style={styles.value}>{item.projectName}</Text>
      </View>
      <View style={styles.cardRow}>
        <Text style={styles.label}>סכום:</Text>
        <Text style={[styles.value, styles.amount, { color: "#ef4444" }]}>{item.payments.sumOfReceipt}₪</Text>
      </View>
    </View>
  );

  const percentChange = (current, prev) => prev ? Math.round(((current - prev) / prev) * 100) : 0;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.headTitle}>תזרים מזומנים</Text>
      <View style={styles.periodSelector}>
        {periods.map((p) => (
          <TouchableOpacity
            key={p}
            onPress={() => setSelectedPeriod(p)}
            style={[
              styles.periodButton,
              selectedPeriod === p && styles.periodButtonActive,
            ]}
          >
            <Text style={[
              styles.periodButtonText,
              selectedPeriod === p && styles.periodButtonTextActive,
            ]}>
              {p}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* KPI Cards */}
      <View style={styles.kpiContainer}>
        <LinearGradient colors={["#4ade80", "#10b981"]} style={styles.kpiCard}>
          <Text style={styles.kpiTitle}>סה"כ הכנסות</Text>
          <Text style={styles.kpiValue}>{totalIncomes}₪</Text>
          <Text style={[styles.percentChange, { color: percentChange(totalIncomes, prevTotals.incomes) >= 0 ? "#10b981" : "#ef4444" }]}>
            {percentChange(totalIncomes, prevTotals.incomes)}%
          </Text>
        </LinearGradient>

        <LinearGradient colors={["#f87171", "#ef4444"]} style={styles.kpiCard}>
          <Text style={styles.kpiTitle}>סה"כ הוצאות</Text>
          <Text style={styles.kpiValue}>{totalExpenses}₪</Text>
          <Text style={[styles.percentChange, { color: percentChange(totalExpenses, prevTotals.expenses) >= 0 ? "#ef4444" : "#10b981" }]}>
            {percentChange(totalExpenses, prevTotals.expenses)}%
          </Text>
        </LinearGradient>
      </View>

      {/* גרף */}
      <View style={{ height: 150, marginVertical: 20 }}>
        {chartData.length > 0 ? (
          <LineChart
            style={{ flex: 1 }}
            data={chartData}
            svg={{ stroke: "#3b49df", strokeWidth: 2 }}
            contentInset={{ top: 10, bottom: 10 }}
          >
            <Grid />
          </LineChart>
        ) : (
          <Text style={{ textAlign: "center" }}>אין נתונים להצגה</Text>
        )}
      </View>

      {/* הכנסות */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>הכנסות</Text>
        {loading ? <ActivityIndicator size="large" color="#10b981" /> : (
          <FlatList
            data={incomes}
            scrollEnabled={false}
            keyExtractor={(item, index) => index.toString()}
            renderItem={renderIncomeCard}
          />
        )}
      </View>

      {/* הוצאות */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>הוצאות</Text>
        {loading ? <ActivityIndicator size="large" color="#ef4444" /> : (
          <FlatList
            data={expenses}
            scrollEnabled={false}
            keyExtractor={(item, index) => index.toString()}
            renderItem={renderExpenseCard}
          />
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { paddingTop: 70, paddingStart: 16, paddingEnd: 16, paddingBottom: 90 , backgroundColor: "#f9f9f9" },
  headTitle: { fontSize: 26, fontWeight: "bold", textAlign: isRTL ? "left" : "right", marginBottom: 25 },
  periodSelector: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  periodButton: { flex: 1, marginHorizontal: 4, paddingVertical: 8, borderRadius: 12, backgroundColor: "#f0f2f4", alignItems: "center" },
  periodButtonActive: { backgroundColor: "#3b49df", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  periodButtonText: { color: "#617589", fontWeight: "700" },
  periodButtonTextActive: { color: "#fff" },
  kpiContainer: { flexDirection: isRTL ? "row" : "row-reverse", justifyContent: "space-between", marginBottom: 20 },
  kpiCard: { flex: 1, borderRadius: 16, padding: 16, marginHorizontal: 5, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  kpiTitle: { fontSize: 14, color: "#fff", fontWeight: "600" },
  kpiValue: { fontSize: 22, fontWeight: "bold", color: "#fff", marginTop: 4 },
  percentChange: { fontSize: 14, fontWeight: "700", marginTop: 2 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: "bold", textAlign: isRTL ? "left" : "right", marginBottom: 8 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 12, marginVertical: 6, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  cardRow: { flexDirection: isRTL ? "row" : "row-reverse", justifyContent: "space-between", marginBottom: 4 },
  label: { fontWeight: "bold", fontSize: 14, color: "#333" },
  value: { fontSize: 14, color: "#555", flexShrink: 1 },
  amount: { fontWeight: "bold" },
});

export default CashFlow;
