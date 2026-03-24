import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import api from "../services/api";

function ConversationItem({ item, onPress, onDelete, index }) {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      delay: index * 50,
      useNativeDriver: true,
    }).start();
  }, []);

  const date = new Date(item.lastMessageAt || item.createdAt);
  const isToday = new Date().toDateString() === date.toDateString();
  const dateLabel = isToday
    ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });

  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      <TouchableOpacity
        style={styles.item}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={styles.itemIconWrap}>
          <LinearGradient
            colors={["#1E3A8A", "#2563EB"]}
            style={styles.itemIcon}
          >
            <Ionicons name="chatbubble-ellipses" size={15} color="#fff" />
          </LinearGradient>
        </View>

        <View style={styles.itemBody}>
          <Text style={styles.itemTitle} numberOfLines={1}>
            {item.title || "Conversation"}
          </Text>
          <Text style={styles.itemDate}>{dateLabel}</Text>
        </View>

        <TouchableOpacity onPress={onDelete} style={styles.deleteBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="trash-outline" size={16} color="#475569" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function AgentHistory() {
  const navigation = useNavigation();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/agent/conversations");
      setConversations(res.data || []);
    } catch (err) {
      console.error("AgentHistory load error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const deleteConversation = (id) => {
    Alert.alert("Delete conversation", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await api.delete(`/agent/conversations/${id}`);
          setConversations((prev) => prev.filter((c) => c._id !== id));
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={["#0F172A", "#0F172A", "#0F1F3D"]}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={20} color="#94A3B8" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Conversations</Text>

        <TouchableOpacity
          style={styles.newBtn}
          onPress={() => navigation.navigate("AgentScreen", {})}
        >
          <LinearGradient colors={["#1E40AF", "#3B82F6"]} style={styles.newBtnGradient}>
            <Ionicons name="add" size={18} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.centered}>
          <LinearGradient
            colors={["#1E3A8A22", "#3B82F611"]}
            style={styles.emptyIconWrap}
          >
            <Ionicons name="chatbubbles-outline" size={36} color="#3B82F6" />
          </LinearGradient>
          <Text style={styles.emptyTitle}>No conversations yet</Text>
          <Text style={styles.emptySubtitle}>
            Start chatting with your assistant
          </Text>
          <TouchableOpacity
            style={styles.startBtn}
            onPress={() => navigation.navigate("AgentScreen", {})}
          >
            <LinearGradient colors={["#1E40AF", "#3B82F6"]} style={styles.startBtnGradient}>
              <Ionicons name="sparkles" size={16} color="#fff" />
              <Text style={styles.startBtnText}>New conversation</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item._id}
          renderItem={({ item, index }) => (
            <ConversationItem
              item={item}
              index={index}
              onPress={() =>
                navigation.navigate("AgentScreen", { conversationId: item._id })
              }
              onDelete={() => deleteConversation(item._id)}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text style={styles.listHeader}>
              {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0F172A",
  },

  // ── Header ───────────────────────────────────────────────
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: Platform.OS === "ios" ? 58 : 48,
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderColor: "#1E293B",
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#F1F5F9",
    letterSpacing: -0.3,
  },
  newBtn: {
    borderRadius: 19,
    overflow: "hidden",
  },
  newBtnGradient: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Empty ────────────────────────────────────────────────
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    padding: 32,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#1E3A8A33",
    marginBottom: 6,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#F1F5F9",
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#475569",
    textAlign: "center",
  },
  startBtn: {
    borderRadius: 16,
    overflow: "hidden",
    marginTop: 8,
  },
  startBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
  },
  startBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },

  // ── List ─────────────────────────────────────────────────
  list: {
    padding: 16,
    paddingBottom: 40,
  },
  listHeader: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 14,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1E293B",
    borderRadius: 18,
    padding: 14,
    gap: 12,
    marginBottom: 10,
  },
  itemIconWrap: {
    borderRadius: 14,
    overflow: "hidden",
    flexShrink: 0,
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  itemBody: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#E2E8F0",
    marginBottom: 4,
  },
  itemDate: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "500",
  },
  deleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
});
