import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRoute } from "@react-navigation/native";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
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
  }, [activeConvId, fadeAnim]);

  useEffect(() => {
    loadAgent();
  }, [loadAgent]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 120);
    }
  }, [messages]);

  const saveBase64File = async (attachment, mimeType, dialogTitle, uti) => {
    const fileUri = FileSystem.documentDirectory + attachment.filename;
    const serverUrl = process.env.EXPO_PUBLIC_SERVER_URL || "https://manager-production-1942.up.railway.app";
    const downloadUrl = attachment.downloadUrl
      ? `${serverUrl}${attachment.downloadUrl}`
      : null;

    if (downloadUrl) {
      const token = await require("@react-native-async-storage/async-storage").default.getItem("token");
      const result = await FileSystem.downloadAsync(downloadUrl, fileUri, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (result.status !== 200) throw new Error("Download failed");
    } else if (attachment.base64) {
      await FileSystem.writeAsStringAsync(fileUri, attachment.base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
    } else {
      throw new Error("No file data available");
    }

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(fileUri, { mimeType, dialogTitle, UTI: uti });
    } else {
      Alert.alert("File saved", `Saved to: ${fileUri}`);
    }
  };

  const saveTextFile = async (attachment) => {
    const fileUri = FileSystem.documentDirectory + attachment.filename;
    await FileSystem.writeAsStringAsync(fileUri, attachment.content || "", {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(fileUri, {
        mimeType: "text/csv",
        dialogTitle: "Download CSV",
        UTI: "public.comma-separated-values-text",
      });
    } else {
      Alert.alert("CSV saved", `Saved to: ${fileUri}`);
    }
  };

  const openFileAttachment = async (attachment) => {
    try {
      if (!attachment) return;

      if (attachment.type === "pdf") {
        await saveBase64File(
          attachment,
          "application/pdf",
          "Cash Flow Report",
          "com.adobe.pdf"
        );
        return;
      }

      if (attachment.type === "excel") {
        await saveBase64File(
          attachment,
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Open Excel",
          "org.openxmlformats.spreadsheetml.sheet"
        );
        return;
      }

      if (attachment.type === "csv") {
        await saveTextFile(attachment);
      }
    } catch (err) {
      console.error("Attachment open error:", err);
      Alert.alert("Error", "Could not open the attachment.");
    }
  };

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
        attachment: res.data.attachment || null,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      if (res.data.attachment?.type === "pdf") {
        await openFileAttachment(res.data.attachment);
      }
    } catch (err) {
      console.error("Chat error:", err);
      Alert.alert("Error", "Failed to send message. Try again.");
      setMessages((prev) => prev.filter((m) => m._id !== userMsg._id));
    } finally {
      setSending(false);
    }
  };

  const handleAttachmentPick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/pdf",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "text/csv",
          "text/plain",
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.length) return;
      if (sending) return;

      const asset = result.assets[0];
      const formData = new FormData();
      formData.append("file", {
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType || "application/octet-stream",
      });
      if (activeConvId) formData.append("conversationId", activeConvId);

      setSending(true);

      const uploadRes = await api.post("/agent/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const extractedMessage = `[File: ${uploadRes.data.filename}] ${uploadRes.data.text || ""}`.trim();
      setSending(false);
      await sendMessage(extractedMessage);
    } catch (err) {
      console.error("File upload error:", err);
      Alert.alert("Error", "Failed to upload the file.");
      setSending(false);
    }
  };

  const renderAttachmentButton = (attachment) => {
    if (!attachment) return null;

    if (attachment.type === "pdf") {
      return (
        <TouchableOpacity
          style={styles.pdfBtn}
          onPress={() => openFileAttachment(attachment)}
          activeOpacity={0.8}
        >
          <Ionicons name="document-text" size={15} color="#2563EB" />
          <Text style={styles.pdfBtnText}>Open PDF Report</Text>
        </TouchableOpacity>
      );
    }

    if (attachment.type === "excel") {
      return (
        <TouchableOpacity
          style={styles.excelBtn}
          onPress={() => openFileAttachment(attachment)}
          activeOpacity={0.8}
        >
          <Ionicons name="grid" size={15} color="#16A34A" />
          <Text style={styles.excelBtnText}>Open Excel</Text>
        </TouchableOpacity>
      );
    }

    if (attachment.type === "csv") {
      return (
        <TouchableOpacity
          style={styles.csvBtn}
          onPress={() => openFileAttachment(attachment)}
          activeOpacity={0.8}
        >
          <Ionicons name="download-outline" size={15} color="#0891B2" />
          <Text style={styles.csvBtnText}>Download CSV</Text>
        </TouchableOpacity>
      );
    }

    return null;
  };

  const renderMessage = ({ item, index }) => {
    const isUser = item.role === "user";
    const isLast = index === messages.length - 1;

    return (
      <Animated.View
        style={[
          styles.msgWrapper,
          isUser ? styles.msgWrapperUser : styles.msgWrapperAssistant,
          isLast && { marginBottom: 4 },
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
          {renderAttachmentButton(item.attachment)}
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
      <LinearGradient
        colors={["#0F172A", "#0F172A", "#0F1F3D"]}
        style={StyleSheet.absoluteFill}
      />

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

      <View style={styles.inputBar}>
        <View style={styles.inputContainer}>
          <TouchableOpacity
            style={styles.attachBtn}
            onPress={handleAttachmentPick}
            disabled={sending}
            activeOpacity={0.8}
          >
            <Ionicons name="attach" size={22} color="#94A3B8" />
          </TouchableOpacity>

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
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 6,
    gap: 8,
  },
  attachBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#334155",
    flexShrink: 0,
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
  pdfBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#EFF6FF",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 10,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  pdfBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2563EB",
  },
  excelBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F0FDF4",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 10,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  excelBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#16A34A",
  },
  csvBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ECFEFF",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 10,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#A5F3FC",
  },
  csvBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0891B2",
  },
});
