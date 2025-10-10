import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import CashFlowChart from "./CashFlowChart";

export default function CashFlowCard({ net = 0, percent = 0, incomes = 0, expenses = 0, chartPoints = [] }) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View>
          <Text style={styles.label}>תזרים מזומנים נטו</Text>
          <Text style={styles.net}>₪{(net ?? 0).toLocaleString()}</Text>
        </View>
        <View style={styles.percentBox}>
          <MaterialIcons name={percent >= 0 ? "trending-up" : "trending-down"} size={18} color={percent >= 0 ? "#10b981" : "#ef4444"} />
          <Text style={[styles.percent, { color: percent >= 0 ? "#10b981" : "#ef4444" }]}>
            {percent >= 0 ? "+" : ""}{Math.round(percent)}%
          </Text>
        </View>
      </View>

      <View style={styles.chartWrapper}>
        <CashFlowChart points={chartPoints} />
      </View>

      <View style={styles.bottomRow}>
        <View style={styles.col}>
          <Text style={styles.bottomLabel}>הכנסות</Text>
          <Text style={[styles.bottomValue, { color: "#10b981" }]}>₪{(incomes ?? 0).toLocaleString()}</Text>
        </View>
        <View style={styles.col}>
          <Text style={styles.bottomLabel}>הוצאות</Text>
          <Text style={[styles.bottomValue, { color: "#ef4444" }]}>₪{(expenses ?? 0).toLocaleString()}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, backgroundColor: "#fff", padding: 16, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, elevation: 3 },
  row: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
  label: { fontSize: 14, color: "#617589" },
  net: { fontSize: 28, fontWeight: "bold", color: "#111418", marginTop: 4 },
  percentBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#f0fdf4", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  percent: { marginLeft: 4, fontWeight: "600" },
  chartWrapper: { height: 160, marginVertical: 16 },
  bottomRow: { flexDirection: "row-reverse", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "#e6e8eb", paddingTop: 12 },
  col: { alignItems: "center" },
  bottomLabel: { fontSize: 12, color: "#617589" },
  bottomValue: { fontSize: 16, fontWeight: "bold" },
});
