import React from "react";
import { View } from "react-native";
import Svg, { Path, Defs, LinearGradient, Stop } from "react-native-svg";

const CashFlowChart = ({ points, width = 350, height = 150 }) => {
  if (!points || points.length === 0) return null;

  // Normalize points to SVG coordinates
  const maxY = Math.max(...points);
  const minY = Math.min(...points);
  const rangeY = maxY - minY || 1;

  const stepX = width / (points.length - 1);
  const scaleY = (val) =>
    height - ((val - minY) / rangeY) * (height - 20); // padding bottom

  let d = `M0 ${scaleY(points[0])}`;
  points.forEach((p, i) => {
    if (i === 0) return;
    d += ` L${i * stepX} ${scaleY(p)}`;
  });

  return (
    <View style={{ width, height }}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
        {/* Gradient Fill */}
        <Defs>
          <LinearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#137fec" stopOpacity={0.2} />
            <Stop offset="100%" stopColor="#137fec" stopOpacity={0} />
          </LinearGradient>
        </Defs>

        {/* Gradient Area */}
        <Path
          d={`${d} L${width} ${height} L0 ${height} Z`}
          fill="url(#gradient)"
        />

        {/* Line */}
        <Path
          d={d}
          stroke="#137fec"
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
};

export default CashFlowChart;
