import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, FlatList, TouchableOpacity, StyleSheet,
  Image, Alert, Modal, Dimensions, TextInput, Animated,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../services/api";
import { generatePDF } from "./generatePdf";
import { useAuth } from "./useAuth";
import { generateIncomeReceiptPDF } from "../services/generateIncomePDF";
import IncomeReceiptGenerator from "./IncomeReceiptGenerator";
import Receipts from "./Receipts";

const { width } = Dimensions.get("window");

const AboutProject = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const project = route.params?.project;
  const projectId = project?._id;
  const shouldRefresh = route.params?.shouldRefresh;
  const { userId } = useAuth();

  const [projectDetails, setProjectDetails] = useState(null);
  const [expenses, setExpenses] = useState(0);
  const [receipts, setReceipts] = useState([]);
  const [showAllReceipts, setShowAllReceipts] = useState(false);
  const [toDoList, setToDoList] = useState([]);
  const [materialsArray, setMaterialsArray] = useState([]);
  const [incomeModalVisible, setIncomeModalVisible] = useState(false);
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [isAddingMaterial, setIsAddingMaterial] = useState(false);
  const [itemValue, setItemValue] = useState("");
  const [qtyValue, setQtyValue] = useState("");
  const [taskValue, setTaskValue] = useState("");
  const [detailsValue, setDetailsValue] = useState("");
  const [activeTab, setActiveTab] = useState("tasks");
  const [scrollY] = useState(new Animated.Value(0));

  const fetchProject = async () => {
    try {
      const response = await api.get(`/getProject/${projectId}`);
      setProjectDetails(response.data);
      setExpenses(response.data.expenses || 0);
      const receiptsResponse = await api.get(`/getReceipts/${projectId}`);
      setReceipts(receiptsResponse.data);
      // console.log(projectDetails)
    } catch (error) {
      console.error("Error fetching project details:", error);
    }
  };

  useEffect(() => {
    setToDoList(project?.toDoList || []);
    setMaterialsArray(project?.materials[0]?.items || []);
  }, [project]);

  useEffect(() => {
    if (!shouldRefresh) {
      fetchProject();
      navigation.setParams({ shouldRefresh: false });
    }
  }, [shouldRefresh]);

  const toggleCheck = async (item, index) => {
    const updatedList = toDoList.map((task, i) =>
      i === index ? { ...task, checked: !task.checked } : task
    );
    updatedList.sort((a, b) => a.checked - b.checked);
    setToDoList(updatedList);
    try {
      await api.post(`/updateTasks/${projectId}`, { ...item, checked: !item.checked });
    } catch (error) {
      console.error("Error updating task:", error);
    }
  };

  const handleAddTask = async () => {
    if (!taskValue || !detailsValue) return;
    const newItem = { task: taskValue, details: detailsValue };
    setToDoList([...toDoList, { ...newItem, checked: false }]);
    setTaskValue("");
    setDetailsValue("");
    try {
      await api.post(`/AddTask/${projectId}`, newItem);
    } catch (error) {
      console.error("Error adding task:", error);
    }
  };

  const handleAddMaterial = async () => {
    if (!itemValue || !qtyValue) return;
    const newItem = { item: itemValue, qty: qtyValue };
    setMaterialsArray([...materialsArray, newItem]);
    setItemValue("");
    setQtyValue("");
    try {
      await api.post(`/AddItem/${projectId}`, newItem);
    } catch (error) {
      console.error("Error adding product:", error);
    }
  };

  const submitIncomeReceipt = async (data) => {
    try {
      
      await api.post("/incomeReceipt", data);
      await api.post(`/updatePayment/${projectId}`, { paidAmount: data.amount });
      
      fetchProject();
    } catch (err) {
      console.error(err);
    }
  }

  const handleProjectDelete = async () => {
    Alert.alert("Delete Project", "Are you sure you want to delete this project?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            const res = await api.delete(`/deleteProject/${projectId}`);
            Alert.alert("Success", res.data.message);
            navigation.goBack();
          } catch (error) {
            console.error("Failed to delete project:", error);
            Alert.alert("Error", "Failed to delete project.");
          }
        },
      },
    ]);
  };

  const visibleReceipts = showAllReceipts ? receipts : receipts.slice(0, 6);
  const profit = (project?.paid || 0) - expenses;
  const profitPercentage = project?.payment ? ((profit / project.payment) * 100).toFixed(1) : 0;
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100], outputRange: [1, 0], extrapolate: "clamp",
  });

  return (
    <View style={s.screen}>
      <LinearGradient colors={["#3B82F6", "#F9FAFB"]} style={s.header}>
        <View style={s.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          {/* <View style={s.headerActions}>
            <TouchableOpacity style={s.headerIconButton}>
              <Ionicons name="star-outline" size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={s.headerIconButton}>
              <Ionicons name="ellipsis-vertical" size={22} color="#fff" />
            </TouchableOpacity>
          </View> */}
        </View>
        <Animated.View style={[s.headerContent, { opacity: headerOpacity }]}>
          <Text style={s.projectTitle}>{project?.name}</Text>
          <Text style={s.projectSubtitle}>
            {project?.days} days • Created {new Date(project?.createdAt).toLocaleDateString()}
          </Text>
        </Animated.View>
      </LinearGradient>

<Animated.ScrollView
  contentContainerStyle={s.scrollContent}
  showsVerticalScrollIndicator={false}
  onScroll={Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true }
  )}
  scrollEventThrottle={16}
>
        <View style={s.statsContainer}>
          <View style={s.statsRow}>
            <View style={s.statCard}>
              <LinearGradient colors={["#10B981", "#059669"]} style={s.statCardGradient}>
                <View style={s.statIconContainer}>
                  <Ionicons name="cash-outline" size={24} color="#fff" />
                </View>
                <Text style={s.statValue}>${projectDetails?.paid}</Text>
                <Text style={s.statLabel}>Total Payment</Text>
              </LinearGradient>
            </View>
            <View style={s.statCard}>
              <LinearGradient colors={["#EF4444", "#DC2626"]} style={s.statCardGradient}>
                <View style={s.statIconContainer}>
                  <Ionicons name="card-outline" size={24} color="#fff" />
                </View>
                <Text style={s.statValue}>${expenses}</Text>
                <Text style={s.statLabel}>Expenses</Text>
              </LinearGradient>
            </View>
          </View>
          <View style={s.profitCard}>
            <LinearGradient colors={profit >= 0 ? ["#3B82F6", "#2563EB"] : ["#F59E0B", "#D97706"]} style={s.profitCardGradient}>
              <View style={s.profitContent}>
                <View>
                  <Text style={s.profitLabel}>Net Profit</Text>
                  <Text style={s.profitValue}>${profit}</Text>
                </View>
                <View style={s.profitBadge}>
                  <Ionicons name={profit >= 0 ? "trending-up" : "trending-down"} size={20} color="#fff" />
                  <Text style={s.profitPercentage}>{profitPercentage}%</Text>
                </View>
              </View>
            </LinearGradient>
          </View>
        </View>

        <View style={s.tabContainer}>
          {["tasks", "materials", "receipts"].map((tab) => (
            <TouchableOpacity key={tab} style={[s.tab, activeTab === tab && s.tabActive]} onPress={() => setActiveTab(tab)}>
              <Ionicons
                name={tab === "tasks" ? "checkbox-outline" : tab === "materials" ? "cube-outline" : "receipt-outline"}
                size={20} color={activeTab === tab ? "#3B82F6" : "#9CA3AF"}
              />
              <Text style={[s.tabText, activeTab === tab && s.tabTextActive]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)} ({tab === "tasks" ? toDoList.length : tab === "materials" ? materialsArray.length : receipts.length})
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === "tasks" && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Task List</Text>
              <TouchableOpacity style={s.shareButton} onPress={() => generatePDF({ type: "tasks", data: { list: toDoList, name: project.name } })}>
                <Ionicons name="share-outline" size={20} color="#3B82F6" />
              </TouchableOpacity>
            </View>
            {toDoList.length === 0 && !isAddingTask ? (
              <View style={s.emptyState}>
                <Ionicons name="checkbox-outline" size={48} color="#D1D5DB" />
                <Text style={s.emptyText}>No tasks yet</Text>
                <Text style={s.emptySubtext}>Add your first task to get started</Text>
              </View>
            ) : (
              <FlatList data={toDoList} keyExtractor={(item, index) => index.toString()} scrollEnabled={false}
                renderItem={({ item, index }) => (
                  <TouchableOpacity onPress={() => toggleCheck(item, index)} style={s.taskItem} activeOpacity={0.7}>
                    <View style={s.taskCheckbox}>
                      <Ionicons name={item.checked ? "checkmark-circle" : "ellipse-outline"} size={28} color={item.checked ? "#10B981" : "#D1D5DB"} />
                    </View>
                    <View style={s.taskContent}>
                      <Text style={[s.taskTitle, item.checked && s.taskTitleChecked]}>{item.task}</Text>
                      <Text style={[s.taskDetails, item.checked && s.taskDetailsChecked]}>{item.details}</Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            )}
            {isAddingTask && (
              <View style={s.addItemContainer}>
                <TextInput placeholder="Task name" value={taskValue} onChangeText={setTaskValue} style={s.input} placeholderTextColor="#9CA3AF" />
                <TextInput placeholder="Task details" value={detailsValue} onChangeText={setDetailsValue} style={s.input} placeholderTextColor="#9CA3AF" multiline />
                <TouchableOpacity style={s.addButton} onPress={handleAddTask}>
                  <Text style={s.addButtonText}>Add Task</Text>
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity style={s.fab} onPress={() => setIsAddingTask((prev) => !prev)} activeOpacity={0.8}>
              <Ionicons name={isAddingTask ? "close" : "add"} size={28} color="#FFF" />
            </TouchableOpacity>
          </View>
        )}

        {activeTab === "materials" && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Materials</Text>
              <TouchableOpacity style={s.shareButton} onPress={() => generatePDF({ type: "materials", data: { list: materialsArray, name: project.name } })}>
                <Ionicons name="share-outline" size={20} color="#3B82F6" />
              </TouchableOpacity>
            </View>
            {materialsArray.length === 0 && !isAddingMaterial ? (
              <View style={s.emptyState}>
                <Ionicons name="cube-outline" size={48} color="#D1D5DB" />
                <Text style={s.emptyText}>No materials yet</Text>
                <Text style={s.emptySubtext}>Add materials needed for this project</Text>
              </View>
            ) : (
              <FlatList data={materialsArray} keyExtractor={(item, index) => index.toString()} scrollEnabled={false}
                renderItem={({ item }) => (
                  <View style={s.materialItem}>
                    <View style={s.materialIcon}>
                      <Ionicons name="cube" size={20} color="#3B82F6" />
                    </View>
                    <View style={s.materialContent}>
                      <Text style={s.materialName}>{item.item}</Text>
                      <Text style={s.materialQty}>Quantity: {item.qty}</Text>
                    </View>
                  </View>
                )}
              />
            )}
            {isAddingMaterial && (
              <View style={s.addItemContainer}>
                <TextInput placeholder="Item name" value={itemValue} onChangeText={setItemValue} style={s.input} placeholderTextColor="#9CA3AF" />
                <TextInput placeholder="Quantity" value={qtyValue} onChangeText={setQtyValue} keyboardType="numeric" style={s.input} placeholderTextColor="#9CA3AF" />
                <TouchableOpacity style={s.addButton} onPress={handleAddMaterial}>
                  <Text style={s.addButtonText}>Add Material</Text>
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity style={s.fab} onPress={() => setIsAddingMaterial((prev) => !prev)} activeOpacity={0.8}>
              <Ionicons name={isAddingMaterial ? "close" : "add"} size={28} color="#FFF" />
            </TouchableOpacity>
          </View>
        )}

        {activeTab === "receipts" && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Receipts Gallery</Text>
            {receipts.length === 0 ? (
              <View style={s.emptyState}>
                <Ionicons name="receipt-outline" size={48} color="#D1D5DB" />
                <Text style={s.emptyText}>No receipts uploaded</Text>
                <Text style={s.emptySubtext}>Upload receipt images to track expenses</Text>
              </View>
            ) : (
              <>
                <FlatList data={visibleReceipts} horizontal keyExtractor={(item) => item._id} showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.receiptsList}
                  renderItem={({ item }) => (
                    <TouchableOpacity onPress={() => navigation.navigate("ReceiptPreview", { item })} style={s.receiptCard}>
                      <Image source={{ uri: item.imageUrl }} style={s.receiptImage} />
                      <View style={s.receiptOverlay}>
                        <Ionicons name="eye-outline" size={24} color="#fff" />
                      </View>
                    </TouchableOpacity>
                  )}
                />
                {receipts.length > 6 && (
                  <TouchableOpacity style={s.toggleButton} onPress={() => setShowAllReceipts(!showAllReceipts)}>
                    <Text style={s.toggleButtonText}>{showAllReceipts ? "Show Less" : `Show All (${receipts.length})`}</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        )}

        <View style={s.actionButtons}>
          <TouchableOpacity style={s.actionButton} onPress={() => setIncomeModalVisible(true)}>
            <LinearGradient colors={["#10B981", "#059669"]} style={s.actionButtonGradient}>
              <Ionicons name="add-circle-outline" size={22} color="#fff" />
              <Text style={s.actionButtonText}>New Income Receipt</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionButton} onPress={() => setReceiptModalVisible(true)}>
            <LinearGradient colors={["#3B82F6", "#2563EB"]} style={s.actionButtonGradient}>
              <Ionicons name="cloud-upload-outline" size={22} color="#fff" />
              <Text style={s.actionButtonText}>Upload Receipt</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={s.deleteButton} onPress={handleProjectDelete}>
          <Ionicons name="trash-outline" size={20} color="#EF4444" />
          <Text style={s.deleteText}>Delete Project</Text>
        </TouchableOpacity>
      </Animated.ScrollView>

      <Modal visible={incomeModalVisible} animationType="fade" transparent onRequestClose={() => setIncomeModalVisible(false)}>
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <IncomeReceiptGenerator projectId={projectId} onSubmit={(data) => { submitIncomeReceipt(data); setIncomeModalVisible(false); }} onClose={() => setIncomeModalVisible(false)} />
          </View>
        </View>
      </Modal>

      <Modal visible={receiptModalVisible} transparent animationType="fade" statusBarTranslucent>
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <Receipts onClose={() => setReceiptModalVisible(false)} projectId={projectId} />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F9FAFB" },
  header: { paddingTop: 60, paddingBottom: 40, paddingHorizontal: 20,  },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255, 255, 255, 0.2)", alignItems: "center", justifyContent: "center" },
  headerActions: { flexDirection: "row", gap: 12 },
  headerIconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255, 255, 255, 0.2)", alignItems: "center", justifyContent: "center" },
  headerContent: { gap: 4 },
  projectTitle: { fontSize: 28, fontWeight: "800", color: "rgba(19, 16, 16, 0.8)" },
  projectSubtitle: { fontSize: 14, color: "rgba(19, 16, 16, 0.8)", fontWeight: "500" },
  scrollContent: { paddingBottom: 0 },
  statsContainer: { paddingHorizontal: 20, marginTop: 0, marginBottom: 24 },
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  statCard: { flex: 1, borderRadius: 20, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  statCardGradient: { padding: 20, minHeight: 140 },
  statIconContainer: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255, 255, 255, 0.2)", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  statValue: { fontSize: 24, fontWeight: "800", color: "#fff", marginBottom: 4 },
  statLabel: { fontSize: 13, color: "rgba(255, 255, 255, 0.9)", fontWeight: "600" },
  profitCard: { borderRadius: 20, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  profitCardGradient: { padding: 20 },
  profitContent: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  profitLabel: { fontSize: 14, color: "rgba(255, 255, 255, 0.9)", fontWeight: "600", marginBottom: 4 },
  profitValue: { fontSize: 32, fontWeight: "800", color: "#fff" },
  profitBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255, 255, 255, 0.2)", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  profitPercentage: { fontSize: 18, fontWeight: "700", color: "#fff" },
  tabContainer: { flexDirection: "row", paddingHorizontal: 20, gap: 8, marginBottom: 24 },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 12, backgroundColor: "#F3F4F6" },
  tabActive: { backgroundColor: "#E0F2FE" },
  tabText: { fontSize: 13, fontWeight: "600", color: "#9CA3AF" },
  tabTextActive: { color: "#3B82F6" },
  section: { backgroundColor: "#fff", marginHorizontal: 20, borderRadius: 20, padding: 20, marginBottom: 24, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  shareButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#E0F2FE", alignItems: "center", justifyContent: "center" },
  taskItem: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  taskCheckbox: { marginRight: 12 },
  taskContent: { flex: 1 },
  taskTitle: { fontSize: 16, fontWeight: "600", color: "#111827", marginBottom: 4 },
  taskTitleChecked: { textDecorationLine: "line-through", color: "#9CA3AF" },
  taskDetails: { fontSize: 14, color: "#6B7280" },
  taskDetailsChecked: { textDecorationLine: "line-through", color: "#D1D5DB" },
  materialItem: { flexDirection: "row", alignItems: "center", paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  materialIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#E0F2FE", alignItems: "center", justifyContent: "center", marginRight: 12 },
  materialContent: { flex: 1 },
  materialName: { fontSize: 16, fontWeight: "600", color: "#111827", marginBottom: 2 },
  materialQty: { fontSize: 14, color: "#6B7280" },
  receiptsList: { paddingVertical: 8 },
  receiptCard: { marginRight: 12, borderRadius: 16, overflow: "hidden", position: "relative" },
  receiptImage: { width: 160, height: 160, borderRadius: 16 },
  receiptOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0, 0, 0, 0.3)", alignItems: "center", justifyContent: "center", opacity: 0 },
  toggleButton: { marginTop: 12, paddingVertical: 10, alignItems: "center" },
  toggleButtonText: { fontSize: 14, fontWeight: "600", color: "#3B82F6" },
  emptyState: { alignItems: "center", paddingVertical: 40 },
  emptyText: { fontSize: 16, fontWeight: "600", color: "#6B7280", marginTop: 12 },
  emptySubtext: { fontSize: 14, color: "#9CA3AF", marginTop: 4 },
  addItemContainer: { marginTop: 16, gap: 12 },
  input: { backgroundColor: "#F9FAFB", borderRadius: 12, padding: 14, fontSize: 15, borderWidth: 1, borderColor: "#E5E7EB", color: "#111827" },
  addButton: { backgroundColor: "#3B82F6", borderRadius: 12, padding: 14, alignItems: "center" },
  addButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  fab: { marginTop: 16, backgroundColor: "#3B82F6", borderRadius: 28, width: 56, height: 56, justifyContent: "center", alignItems: "center", alignSelf: "flex-end", shadowColor: "#3B82F6", shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  actionButtons: { paddingHorizontal: 20, gap: 12, marginBottom: 24 },
  actionButton: { borderRadius: 16, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  actionButtonGradient: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16, paddingHorizontal: 24 },
  actionButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  deleteButton: { marginHorizontal: 20, marginBottom: 30, backgroundColor: "#FEF2F2", borderRadius: 12, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: "#FEE2E2" },
  deleteText: { color: "#EF4444", fontSize: 16, fontWeight: "600" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  modalCard: { width: "92%", height: "90%", backgroundColor: "#ffffff", borderRadius: 24, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 12, overflow: "hidden" },
});

export default AboutProject;