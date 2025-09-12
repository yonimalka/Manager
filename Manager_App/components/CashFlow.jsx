import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  I18nManager,
} from "react-native";
import axios from "axios";
import { useRoute } from "@react-navigation/native";
import { SERVER_URL } from "@env";
import CashFlowCard from "./CashFlowCard"; // New component

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

  useEffect(() => {
    fetchData(selectedPeriod);
  }, [selectedPeriod]);

  const fetchData = async (period) => {
    try {
      setLoading(true);
      // Fetch incomes
      const incomesResponse = await axios.get(
        `${SERVER_URL}/getCashFlowIncomes/${userId}?period=${period}`
      );
      const safeIncomes = Array.isArray(incomesResponse.data) ? incomesResponse.data : [];
      setIncomes(safeIncomes);
      const totalInc = safeIncomes.reduce((sum, i) => sum + (i?.payments?.amount ?? 0), 0);
      setTotalIncomes(totalInc);
      setPrevTotals((prev) => ({ ...prev, incomes: totalInc }));

      // Fetch expenses
      const expensesResponse = await axios.get(
        `${SERVER_URL}/getCashFlowExpenses/${userId}?period=${period}`
      );
      const safeExpenses = Array.isArray(expensesResponse.data) ? expensesResponse.data : [];
      setExpenses(safeExpenses);
      const totalExp = safeExpenses.reduce((sum, e) => sum + (e?.payments?.sumOfReceipt ?? 0), 0);
      setTotalExpenses(totalExp);
      setPrevTotals((prev) => ({ ...prev, expenses: totalExp }));

    } catch (err) {
      console.error("Error fetching CashFlow data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Show only first 5 items
  const renderLimitedList = (data, type) => {
    const listToShow = data.slice(0, 5);
    return (
      <View>
        <FlatList
          data={listToShow}
          keyExtractor={(item, index) => index.toString()}
          renderItem={({ item }) => (
            <View style={[styles.card, type === "income" ? styles.incomeCard : styles.expenseCard]}>
              <Text style={styles.cardTitle}>{item.projectName}</Text>
              <Text style={styles.cardAmount}>
                {type === "income" ? item.payments.amount : item.payments.sumOfReceipt}₪
              </Text>
            </View>
          )}
        />
        {data.length > 5 && (
          <TouchableOpacity style={styles.showMoreBtn}>
            <Text style={styles.showMoreText}>הצג הכל</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>תזרים מזומנים</Text>

      {/* Period selector */}
      <View style={styles.periodSelector}>
        {periods.map((p) => (
          <TouchableOpacity
            key={p}
            style={[
              styles.periodButton,
              selectedPeriod === p && styles.periodButtonActive,
            ]}
            onPress={() => setSelectedPeriod(p)}
          >
            <Text style={[
              styles.periodButtonText,
              selectedPeriod === p && styles.periodButtonTextActive
            ]}>{p}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#3b49df" />
      ) : (
        <>
          {/* CashFlow Card */}
          <CashFlowCard
            totalIncomes={totalIncomes}
            totalExpenses={totalExpenses}
            prevTotals={prevTotals}
            incomes={incomes}
            expenses={expenses}
            selectedPeriod={selectedPeriod}
          />

          {/* Incomes List */}
          <Text style={styles.sectionTitle}>הכנסות</Text>
          {renderLimitedList(incomes, "income")}

          {/* Expenses List */}
          <Text style={styles.sectionTitle}>הוצאות</Text>
          {renderLimitedList(expenses, "expense")}
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 90, backgroundColor: "#f9f9f9" },
  title: { fontSize: 26, fontWeight: "bold", textAlign: isRTL ? "left" : "right", marginBottom: 16 },
  periodSelector: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  periodButton: { flex: 1, marginHorizontal: 4, paddingVertical: 8, borderRadius: 12, backgroundColor: "#f0f2f4", alignItems: "center" },
  periodButtonActive: { backgroundColor: "#3b49df" },
  periodButtonText: { color: "#617589", fontWeight: "700" },
  periodButtonTextActive: { color: "#fff" },
  sectionTitle: { fontSize: 18, fontWeight: "bold", marginVertical: 8 },
  card: { flexDirection: "row", justifyContent: "space-between", padding: 12, borderRadius: 12, backgroundColor: "#fff", marginVertical: 4, elevation: 2 },
  incomeCard: { borderLeftWidth: 4, borderLeftColor: "#10b981" },
  expenseCard: { borderLeftWidth: 4, borderLeftColor: "#ef4444" },
  cardTitle: { fontSize: 14, fontWeight: "bold", color: "#333" },
  cardAmount: { fontSize: 14, fontWeight: "bold" },
  showMoreBtn: { marginTop: 6, alignItems: "center" },
  showMoreText: { color: "#3b49df", fontWeight: "bold" },
});

export default CashFlow;
