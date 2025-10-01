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
import { MaterialIcons } from "@expo/vector-icons";
import CashFlowCard from "./CashFlowCard";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {useAuth} from "./useAuth";
const isRTL = I18nManager.isRTL;

export default function CashFlow() {
  const route = useRoute();
  const { userId, isAuthenticated } = useAuth();

  const [selectedPeriod, setSelectedPeriod] = useState("חודשי");
  const periods = ["חודשי", "רבעוני", "שנתי"];

  const [loading, setLoading] = useState(false);
  const [incomes, setIncomes] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [totalIncomes, setTotalIncomes] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [prevTotals, setPrevTotals] = useState({ incomes: 0, expenses: 0 });
  const [chartData, setChartData] = useState([]);

  const getToken = async () => {
    return await AsyncStorage.getItem("token");
  }

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
      const token = await getToken();
      
      setLoading(true);
      const periodParam = periodMap[periodLabel] || "month";

      // Incomes
      const incomesResponse = await axios.get(
        `${SERVER_URL}/getCashFlowIncomes/?period=${encodeURIComponent(periodParam)}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
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
        `${SERVER_URL}/getCashFlowExpenses/?period=${encodeURIComponent(periodParam)}`, {
          headers: {Authorization: `Bearer ${token}`}
        }
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

  const showMore = (type) => {
    const data = type === "incomes" ? incomes : expenses;
    const title = type === "incomes" ? "הכנסות" : "הוצאות";

    if (!data || data.length === 0) {
      Alert.alert(title, "אין נתונים להצגה");
      return;
    }

    const message = data
      .map((item, idx) => {
        const amount =
          type === "incomes"
            ? Number(item?.payments?.amount) || 0
            : Number(item?.payments?.sumOfReceipt) || 0;
        return `${idx + 1}. ${item.projectName || "לא ידוע"} — ₪${amount}`;
      })
      .join("\n");

    Alert.alert(title, message);
  };

  const detailedSource = (type, item) =>{
    const title = item.projectName;
    const message = () => {
      const amount = 
      type === "incomes"
            ? Number(item?.payments?.amount) || 0
            : Number(item?.payments?.sumOfReceipt) || 0;
     return `"תשלום:" ${amount}₪ "\n" "סעיף:" ${item.payments.method || null} "\n" "תאריך:" ${item.payments.date}`;
    }
    

    Alert.alert(title, message);
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.headTitle}>תזרים מזומנים</Text>

      {/* Period Selector */}
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

      {/* KPI Card + Chart */}
      {loading ? (
        <ActivityIndicator size="large" color="#137fec" style={{ marginTop: 24 }} />
      ) : (
        <CashFlowCard
          net={(totalIncomes - totalExpenses) || 0}
          percent={
            prevTotals.incomes
              ? ((totalIncomes - totalExpenses - (prevTotals.incomes - prevTotals.expenses)) /
                  Math.max(prevTotals.incomes - prevTotals.expenses, 1)) *
                100
              : 0
          }
          incomes={totalIncomes}
          expenses={totalExpenses}
          chartPoints={chartData}
        />
      )}

      {/* פירוט הכנסות */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>מקורות הכנסה</Text>
          <TouchableOpacity onPress={() => showMore("incomes")}>
            <Text style={styles.showMore}>הצג הכל</Text>
          </TouchableOpacity>
        </View>

        {incomes.slice(0, 5).map((item, idx) => {
          const amount = Number(item?.payments?.amount) || 0;
          const percent = totalIncomes ? Math.round((amount / totalIncomes) * 100) : 0;

          return (
            <TouchableOpacity onPress={() => detailedSource("incomes", item)}>
             <View key={idx} style={styles.itemCard}>
              <View style={styles.iconBoxIncome}>
                <MaterialIcons name="work" size={20} color="#137fec" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{item.projectName || "לא ידוע"}</Text>
                <Text style={styles.itemSubtitle}>₪{amount.toLocaleString()}</Text>
              </View>
              <Text style={styles.itemPercent}>{percent}%</Text>
            </View>
            </TouchableOpacity>
            
          );
        })}
      </View>

      {/* פירוט הוצאות */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>הוצאות</Text>
          <TouchableOpacity onPress={() => showMore("expenses")}>
            <Text style={styles.showMore}>הצג הכל</Text>
          </TouchableOpacity>
        </View>

        {expenses.slice(0, 5).map((item, idx) => {
          const amount = Number(item?.payments?.sumOfReceipt) || 0;
          const percent = totalExpenses ? Math.round((amount / totalExpenses) * 100) : 0;

          return (
            <TouchableOpacity onPress={() => detailedSource("incomes", item)}>
             <View key={idx} style={styles.itemCard} onPress={() => detailedSource("expenses", item)}>
              <View style={styles.iconBoxExpense}>
                <MaterialIcons name="receipt" size={20} color="#ef4444" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{item.projectName || "לא ידוע"}</Text>
                <Text style={styles.itemSubtitle}>₪{amount.toLocaleString()}</Text>
              </View>
              <Text style={styles.itemPercent}>{percent}%</Text>
            </View>
            </TouchableOpacity> 
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 70, padding: 16, backgroundColor: "#f9f9f9" },
  headTitle: { fontSize: 26, fontWeight: "bold", textAlign: isRTL ? "left" : "right", marginBottom: 16 },
  periodSelector: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16, backgroundColor: "#f0f2f4", borderRadius: 12, padding: 4 },
  periodButton: { flex: 1, marginHorizontal: 4, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  periodButtonActive: { backgroundColor: "#137fec" },
  periodButtonText: { color: "#617589", fontWeight: "700" },
  periodButtonTextActive: { color: "#fff" },

  section: { marginTop: 20 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  sectionTitle: { fontSize: 18, fontWeight: "bold", color: "#111418" },
  showMore: { color: "#137fec", fontSize: 14, fontWeight: "600" },

  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#fff",
    marginVertical: 6,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#f0f2f4",
  },
  iconBoxIncome: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#e6f2ff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  iconBoxExpense: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#fee2e2",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  itemTitle: { fontSize: 16, fontWeight: "600", color: "#111418", textAlign: isRTL ? "left" : "right", },
  itemSubtitle: { fontSize: 14, color: "#617589", textAlign: isRTL ? "left" : "right", },
  itemPercent: { fontSize: 16, fontWeight: "700", color: "#111418", textAlign: isRTL ? "right" : "left", },
});
