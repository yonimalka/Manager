import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import api from "../services/api";

const TASK_TYPES = [
  { value: "quote", label: "Quote", icon: "document-text-outline", color: "#2563EB" },
  { value: "report", label: "Report", icon: "bar-chart-outline", color: "#7C3AED" },
  { value: "summary", label: "Summary", icon: "list-outline", color: "#059669" },
  { value: "invoice", label: "Invoice", icon: "receipt-outline", color: "#D97706" },
  { value: "custom", label: "Custom", icon: "sparkles-outline", color: "#64748B" },
];

export default function AgentTasks() {
  const navigation = useNavigation();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  const [type, setType] = useState("custom");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/agent/tasks");
      setTasks(res.data || []);
    } catch (err) {
      console.error("AgentTasks load error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createTask = async () => {
    if (!title.trim()) {
      Alert.alert("Required", "Please enter a task title.");
      return;
    }

    try {
      setCreating(true);
      const res = await api.post("/agent/tasks", { type, title, description });
      setTasks((prev) => [res.data, ...prev]);
      setModalVisible(false);
      setTitle("");
      setDescription("");
      setType("custom");

      if (res.data.status === "completed") {
        setSelectedTask(res.data);
      }
    } catch (err) {
      console.error("Create task error:", err);
      Alert.alert("Error", "Failed to create task.");
    } finally {
      setCreating(false);
    }
  };

  const deleteTask = async (id) => {
    Alert.alert("Delete task", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await api.delete(`/agent/tasks/${id}`);
          setTasks((prev) => prev.filter((t) => t._id !== id));
          if (selectedTask?._id === id) setSelectedTask(null);
        },
      },
    ]);
  };

  const getTypeInfo = (value) =>
    TASK_TYPES.find((t) => t.value === value) || TASK_TYPES[4];

  const statusColor = (status) => {
    switch (status) {
      case "completed": return "#16A34A";
      case "failed": return "#DC2626";
      case "in_progress": return "#D97706";
      default: return "#64748B";
    }
  };

  const renderTask = ({ item }) => {
    const typeInfo = getTypeInfo(item.type);
    return (
      <TouchableOpacity
        style={styles.taskCard}
        onPress={() => setSelectedTask(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.taskIcon, { backgroundColor: typeInfo.color + "18" }]}>
          <Ionicons name={typeInfo.icon} size={18} color={typeInfo.color} />
        </View>
        <View style={styles.taskBody}>
          <Text style={styles.taskTitle} numberOfLines={1}>{item.title}</Text>
          <View style={styles.taskMeta}>
            <Text style={[styles.taskStatus, { color: statusColor(item.status) }]}>
              {item.status}
            </Text>
            <Text style={styles.taskDate}>
              {new Date(item.createdAt).toLocaleDateString()}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => deleteTask(item._id)} style={styles.deleteBtn}>
          <Ionicons name="trash-outline" size={16} color="#EF4444" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.title}>Tasks</Text>
        <TouchableOpacity
          style={styles.newBtn}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="add" size={22} color="#2563EB" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : tasks.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="checkmark-circle-outline" size={48} color="#CBD5E1" />
          <Text style={styles.emptyText}>No tasks yet</Text>
          <TouchableOpacity style={styles.startBtn} onPress={() => setModalVisible(true)}>
            <Text style={styles.startBtnText}>Create a task</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item._id}
          renderItem={renderTask}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Create Task Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Task</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Type</Text>
              <View style={styles.typeRow}>
                {TASK_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t.value}
                    style={[styles.typeChip, type === t.value && { backgroundColor: t.color, borderColor: t.color }]}
                    onPress={() => setType(t.value)}
                  >
                    <Ionicons name={t.icon} size={14} color={type === t.value ? "#fff" : t.color} />
                    <Text style={[styles.typeChipText, type === t.value && { color: "#fff" }]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Task</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Create a quote for client ABC"
                placeholderTextColor="#94A3B8"
                value={title}
                onChangeText={setTitle}
              />

              <Text style={styles.fieldLabel}>Details (optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Additional context or requirements..."
                placeholderTextColor="#94A3B8"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
              />

              <TouchableOpacity
                style={[styles.submitBtn, creating && styles.submitBtnDisabled]}
                onPress={createTask}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="sparkles" size={18} color="#fff" />
                    <Text style={styles.submitBtnText}>Run Task</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Task Result Modal */}
      {selectedTask && (
        <Modal visible={!!selectedTask} transparent animationType="slide">
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalSheet, { maxHeight: "85%" }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle} numberOfLines={1}>
                  {selectedTask.title}
                </Text>
                <TouchableOpacity onPress={() => setSelectedTask(null)}>
                  <Ionicons name="close" size={22} color="#64748B" />
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.resultBox}>
                  <Text style={styles.resultText}>
                    {selectedTask.resultText || selectedTask.result?.error || "No result yet."}
                  </Text>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 56,
    paddingBottom: 14,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderColor: "#E2E8F0",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
    color: "#0F172A",
  },
  newBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    color: "#94A3B8",
  },
  startBtn: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 8,
  },
  startBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  list: {
    padding: 16,
  },
  taskCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    gap: 12,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  taskIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  taskBody: { flex: 1 },
  taskTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0F172A",
    marginBottom: 4,
  },
  taskMeta: { flexDirection: "row", gap: 10 },
  taskStatus: { fontSize: 12, fontWeight: "600", textTransform: "capitalize" },
  taskDate: { fontSize: 12, color: "#94A3B8" },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.55)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
    flex: 1,
    marginRight: 12,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 8,
    marginTop: 16,
  },
  typeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
  },
  typeChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  input: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#0F172A",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: "top",
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#2563EB",
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 24,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  resultBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  resultText: {
    fontSize: 14,
    lineHeight: 22,
    color: "#0F172A",
  },
});
