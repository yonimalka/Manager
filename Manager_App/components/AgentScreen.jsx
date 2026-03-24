import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRoute } from "@react-navigation/native";
import api from "../services/api";

const SUGGESTIONS = [
  { icon: "trending-up-outline", text: "Summarize my income this month" },
  { icon: "document-text-outline", text: "Create a quote for a new client" },
  { icon: "bar-chart-outline", text: "Which project is most profitable?" },
  { icon: "receipt-outline", text: "Show my top expense categories" },
];

function TypingDots() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = (dot, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 400, useNativeDriver: true }),
          Animated.delay(800 - delay),
        ])
      ).start();

    animate(dot1, 0);
    animate(dot2, 200);
    animate(dot3, 400);
  }, []);

  return (
    <View style={styles.typingDots}>
      {[dot1, dot2, dot3].map((dot, i) => (
        <Animated.View
          key={i}
          style={[
            styles.dot,
            {
              opacity: dot,
              transform: [
                {
                  translateY: dot.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -4],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

export default function AgentScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const conversationId = route.params?.conversationId || null;

  const [agent, setAgent] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [activeConvId, setActiveConvId] = useState(conversationId);
  const flatListRef = useRef(null);
  const inputRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const loadAgent = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/agent");
      setAgent(res.data);

      if (activeConvId) {
        const convRes = await api.get(`/agent/conversations/${activeConvId}`);
        setMessages(convRes.data.messages || []);
      }

      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
    } catch (err) {
      console.error("Agent load error:", err);
    } finally {
      setLoading(false);
    }
  }, [activeConvId]);

  useEffect(() => {
    loadAgent();
  }, [loadAgent]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 120);
    }
  }, [messages]);

  const sendMessage = async (text) => {
    const msg = (text || input).trim();
    if (!msg || sending) return;

    setInput("");
    setSending(true);

    const userMsg = { role: "user", content: msg, _id: Date.now().toString() };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await api.post("/agent/chat", {
        conversationId: activeConvId,
        message: msg,
      });

      if (!activeConvId) setActiveConvId(res.data.conversationId);

      const assistantMsg = {
        role: "assistant",
        content: res.data.reply,
        _id: (Date.now() + 1).toString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error("Chat error:", err);
      Alert.alert("Error", "Failed to send message. Try again.");
      setMessages((prev) => prev.filter((m) => m._id !== userMsg._id));
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item, index }) => {
    const isUser = item.role === "user";
    const isLast = index === messages.length - 1;

    return (
      <Animated.View
        style={[
          styles.msgWrapper,
          isUser ? styles.msgWrapperUser : styles.msgWrapperAssistant,
        ]}
      >
        {!isUser && (
          <LinearGradient
            colors={["#1E40AF", "#3B82F6"]}
            style={styles.assistantAvatar}
          >
            <Ionicons name="sparkles" size={13} color="#fff" />
          </LinearGradient>
        )}

        <View
          style={[
            styles.bubble,
            isUser ? styles.bubbleUser : styles.bubbleAssistant,
          ]}
        >
          <Text
            style={[
              styles.bubbleText,
              isUser ? styles.bubbleTextUser : styles.bubbleTextAssistant,
            ]}
          >
            {item.content}
          </Text>
        </View>
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <LinearGradient colors={["#0F172A", "#1E3A5F"]} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading your assistant…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Background */}
      <LinearGradient
        colors={["#0F172A", "#0F172A", "#0F1F3D"]}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={20} color="#94A3B8" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <LinearGradient colors={["#1E40AF", "#3B82F6"]} style={styles.headerAvatar}>
            <Ionicons name="sparkles" size={14} color="#fff" />
          </LinearGradient>
          <View>
            <Text style={styles.headerName}>{agent?.name || "My Assistant"}</Text>
            <View style={styles.headerStatus}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Online</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => navigation.navigate("AgentHistory")}
          style={styles.headerBtn}
        >
          <Ionicons name="time-outline" size={20} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      {messages.length === 0 ? (
        <Animated.ScrollView
          style={{ flex: 1, opacity: fadeAnim }}
          contentContainerStyle={styles.emptyContainer}
          showsVerticalScrollIndicator={false}
        >
          <LinearGradient
            colors={["#1E3A8A22", "#3B82F611"]}
            style={styles.emptyIconWrapper}
          >
            <Ionicons name="sparkles" size={40} color="#3B82F6" />
          </LinearGradient>

          <Text style={styles.emptyTitle}>{agent?.name || "Your Assistant"}</Text>
          <Text style={styles.emptySubtitle}>
            Your personal AI accountant. Ask me anything about your business, finances, or projects.
          </Text>

          <Text style={styles.suggestionsLabel}>Suggested</Text>
          <View style={styles.suggestionsGrid}>
            {SUGGESTIONS.map((s, i) => (
              <TouchableOpacity
                key={i}
                style={styles.suggestionCard}
                onPress={() => sendMessage(s.text)}
                activeOpacity={0.75}
              >
                <View style={styles.suggestionIconWrap}>
                  <Ionicons name={s.icon} size={18} color="#3B82F6" />
                </View>
                <Text style={styles.suggestionText}>{s.text}</Text>
                <Ionicons name="arrow-forward" size={14} color="#334155" style={{ marginTop: 8 }} />
              </TouchableOpacity>
            ))}
          </View>
        </Animated.ScrollView>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item, index) => item._id?.toString() || index.toString()}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
        />
      )}

      {/* Typing indicator */}
      {sending && (
        <View style={styles.typingWrapper}>
          <LinearGradient colors={["#1E40AF", "#3B82F6"]} style={styles.assistantAvatar}>
            <Ionicons name="sparkles" size={13} color="#fff" />
          </LinearGradient>
          <View style={styles.typingBubble}>
            <TypingDots />
          </View>
        </View>
      )}

      {/* Input bar */}
      <View style={styles.inputBar}>
        <View style={styles.inputContainer}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Message your assistant…"
            placeholderTextColor="#475569"
            multiline
            maxLength={2000}
          />

          <TouchableOpacity
            style={[
              styles.sendBtn,
              input.trim() && !sending ? styles.sendBtnActive : styles.sendBtnInactive,
            ]}
            onPress={() => sendMessage()}
            disabled={!input.trim() || sending}
            activeOpacity={0.8}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="arrow-up" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.disclaimer}>
          AI responses may be inaccurate. Always verify financial data.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0F172A",
  },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  loadingText: {
    color: "#64748B",
    fontSize: 14,
    marginTop: 8,
  },

  // ── Header ──────────────────────────────────────────────
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
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#F1F5F9",
  },
  headerStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#22C55E",
  },
  statusText: {
    fontSize: 11,
    color: "#22C55E",
    fontWeight: "600",
  },

  // ── Empty state ──────────────────────────────────────────
  emptyContainer: {
    flexGrow: 1,
    padding: 24,
    alignItems: "center",
    paddingTop: 48,
  },
  emptyIconWrapper: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#1E3A8A44",
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#F1F5F9",
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 300,
    marginBottom: 36,
  },
  suggestionsLabel: {
    alignSelf: "flex-start",
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 14,
  },
  suggestionsGrid: {
    width: "100%",
    gap: 10,
  },
  suggestionCard: {
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1E293B",
    borderRadius: 18,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  suggestionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#1E3A8A22",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
    color: "#CBD5E1",
    fontWeight: "500",
    lineHeight: 20,
  },

  // ── Messages ─────────────────────────────────────────────
  messageList: {
    padding: 16,
    paddingBottom: 12,
  },
  msgWrapper: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 14,
    gap: 8,
  },
  msgWrapperUser: {
    justifyContent: "flex-end",
  },
  msgWrapperAssistant: {
    justifyContent: "flex-start",
  },
  assistantAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginBottom: 2,
  },
  bubble: {
    maxWidth: "78%",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  bubbleUser: {
    backgroundColor: "#2563EB",
    borderBottomRightRadius: 5,
  },
  bubbleAssistant: {
    backgroundColor: "#1E293B",
    borderBottomLeftRadius: 5,
    borderWidth: 1,
    borderColor: "#334155",
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 23,
    letterSpacing: 0.1,
  },
  bubbleTextUser: {
    color: "#EFF6FF",
  },
  bubbleTextAssistant: {
    color: "#E2E8F0",
  },

  // ── Typing ───────────────────────────────────────────────
  typingWrapper: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  typingBubble: {
    backgroundColor: "#1E293B",
    borderRadius: 20,
    borderBottomLeftRadius: 5,
    borderWidth: 1,
    borderColor: "#334155",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  typingDots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 12,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#3B82F6",
  },

  // ── Input bar ────────────────────────────────────────────
  inputBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 32 : 18,
    borderTopWidth: 1,
    borderColor: "#1E293B",
    gap: 8,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: "#1E293B",
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "#334155",
    paddingLeft: 18,
    paddingRight: 6,
    paddingVertical: 6,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: "#F1F5F9",
    maxHeight: 120,
    paddingVertical: 8,
    lineHeight: 22,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  sendBtnActive: {
    backgroundColor: "#2563EB",
  },
  sendBtnInactive: {
    backgroundColor: "#1E3A5F",
  },
  disclaimer: {
    textAlign: "center",
    fontSize: 11,
    color: "#334155",
    lineHeight: 16,
  },
});
