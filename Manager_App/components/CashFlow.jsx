import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  I18nManager,
  Alert,
} from "react-native";
import axios from "axios";
import { SERVER_URL } from "@env";
import CashFlowChart from "./CashFlowChart"; // your separate chart component

// RTL support
const isRTL = I18nManager.isRTL;

export default function CashFlow({ userId }) {
  const [selectedPeriod, setSelectedPeriod] = useState("חודשי");
  const [incomes, setIncomes] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [totalIncomes, setTotalIncomes] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(false);

  const periods = ["חודשי", "רבעוני", "שנתי"];

  // Client-side map: UI → API values
  const periodMap = {
    "חודשי": "month",
    "רבעוני": "quarter",
    "שנתי": "year",
  };

  const fetchData = async (period) => {
    try {
      setLoading(true);

      const periodParam = periodMap[period];
      if (!periodParam) throw new Error("Invalid period selected");

      // Incomes
      const incomesResponse = await axios.get(
        `${SERVER_URL}/getCashFlowIncomes/${userId}?period=${periodParam}`
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

      // Expenses
      const expensesResponse = await axios.get(
        `${SERVER_URL}/getCashFlowExpenses/${userId}?period=${periodParam}`
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

      // Merge for chart
      const merged = [];
      safeIncomes.forEach((i) =>
        merged.push({
          date: new Date(i?.payments?.date).getTime() || 0,
          value: i?.payments?.amount ?? 0,
          type: "income",
        })
      );
      safeExpenses.forEach((e) =>
        merged.push({
          date: new Date(e?.payments?.date).getTime() || 0,
          value: -(e?.payments?.sumOfReceipt ?? 0),
          type: "expense",
        })
      );

      merged.sort((a, b) => a.date - b.date);
      setChartData(merged);
    } catch (err) {
      console.error("Error fetching CashFlow data:", err);
      Alert.alert("שגיאה", "לא ניתן לטעון את תזרים המזומנים");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(selectedPeriod);
  }, [selectedPeriod]);

  const showMore = (type) => {
    const data = type === "incomes" ? incomes : expenses;
    const title = type === "incomes" ? "הכנסות" : "הוצאות";

    if (!data.length) {
      Alert.alert(title, "אין נתונים להצגה");
      return;
    }

    const message = data
      .map(
        (item, idx) =>
          `${idx + 1}. ${item.projectName || "לא ידוע"} - ₪${
            item?.payments?.amount ?? item?.payments?.sumOfReceipt ?? 0
          }`
      )
      .join("\n");

    Alert.alert(title, message);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 32 }}
    >
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
            <Text
              style={[
                styles.periodText,
                selectedPeriod === p && styles.periodTextActive,
              ]}
            >
              {p}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#137fec" style={{ marginTop: 40 }} />
      ) : (
        <>
          {/* Chart */}
          <CashFlowChart data={chartData} />

          {/* Totals */}
          <View style={styles.totals}>
            <View style={styles.totalBox}>
              <Text style={styles.label}>הכנסות</Text>
              <Text style={styles.incomeText}>₪{totalIncomes}</Text>
            </View>
            <View style={styles.totalBox}>
              <Text style={styles.label}>הוצאות</Text>
              <Text style={styles.expenseText}>₪{totalExpenses}</Text>
            </View>
          </View>

          {/* Incomes preview */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>הכנסות</Text>
              <TouchableOpacity onPress={() => showMore("incomes")}>
                <Text style={styles.showMore}>הצג הכל</Text>
              </TouchableOpacity>
            </View>
            {incomes.slice(0, 5).map((item, idx) => (
              <View key={idx} style={styles.itemRow}>
                <Text style={styles.itemText}>
                  {item.projectName || "לא ידוע"}
                </Text>
                <Text style={styles.incomeText}>
                  ₪{item?.payments?.amount ?? 0}
                </Text>
              </View>
            ))}
          </View>

          {/* Expenses preview */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>הוצאות</Text>
              <TouchableOpacity onPress={() => showMore("expenses")}>
                <Text style={styles.showMore}>הצג הכל</Text>
              </TouchableOpacity>
            </View>
            {expenses.slice(0, 5).map((item, idx) => (
              <View key={idx} style={styles.itemRow}>
                <Text style={styles.itemText}>
                  {item.projectName || "לא ידוע"}
                </Text>
                <Text style={styles.expenseText}>
                  ₪{item?.payments?.sumOfReceipt ?? 0}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 16,
  },
  periodSelector: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 16,
    backgroundColor: "#f0f2f4",
    borderRadius: 12,
    padding: 4,
  },
  periodButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 8,
  },
  periodButtonActive: {
    backgroundColor: "#137fec",
  },
  periodText: {
    color: "#617589",
    fontWeight: "600",
  },
  periodTextActive: {
    color: "#fff",
  },
  totals: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 24,
    marginBottom: 16,
  },
  totalBox: {
    alignItems: "center",
    flex: 1,
  },
  label: {
    fontSize: 14,
    color: "#617589",
    marginBottom: 4,
  },
  incomeText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "green",
  },
  expenseText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "red",
  },
  section: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#111418",
  },
  showMore: {
    color: "#137fec",
    fontSize: 14,
    fontWeight: "600",
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: "#eee",
  },
  itemText: {
    color: "#111418",
    fontSize: 14,
  },
});
