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

const CATEGORY_COLORS = {
  materials: "#F59E0B",
  labor:     "#8B5CF6",
  wages:     "#8B5CF6",
  equipment: "#06B6D4",
  tools:     "#06B6D4",
  fuel:      "#EF4444",
  gas:       "#EF4444",
  rent:      "#3B82F6",
  fixed:     "#6366F1",
  software:  "#10B981",
  subscriptions: "#10B981",
  general:   "#94A3B8",
};

const getCategoryColor = (cat) =>
  CATEGORY_COLORS[(cat || "").toLowerCase().trim()] || "#94A3B8";

const getCategoryBg = (cat) => {
  const color = getCategoryColor(cat);
  return color + "22";
};

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
  const [chartMode, setChartMode] = useState("overview");

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

  const expenseRatio = totalIncome > 0 ? Math.round((totalExpenses / totalIncome) * 100) : 0;
  const ratioColor = expenseRatio < 60 ? "#16A34A" : expenseRatio < 85 ? "#D97706" : "#E11D48";
  const ratioBg    = expenseRatio < 60 ? "#DCFCE7" : expenseRatio < 85 ? "#FEF3C7" : "#FFE4E6";

  /* ---------------- CHART DATA ---------------- */

  const donutData = useMemo(() => [
    { x: "Income",   y: totalIncome   || 0.001 },
    { x: "Expenses", y: totalExpenses || 0.001 },
  ], [totalIncome, totalExpenses]);

  const expenseByCategory = useMemo(() => {
    const map = {};
    expenses.forEach((item) => {
      const cat = item.payments.category || "General";
      map[cat] = (map[cat] || 0) + (Number(item.payments.sumOfReceipt) || 0);
    });
    return Object.entries(map)
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: totalExpenses > 0 ? Math.round((amount / totalExpenses) * 100) : 0,
        color: getCategoryColor(category),
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenses, totalExpenses]);

  const breakdownData = expenseByCategory.length > 0
    ? expenseByCategory.map((c) => ({ x: c.category, y: c.amount }))
    : [{ x: "No data", y: 1 }];

  const breakdownColors = expenseByCategory.length > 0
    ? expenseByCategory.map((c) => c.color)
    : ["#E5E7EB"];

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

      {/* SUMMARY CARDS — 2×2 grid */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryTwoCol}>
          <SummaryCard title="Total Income"    value={totalIncome}    icon="trending-up"   color="#34C759" userDetails={userDetails} compact />
          <SummaryCard title="Total Expenses"  value={totalExpenses}  icon="trending-down" color="#FF3B30" userDetails={userDetails} compact />
        </View>
        <View style={styles.summaryTwoCol}>
          <SummaryCard title="Net Cash Flow"   value={netCashFlow}    icon="attach-money"  color="#0A84FF" userDetails={userDetails} compact />
          {/* Expense Ratio */}
          <View style={[styles.summaryCard, styles.summaryCardCompact, { flex: 1 }]}>
            <View style={styles.summaryTop}>
              <Text style={[styles.summaryTitle, styles.summaryTitleCompact]}>Expense Ratio</Text>
              <View style={[styles.iconCircle, { backgroundColor: ratioBg }]}>
                <MaterialIcons name="percent" size={16} color={ratioColor} />
              </View>
            </View>
            <Text style={[styles.summaryValue, styles.summaryValueCompact, { color: ratioColor }]}>
              {expenseRatio}%
            </Text>
            <View style={styles.ratioTrack}>
              <View style={[styles.ratioFill, { width: `${Math.min(expenseRatio, 100)}%`, backgroundColor: ratioColor }]} />
            </View>
            <Text style={[styles.summaryTitle, { fontSize: 10, marginLeft: 0, marginTop: 3 }]}>of income spent</Text>
          </View>
        </View>
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

        {/* Chart mode toggle */}
        <View style={styles.chartModeRow}>
          {[["overview", "Income vs Expenses"], ["breakdown", "Expense Breakdown"]].map(([mode, label]) => (
            <TouchableOpacity
              key={mode}
              style={[styles.chartModeBtn, chartMode === mode && styles.chartModeBtnActive]}
              onPress={() => setChartMode(mode)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chartModeBtnText, chartMode === mode && styles.chartModeBtnTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
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
                data={chartMode === "overview" ? donutData : breakdownData}
                width={240}
                height={240}
                innerRadius={82}
                radius={110}
                padAngle={2.5}
                labels={() => null}
                colorScale={chartMode === "overview" ? ["#22C55E", "#F43F5E"] : breakdownColors}
                style={{ parent: { overflow: "hidden" } }}
              />
              {/* Center */}
              <View style={styles.donutCenter}>
                {chartMode === "overview" ? (
                  <>
                    <Text style={styles.donutCenterLabel}>Net Cash Flow</Text>
                    <Text
                      style={[styles.donutCenterValue, { color: netCashFlow >= 0 ? "#16A34A" : "#E11D48" }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >
                      {formatCurrency(netCashFlow || 0, userDetails?.currency || "USD", userDetails?.locale || "en-US")}
                    </Text>
                    <View style={[styles.donutCenterBadge, { backgroundColor: netCashFlow >= 0 ? "#DCFCE7" : "#FFE4E6" }]}>
                      <Text style={[styles.donutCenterBadgeText, { color: netCashFlow >= 0 ? "#16A34A" : "#E11D48" }]}>
                        {netCashFlow >= 0 ? "▲ Positive" : "▼ Negative"}
                      </Text>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.donutCenterLabel}>Total Expenses</Text>
                    <Text style={[styles.donutCenterValue, { color: "#E11D48" }]} numberOfLines={1} adjustsFontSizeToFit>
                      {formatCurrency(totalExpenses || 0, userDetails?.currency || "USD", userDetails?.locale || "en-US")}
                    </Text>
                    <View style={[styles.donutCenterBadge, { backgroundColor: "#FFF1F2" }]}>
                      <Text style={[styles.donutCenterBadgeText, { color: "#E11D48" }]}>
                        {expenseByCategory.length} categories
                      </Text>
                    </View>
                  </>
                )}
              </View>
            </View>

            {/* Legend — Overview */}
            {chartMode === "overview" && (
              <View style={styles.donutLegend}>
                {[
                  { label: "Income",   value: totalIncome,    color: "#22C55E", pct: totalIncome + totalExpenses > 0 ? Math.round(totalIncome / (totalIncome + totalExpenses) * 100) : 0 },
                  { label: "Expenses", value: totalExpenses,  color: "#F43F5E", pct: totalIncome + totalExpenses > 0 ? Math.round(totalExpenses / (totalIncome + totalExpenses) * 100) : 0 },
                ].map((item, i) => (
                  <React.Fragment key={item.label}>
                    {i > 0 && <View style={styles.legendDivider} />}
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                      <View>
                        <Text style={styles.legendLabel}>{item.label}</Text>
                        <Text style={styles.legendValue}>
                          {formatCurrency(item.value || 0, userDetails?.currency || "USD", userDetails?.locale || "en-US")}
                        </Text>
                        <Text style={styles.legendPct}>{item.pct}%</Text>
                      </View>
                    </View>
                  </React.Fragment>
                ))}
              </View>
            )}

            {/* Legend — Breakdown (grid) */}
            {chartMode === "breakdown" && (
              <View style={styles.breakdownLegend}>
                {expenseByCategory.map((cat) => (
                  <View key={cat.category} style={styles.breakdownLegendItem}>
                    <View style={[styles.legendDot, { backgroundColor: cat.color, width: 10, height: 10 }]} />
                    <View>
                      <Text style={styles.legendLabel}>{cat.category}</Text>
                      <Text style={styles.legendValue}>
                        {formatCurrency(cat.amount, userDetails?.currency || "USD", userDetails?.locale || "en-US")}
                      </Text>
                      <Text style={styles.legendPct}>{cat.percentage}%</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
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

const SummaryCard = ({ title, value, icon, color, userDetails, compact }) => (
  <View style={[styles.summaryCard, compact && styles.summaryCardCompact, compact && { flex: 1 }]}>
    <View style={styles.summaryTop}>
      <Text style={[styles.summaryTitle, compact && styles.summaryTitleCompact]}>{title}</Text>
      <View style={[styles.iconCircle, { backgroundColor: `${color}22` }]}>
        <MaterialIcons name={icon} size={compact ? 15 : 18} color={color} />
      </View>
    </View>
    <Text style={[styles.summaryValue, compact && styles.summaryValueCompact]}>
      {formatCurrency(value || 0, userDetails?.currency || "USD", userDetails?.locale || "en-US")}
    </Text>
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
                <Text style={styles.transactionDate}>{new Date(item.payments.date).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  }) ?? ''}</Text>
                {item.type === "expense" && item.payments.category ? (
                  <View style={[styles.categoryPill, { backgroundColor: getCategoryBg(item.payments.category) }]}>
                    <Text style={[styles.categoryPillText, { color: getCategoryColor(item.payments.category) }]}>
                      {item.payments.category}
                    </Text>
                  </View>
                ) : (
                  <>
                    <Tag size={12} color="#94A3B8"/>
                    <Text style={styles.transactionAbout}>{handleTransactionType(item)}</Text>
                  </>
                )}
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
  legendPct: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "600",
    marginTop: 1,
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

  // ── Summary 2×2 grid ──
  summaryTwoCol: {
    flexDirection: "row",
    gap: 12,
  },
  summaryCardCompact: {
    padding: 12,
    paddingHorizontal: 14,
  },
  summaryTitleCompact: {
    fontSize: 12,
    marginLeft: 0,
    marginTop: 0,
  },
  summaryValueCompact: {
    fontSize: 20,
    marginLeft: 0,
    marginTop: 6,
  },

  // ── Expense ratio bar ──
  ratioTrack: {
    height: 5,
    backgroundColor: "#F1F5F9",
    borderRadius: 99,
    marginTop: 6,
    overflow: "hidden",
  },
  ratioFill: {
    height: "100%",
    borderRadius: 99,
  },

  // ── Chart mode toggle ──
  chartModeRow: {
    flexDirection: "row",
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 3,
    marginBottom: 16,
    gap: 2,
  },
  chartModeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  chartModeBtnActive: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  chartModeBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94A3B8",
  },
  chartModeBtnTextActive: {
    color: "#0F172A",
  },

  // ── Breakdown legend grid ──
  breakdownLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 16,
    width: "100%",
    gap: 14,
  },
  breakdownLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    width: "45%",
  },

  // ── Category pill on transaction rows ──
  categoryPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 99,
    marginLeft: 6,
  },
  categoryPillText: {
    fontSize: 10,
    fontWeight: "700",
  },
});
