import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  I18nManager,
  ActivityIndicator,
} from "react-native";
import axios from "axios";
import { useRoute } from "@react-navigation/native";
import { SERVER_URL } from "@env";
import { LinearGradient } from "expo-linear-gradient";
import CashFlowCard from "./CashFlowCard"; // New chart + totals component

const isRTL = I18nManager.isRTL;

const CashFlow = () => {
  const route = useRoute();
  const userId = route.params?.userId;

  const [selectedPeriod, setSelectedPeriod] = useState("חודשי");
  const periods = ["חודשי", "3 חודשים", "שנתי"];

  const [loading, setLoading] = useState(false);
  const [incomes, setIncomes] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [totalIncomes, setTotalIncomes] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    fetchData(selectedPeriod);
  }, [selectedPeriod]);

  const fetchData = async (period) => {
    try {
      setLoading(true);

      // Fetch Incomes
      const incomesResponse = await axios.get(
        `${SERVER_URL}/getCashFlowIncomes/${userId}?period=${period}`
      );
      const safeIncomes = Array.isArray(incomesResponse.data)
        ? incomesResponse.data
        : [];
      setIncomes(safeIncomes);

      const totalInc = safeIncomes.reduce(
        (sum, i) => sum + (i?.payments?.amount ?? 0),
        0
      );
      setTotalIncomes(totalInc);

      // Fetch Expenses
      const expensesResponse = await axios.get(
        `${SERVER_URL}/getCashFlowExpenses/${userId}?period=${period}`
      );
      const safeExpenses = Array.isArray(expensesResponse.data)
        ? expensesResponse.data
        : [];
      setExpenses(safeExpenses);

      const totalExp = safeExpenses.reduce(
        (sum, e) => sum + (e?.payments?.sumOfReceipt ?? 0),
        0
      );
      setTotalExpenses(totalExp);

      // Merge data for chart
      const merged = [];
      safeIncomes.forEach((i) =>
        merged.push({
          date: new Date(i.payments.date).getTime(),
          value: i.payments.amount,
        })
      );
      safeExpenses.forEach((e) =>
        merged.push({
          date: new Date(e.payments.date).getTime(),
          value: -e.payments.sumOfReceipt,
        })
      );

      merged.sort((a, b) => a.date - b.date);
      setChartData(merged.map((m) => m.value));
    } catch (err) {
      console.error("Error fetching CashFlow data:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={{ paddingTop: 70, paddingHorizontal: 16, paddingBottom: 90, backgroundColor: "#f9f9f9" }}
    >
      <Text style={styles.headTitle}>תזרים מזומנים</Text>

      {/* Period Selector */}
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
            <Text
              style={[
                styles.periodButtonText,
                selectedPeriod === p && styles.periodButtonTextActive,
              ]}
            >
              {p}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* CashFlow Card */}
      {loading ? (
        <ActivityIndicator size="large" color="#137fec" />
      ) : (
        <CashFlowCard
          net={totalIncomes - totalExpenses}
          percent={12} // you can calculate real % change
          incomes={totalIncomes}
          expenses={totalExpenses}
          chartPoints={chartData}
        />
      )}

      {/* Optional: List of Incomes */}
      {/* Optional: List of Expenses */}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  headTitle: { fontSize: 26, fontWeight: "bold", textAlign: isRTL ? "left" : "right", marginBottom: 25 },
  periodSelector: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  periodButton: { flex: 1, marginHorizontal: 4, paddingVertical: 8, borderRadius: 12, backgroundColor: "#f0f2f4", alignItems: "center" },
  periodButtonActive: { backgroundColor: "#137fec", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  periodButtonText: { color: "#617589", fontWeight: "700" },
  periodButtonTextActive: { color: "#fff" },
});

export default CashFlow;
