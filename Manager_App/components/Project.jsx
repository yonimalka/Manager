import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import api from "../services/api";
import { formatCurrency } from "../services/formatCurrency";
import { useAuth } from "./useAuth";

const DAY = 86400000;

const Project = ({ id, projectName, totalAmount, totalDays, isDemo, initial }) => {
  const { userDetails } = useAuth();
  const isFocused = useIsFocused();
  const [data, setData] = useState(initial || null);

  useEffect(() => {
    if (!isFocused || !id) return;
    api.get(`/getProject/${id}`)
      .then((res) => setData(res.data))
      .catch((err) => { if (err?.response?.status !== 404) console.error("Project card fetch error:", err); });
  }, [isFocused, id]);

  const fmt = (n) => formatCurrency(n || 0, userDetails?.currency || "USD", userDetails?.locale || "en-US");

  const jobValue   = data?.payment ?? totalAmount ?? 0;
  const paid       = data?.paid || 0;
  const owed       = Math.max(jobValue - paid, 0);
  const collected  = jobValue > 0 ? Math.min(100, Math.round((paid / jobValue) * 100)) : 0;
  const days       = data?.days ?? totalDays ?? 0;
  const dayNum     = data?.createdAt ? Math.floor((Date.now() - new Date(data.createdAt)) / DAY) + 1 : 1;
  const tasks      = data?.toDoList || [];
  const doneCount  = tasks.filter((t) => t.checked).length;
  const nextTask   = tasks.find((t) => !t.checked);
  const isComplete = data?.status === "complete";

  const timing = isComplete
    ? "Complete"
    : days ? (dayNum > days ? `${dayNum - days} days over` : `Day ${dayNum} of ${days}`) : null;
  const meta = [data?.client, timing].filter(Boolean).join(" · ");

  const footer = jobValue === 0
    ? "Set job value to track what's owed"
    : nextTask ? `Next: ${nextTask.task}` : tasks.length ? "All tasks done" : "No tasks yet";

  return (
    <View style={[s.card, isComplete && s.cardComplete]}>
      <View style={s.top}>
        <View style={s.left}>
          <View style={s.nameRow}>
            <Text style={[s.name, isComplete && s.nameComplete]} numberOfLines={1}>{data?.name || projectName}</Text>
            {isDemo && <View style={s.demo}><Text style={s.demoText}>Demo</Text></View>}
          </View>
          {!!meta && <Text style={s.meta} numberOfLines={1}>{meta}</Text>}
        </View>

        <View style={s.right}>
          {isComplete ? (
            <View style={s.donePill}>
              <Ionicons name="checkmark" size={13} color="#047857" />
              <Text style={s.doneText}>Done</Text>
            </View>
          ) : jobValue === 0 ? (
            <Text style={s.noValue}>No value yet</Text>
          ) : owed === 0 ? (
            <>
              <Text style={s.amount}>{fmt(jobValue)}</Text>
              <Text style={[s.amountLabel, { color: "#047857" }]}>fully paid</Text>
            </>
          ) : (
            <>
              <Text style={s.amount}>{fmt(owed)}</Text>
              <Text style={[s.amountLabel, { color: "#B45309" }]}>still owed</Text>
            </>
          )}
        </View>
        <Ionicons name="chevron-forward" size={18} color="#CBD5E1" style={{ marginLeft: 6 }} />
      </View>

      {!isComplete && jobValue > 0 && (
        <View style={s.track}><View style={[s.fill, { width: `${collected}%` }]} /></View>
      )}

      {!isComplete && (
        <View style={s.footer}>
          <Text style={s.footerText} numberOfLines={1}>{footer}</Text>
          {tasks.length > 0 && <Text style={s.footerCount}>{doneCount} of {tasks.length} tasks</Text>}
        </View>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  card:         { backgroundColor: "#FFFFFF", borderRadius: 20, borderWidth: 1, borderColor: "#E2E8F0", padding: 16, gap: 12 },
  cardComplete: { backgroundColor: "#F8FAFC" },
  top:          { flexDirection: "row", alignItems: "center" },
  left:         { flex: 1, minWidth: 0, gap: 3 },
  nameRow:      { flexDirection: "row", alignItems: "center", gap: 8 },
  name:         { fontSize: 16, fontWeight: "600", color: "#0F172A", flexShrink: 1 },
  nameComplete: { color: "#64748B" },
  meta:         { fontSize: 13, color: "#64748B" },
  right:        { alignItems: "flex-end", marginLeft: 12, gap: 2 },
  amount:       { fontSize: 16, fontWeight: "700", color: "#0F172A", fontVariant: ["tabular-nums"] },
  amountLabel:  { fontSize: 12, fontWeight: "600" },
  noValue:      { fontSize: 13, color: "#94A3B8" },
  donePill:     { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#ECFDF5", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  doneText:     { fontSize: 12, fontWeight: "600", color: "#047857" },
  track:        { height: 6, borderRadius: 3, backgroundColor: "#F1F5F9", overflow: "hidden" },
  fill:         { height: 6, borderRadius: 3, backgroundColor: "#059669" },
  footer:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  footerText:   { flex: 1, fontSize: 13, color: "#475569" },
  footerCount:  { fontSize: 13, color: "#94A3B8" },
  demo:         { backgroundColor: "#EFF6FF", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  demoText:     { fontSize: 11, fontWeight: "600", color: "#3B82F6" },
});

export default Project;
