import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  I18nManager,
  Alert,
} from "react-native";
import axios from "axios";
import { useRoute } from "@react-navigation/native";
import { SERVER_URL } from "@env";
import CashFlowCard from "./CashFlowCard";

const isRTL = I18nManager.isRTL;

export default function CashFlow() {
  const route = useRoute();
  const userId = route.params?.userId;

  const [selectedPeriod, setSelectedPeriod] = useState("חודשי");
  const periods = ["חודשי", "רבעוני", "שנתי"];

  const [loading, setLoading] = useState(false);
  const [incomes, setIncomes] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [totalIncomes, setTotalIncomes] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [prevTotals, setPrevTotals] = useState({ incomes: 0, expenses: 0 });
  const [chartData, setChartData] = useState([]);

  const periodMap = {
    "חודשי": "month",
    "רבעוני": "quarter",
    "שנתי": "year",
    "3 חודשים": "quarter",
    month: "month",
    quarter: "quarter",
    year: "year",
  };

  useEffect(() => {
    if (!userId) {
      console.warn("CashFlow: missing userId, skipping fetch");
      return;
    }
    fetchData(selectedPeriod);
  }, [selectedPeriod, userId]);

  const fetchData = async (periodLabel) => {
    try {
      setLoading(true);
      const periodParam = periodMap[periodLabel] || "month";

      // Incomes
      const incomesResponse = await axios.get(
        `${SERVER_URL}/getCashFlowIncomes/${encodeURIComponent(userId)}?period=${encodeURIComponent(periodParam)}`
      );
      const safeIncomes = Array.isArray(incomesResponse.data) ? incomesResponse.data : [];
      setIncomes(safeIncomes);

      const totalInc = safeIncomes.reduce(
        (sum, i) => sum + (Number(i?.payments?.amount) || 0),
        0
      );
      setPrevTotals((prev) => ({ ...prev, incomes: prev.incomes ?? totalInc }));
      setTotalIncomes(totalInc);

      // Expenses
      const expensesResponse = await axios.get(
        `${SERVER_URL}/getCashFlowExpenses/${encodeURIComponent(userId)}?period=${encodeURIComponent(periodParam)}`
      );
      const safeExpenses = Array.isArray(expensesResponse.data) ? expensesResponse.data : [];
      setExpenses(safeExpenses);

      const totalExp = safeExpenses.reduce(
        (sum, e) => sum + (Number(e?.payments?.sumOfReceipt) || 0),
        0
      );
      setPrevTotals((prev) => ({ ...prev, expenses: prev.expenses ?? totalExp }));
      setTotalExpenses(totalExp);

      // Chart data
      const merged = [];
      safeIncomes.forEach((i) => {
        const ts = i?.payments?.date ? new Date(i.payments.date).getTime() : 0;
        merged.push({ date: ts, value: Number(i?.payments?.amount) || 0, type: "income" });
      });
      safeExpenses.forEach((e) => {
        const ts = e?.payments?.date ? new Date(e.payments.date).getTime() : 0;
        merged.push({ date: ts, value: -(Number(e?.payments?.sumOfReceipt) || 0), type: "expense" });
      });

      merged.sort((a, b) => (a.date || 0) - (b.date || 0));
      setChartData(merged.map((m) => Number(m.value) || 0));
    } catch (err) {
      console.error("Error fetching CashFlow data:", err);
      Alert.alert("שגיאה", "לא ניתן לטעון את תזרים המזומנים כעת.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.headTitle}>תזרים מזומנים</Text>

      <View style={styles.periodSelector}>
        {periods.map((p) => (
          <TouchableOpacity
            key={p}
            onPress={() => setSelectedPeriod(p)}
            style={[styles.periodButton, selectedPeriod === p && styles.periodButtonActive]}
          >
            <Text style={[styles.periodButtonText, selectedPeriod === p && styles.periodButtonTextActive]}>{p}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#137fec" style={{ marginTop: 24 }} />
      ) : (
        <CashFlowCard
          net={(totalIncomes - totalExpenses) || 0}
          percent={prevTotals.incomes ? ((totalIncomes - totalExpenses - (prevTotals.incomes - prevTotals.expenses)) / Math.max(prevTotals.incomes - prevTotals.expenses, 1)) * 100 : 0}
          incomes={totalIncomes}
          expenses={totalExpenses}
          chartPoints={chartData}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#f9f9f9" },
  headTitle: { fontSize: 26, fontWeight: "bold", textAlign: isRTL ? "left" : "right", marginBottom: 16 },
  periodSelector: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16, backgroundColor: "#f0f2f4", borderRadius: 12, padding: 4 },
  periodButton: { flex: 1, marginHorizontal: 4, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  periodButtonActive: { backgroundColor: "#137fec" },
  periodButtonText: { color: "#617589", fontWeight: "700" },
  periodButtonTextActive: { color: "#fff" },
});
