import React from "react";
import { View, Text } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import CashFlowChart from "./CashFlowChart";

const CashFlowCard = ({ net, percent, incomes, expenses, chartPoints }) => {
  return (
    <View
      style={{
        backgroundColor: "white",
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "#e6e8eb",
        padding: 20,
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 4,
      }}
    >
      {/* Top Section */}
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <View>
          <Text style={{ color: "#617589", fontSize: 16, fontWeight: "500" }}>
            תזרים מזומנים נטו
          </Text>
          <Text
            style={{
              color: "#111418",
              fontSize: 32,
              fontWeight: "bold",
              marginTop: 4,
            }}
          >
            ₪{net.toLocaleString()}
          </Text>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "#dcfce7",
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 20,
            alignSelf: "center",
          }}
        >
          <MaterialIcons name="trending-up" size={16} color="#16a34a" />
          <Text style={{ color: "#16a34a", fontWeight: "600", marginLeft: 4 }}>
            +{percent}%
          </Text>
        </View>
      </View>

      {/* Chart */}
      <View style={{ marginVertical: 20 }}>
        <CashFlowChart points={chartPoints} />
      </View>

      {/* Bottom Totals */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          borderTopWidth: 1,
          borderStyle: "dashed",
          borderColor: "#e5e7eb",
          paddingTop: 12,
        }}
      >
        <View style={{ alignItems: "center" }}>
          <Text style={{ color: "#617589", fontSize: 12 }}>הכנסות</Text>
          <Text style={{ color: "#22c55e", fontSize: 18, fontWeight: "bold" }}>
            ₪{incomes.toLocaleString()}
          </Text>
        </View>

        <View style={{ alignItems: "center" }}>
          <Text style={{ color: "#617589", fontSize: 12 }}>הוצאות</Text>
          <Text style={{ color: "#ef4444", fontSize: 18, fontWeight: "bold" }}>
            ₪{expenses.toLocaleString()}
          </Text>
        </View>
      </View>
    </View>
  );
};

export default CashFlowCard;
