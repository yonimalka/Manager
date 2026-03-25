import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Animated,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  VictoryPie ,
  VictoryChart,
  VictoryArea,
  VictoryAxis,
  VictoryTooltip,
  VictoryVoronoiContainer,
} from "victory-native";
import {
  Calendar,
  Tag,
  ShoppingCart,
  Home,
  Briefcase
} from "lucide-react-native";
import { Ionicons } from "@expo/vector-icons";
import { MaterialIcons } from "@expo/vector-icons";
import api from "../services/api";
import { useAuth } from "./useAuth";
import { formatCurrency } from "../services/formatCurrency";

export default function CashFlow() {
  const { userId, userDetails } = useAuth();
  if (!userDetails){
    return <ActivityIndicator size="large"/>
  }
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState("month");

  const [incomes, setIncomes] = useState([]);
  const [expenses, setExpenses] = useState([]);

  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);

  useEffect(() => {
    if (!userId) return;
    fetchData();
  }, [userId, period]);

  const fetchData = async () => {
    try {
      setLoading(true);

      const incomeRes = await api.get(`/getCashFlowIncomes?period=${period}`);
      const expenseRes = await api.get(`/getCashFlowExpenses?period=${period}`);
      
      const inc = Array.isArray(incomeRes.data) ? incomeRes.data : [];
      const exp = Array.isArray(expenseRes.data) ? expenseRes.data : [];
      // console.log("exp: ", expenseRes.data)
      // console.log("inc: ", inc);
      
      setIncomes(inc);
      setExpenses(exp);
      
      const incTotal = inc.reduce(
        (s, i) => s + (Number(i?.payments?.amount) || 0),
        0
      );
      const expTotal = exp.reduce(
        (s, e) => s + (Number(e?.payments?.sumOfReceipt) || 0),
        0
      );

      setTotalIncome(incTotal);
      setTotalExpenses(expTotal);
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to load cash flow data");
    } finally {
      setLoading(false);
    }
  };

  const netCashFlow = totalIncome - totalExpenses;
   
  /* ---------------- CHART DATA ---------------- */

  const donutData = useMemo(() => [
  { x: "Income", y: totalIncome },
  { x: "Expenses", y: totalExpenses },
], [totalIncome, totalExpenses]);

const Skeleton = ({ width, height, radius = 12, style }) => (
  <View
    style={[
      {
        width,
        height,
        borderRadius: radius,
        backgroundColor: "#E5E7EB",
      },
      style,
    ]}
  />
);


  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 140 }}>
      {/* HEADER */}
      <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
        <Text style={styles.title}>Cash Flow</Text>
        <Text style={styles.subtitle}>
          Track your income and expenses over time
        </Text>
      </View>

      {/* SUMMARY CARDS */}
      <View style={styles.summaryRow}>
        <SummaryCard
          title="Total Income"
          value={totalIncome}
          icon="trending-up"
          color="#34C759"
          userDetails={userDetails}
          // style={{width: 40, backgroundColor: "#34C759"}}
        />
        <SummaryCard
          title="Total Expenses"
          value={totalExpenses}
          icon="trending-down"
          color="#FF3B30"
          userDetails={userDetails}
        />
        <SummaryCard
          title="Net Cash Flow"
          value={netCashFlow}
          icon="attach-money"
          color="#0A84FF"
          userDetails={userDetails}
        />
      </View>

      {/* CHART */}
      <View style={styles.chartCard}>
        {/* Header + Period selector */}
        <View style={styles.chartHeaderRow}>
          <Text style={styles.chartCardTitle}>Overview</Text>
          <View style={styles.periodRow}>
          {["month", "quarter", "year"].map((p) => (
            <TouchableOpacity
              key={p}
              onPress={() => setPeriod(p)}
              activeOpacity={0.7}
              style={[styles.periodBtn, period === p && styles.periodBtnActive]}
            >
              <Text style={[styles.periodText, period === p && styles.periodTextActive]}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
          </View>
        </View>

        {loading ? (
          <View style={{ alignItems: "center", paddingVertical: 28 }}>
            <Skeleton width={220} height={220} radius={110} />
            <Skeleton width={100} height={14} style={{ marginTop: 20 }} />
            <Skeleton width={140} height={22} style={{ marginTop: 8 }} />
          </View>
        ) : (
          <View style={{ alignItems: "center" }}>
            {/* Donut */}
            <View style={styles.donutWrapper}>
              <VictoryPie
                data={donutData}
                width={240}
                height={240}
                innerRadius={82}
                radius={110}
                padAngle={2.5}
                labels={() => null}
                colorScale={["#22C55E", "#F43F5E"]}
                style={{ parent: { overflow: "hidden" } }}
              />
              {/* Center */}
              <View style={styles.donutCenter}>
                <Text style={styles.donutCenterLabel}>Net Cash Flow</Text>
                <Text
                  style={[
                    styles.donutCenterValue,
                    { color: netCashFlow >= 0 ? "#16A34A" : "#E11D48" },
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {formatCurrency(
                    netCashFlow || 0,
                    userDetails?.currency || "USD",
                    userDetails?.locale || "en-US"
                  )}
                </Text>
                <View style={[
                  styles.donutCenterBadge,
                  { backgroundColor: netCashFlow >= 0 ? "#DCFCE7" : "#FFE4E6" }
                ]}>
                  <Text style={[
                    styles.donutCenterBadgeText,
                    { color: netCashFlow >= 0 ? "#16A34A" : "#E11D48" }
                  ]}>
                    {netCashFlow >= 0 ? "▲ Positive" : "▼ Negative"}
                  </Text>
                </View>
              </View>
            </View>

            {/* Legend */}
            <View style={styles.donutLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: "#22C55E" }]} />
                <View>
                  <Text style={styles.legendLabel}>Income</Text>
                  <Text style={styles.legendValue}>
                    {formatCurrency(totalIncome || 0, userDetails?.currency || "USD", userDetails?.locale || "en-US")}
                  </Text>
                </View>
              </View>

              <View style={styles.legendDivider} />

              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: "#F43F5E" }]} />
                <View>
                  <Text style={styles.legendLabel}>Expenses</Text>
                  <Text style={styles.legendValue}>
                    {formatCurrency(totalExpenses || 0, userDetails?.currency || "USD", userDetails?.locale || "en-US")}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* INCOME LIST */}
      <TransactionSection
        title="Income Details"
        data={incomes}
        amountKey="amount"
        color="#34C759"
        icon="trending-up"
        userDetails={userDetails}
      />

      {/* EXPENSE LIST */}
      <TransactionSection
        title="Expense Details"
        data={expenses}
        amountKey="sumOfReceipt"
        color="#FF3B30"
        icon="trending-down"
        userDetails={userDetails}
      />
    </ScrollView>
  );
}

/* ---------------- SUB COMPONENTS ---------------- */

const SummaryCard = ({ title, value, icon, color, userDetails }) => (
  <View style={styles.summaryCard}>
    <View style={styles.summaryTop}>
      <Text style={styles.summaryTitle}>{title}</Text>
      <View style={[styles.iconCircle, { backgroundColor: `${color}22` }]}>
        <MaterialIcons name={icon} size={18} color={color} />
      </View>
    </View>
    <Text style={styles.summaryValue}>{
      formatCurrency(
       value || 0,
       userDetails?.currency || "USD",
       userDetails?.locale || "en-US"
      )
    }</Text>
  </View>
);

const TransactionSection = ({ title, data, amountKey, color, icon, userDetails }) => {
  const handleTransactionType = (item) => {
    if (item.type == "income") {
      if(item.source == "project"){
        return "Project Payment"
      } else {
        return item.payer
      }
    } else {
      return item.payments.category
    }
  }
  return (
  <View style={styles.section}>
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {/* <TouchableOpacity style={[styles.addBtn, { backgroundColor: color }]}>
        <MaterialIcons name="add" size={18} color="#fff" />
      </TouchableOpacity> */}
    </View>

    <View style={styles.summaryCard}>
      {data.slice(0, 8).map((item, idx) => {
        const amount = Number(item?.payments?.[amountKey]) || 0;
        return (
          <View key={idx} style={styles.transaction}>
            <View style={[styles.transactionIcon, { backgroundColor: `${color}22` }]}>
              <MaterialIcons name={icon} size={16} color={color} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.transactionTitle}>
                {item.projectName || "Unknown"}
              </Text>
              <View style={styles.transactionDetails}>
              <Calendar size={12} color={"#94A3B8"}/>
              {/* <Text style={styles.transactionDate}>
                {item?.payments?.date || ""}
              </Text> */}
              <Text style={styles.transactionDate}>{new Date(item.payments.date).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })?? ''}</Text>
              <Tag size={12} color="#94A3B8"/>
              <Text style={styles.transactionAbout}>{handleTransactionType(item)}</Text>
              </View>
            </View>

            <Text style={[styles.transactionAmount, { color }]}>
              {formatCurrency(
                 amount || 0,
                 userDetails?.currency || "USD",
                 userDetails?.locale || "en-US"
                )}
            </Text>
          </View>
        );
      })}
    </View>
  </View>
  )
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F5F6FA",
    // paddingHorizontal: 22,
    // paddingTop: 64,
  },
  backButton: {
    width: 40,
    height: 40, 
    borderRadius: 20, 
    backgroundColor: "rgba(35, 31, 31, 0.2)", 
    alignItems: "center", 
    justifyContent: "center",
    marginBottom: 15,
},
  header: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 24,
    marginBottom: 25,
    backgroundColor: "#FFFFFF",
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  title: {
    fontSize: 38, 
    fontWeight: "700", 
    color: "#111" 
  },
  subtitle: { 
    fontSize: 14, 
    color: "#6B7280", 
    marginTop: 4, 
    marginBottom: 12, 
  },

  summaryRow: {
    flexDirection: "column",
    gap: 12,
    marginBottom: 29,
    paddingHorizontal: 20,
  },
  summaryCard: {
    flex: 1,
    paddingHorizontal: 20,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  summaryTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    // marginBottom: 12,
  },
  summaryTitle: { 
    fontSize: 15, 
    color: "#6B7280", 
    fontWeight: "500", 
    marginLeft: 15,
    marginTop: 10 
  },
  summaryValue: { 
    fontSize: 29, 
    fontWeight: "700", 
    color: "#111", 
    marginLeft: 10,
    marginTop: 10
  },

  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },

  chartCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 28,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  chartHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  chartCardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0F172A",
  },
  periodRow: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 3,
    alignSelf: "center",
  },
  periodBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 9,
    marginHorizontal: 1,
    minWidth: 70,
    alignItems: "center",
    justifyContent: "center",
  },
  periodBtnActive: {
    backgroundColor: "#2563EB",
  },
  periodText: { fontSize: 13, color: "#94A3B8", fontWeight: "600" },
  periodTextActive: { color: "#fff", fontWeight: "700" },

  donutWrapper: {
    width: 240,
    height: 240,
    alignItems: "center",
    justifyContent: "center",
  },
  donutCenter: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    width: 148,
  },
  donutCenterLabel: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 4,
    textAlign: "center",
  },
  donutCenterValue: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
    textAlign: "center",
    marginBottom: 8,
  },
  donutCenterBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  donutCenterBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },

  donutLegend: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginTop: 16,
    width: "100%",
    gap: 16,
  },
  legendItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  legendLabel: {
    fontSize: 12,
    color: "#94A3B8",
    fontWeight: "500",
    marginBottom: 2,
  },
  legendValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  legendDivider: {
    width: 1,
    height: 36,
    backgroundColor: "#E2E8F0",
  },
section : { 
  marginTop: 28, 
  paddingHorizontal: 20, 
},
  sectionHeader: {
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  sectionTitle: { fontSize: 20, 
    fontWeight: "700" 
  },

  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },

  transaction: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "#F1F5F9",
    
  },
  transactionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  transactionTitle: { fontSize: 14, fontWeight: "600", marginBottom: 12 },
  transactionDetails : {
   flexDirection: "row",
  //  justifyContent: "space-between"
  
  },
  transactionAbout: {
    fontSize: 12,
    color: "grey",
    marginLeft: 2,
    
  },
  transactionDate: { fontSize: 12, color: "grey", marginLeft: 5, marginRight: 7 },
  transactionAmount: { fontSize: 15, fontWeight: "700" },
});
