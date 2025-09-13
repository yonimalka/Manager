import React from "react";
import { View, Dimensions } from "react-native";
import Svg, { Path, Defs, LinearGradient, Stop } from "react-native-svg";

export default function CashFlowChart({ points = [] }) {
  // Ensure numeric points
  const numericPoints = (points || []).filter(
    (p) => typeof p === "number" && !isNaN(p)
  );
  if (numericPoints.length === 0) {
    return <View style={{ flex: 1 }} />;
  }

  // Responsive width
  const screenWidth = Dimensions.get("window").width;
  const padding = 32; // left+right margin inside chart
  const width = screenWidth - padding;
  const height = 150;

  const maxY = Math.max(...numericPoints);
  const minY = Math.min(...numericPoints);
  const rangeY = maxY - minY || 1;

  const stepX = width / (numericPoints.length - 1 || 1);
  const scaleY = (val) =>
    height - ((val - minY) / rangeY) * height;

  const path = numericPoints
    .map(
      (val, idx) =>
        `${idx === 0 ? "M" : "L"} ${idx * stepX},${scaleY(val)}`
    )
    .join(" ");

  const filledPath = `${path} L ${width},${height} L 0,${height} Z`;

  return (
    <Svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      <Defs>
        <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#137fec" stopOpacity="0.2" />
          <Stop offset="1" stopColor="#137fec" stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Path d={filledPath} fill="url(#grad)" />
      <Path
        d={path}
        stroke="#137fec"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
  );
}
