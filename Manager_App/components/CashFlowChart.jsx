import React from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import {
  VictoryChart,
  VictoryArea,
  VictoryAxis,
  VictoryTooltip,
  VictoryVoronoiContainer,
} from "victory-native";

const { width } = Dimensions.get("window");

export default function CashFlowChart() {
  // 🔹 SAMPLE DATA (replace with real data later)
  const incomeData = [
    { x: 1, y: 1200 },
    { x: 2, y: 1800 },
    { x: 3, y: 1600 },
    { x: 4, y: 2200 },
    { x: 5, y: 2000 },
  ];

  const expenseData = [
    { x: 1, y: 900 },
    { x: 2, y: 1100 },
    { x: 3, y: 1300 },
    { x: 4, y: 1500 },
    { x: 5, y: 1700 },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Cash Flow Overview</Text>

      <VictoryChart
        width={width - 32}
        height={260}
        padding={{ top: 20, bottom: 40, left: 50, right: 20 }}
        containerComponent={
          <VictoryVoronoiContainer
            labels={({ datum }) => `₪${datum.y}`}
            labelComponent={
              <VictoryTooltip
                flyoutStyle={{ fill: "#ffffff", stroke: "#e5e7eb" }}
                style={{ fontSize: 12, fill: "#111827" }}
              />
            }
          />
        }
      >
        <VictoryAxis
          style={{
            axis: { stroke: "#e5e7eb" },
            tickLabels: { fontSize: 11, fill: "#9ca3af" },
            grid: { stroke: "#f1f5f9" },
          }}
        />

        <VictoryAxis
          dependentAxis
          tickFormat={(t) => `₪${t}`}
          style={{
            axis: { stroke: "#e5e7eb" },
            tickLabels: { fontSize: 11, fill: "#9ca3af" },
            grid: { stroke: "#f1f5f9" },
          }}
        />

        {/* INCOME */}
        <VictoryArea
          data={incomeData}
          interpolation="monotoneX"
          style={{
            data: {
              stroke: "#34C759",
              fill: "rgba(52,199,89,0.25)",
              strokeWidth: 3,
            },
          }}
        />

        {/* EXPENSES */}
        <VictoryArea
          data={expenseData}
          interpolation="monotoneX"
          style={{
            data: {
              stroke: "#FF3B30",
              fill: "rgba(255,59,48,0.25)",
              strokeWidth: 3,
            },
          }}
        />
      </VictoryChart>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#ffffff",
    margin: 16,
    padding: 16,
    borderRadius: 16,
    elevation: 3,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
});
