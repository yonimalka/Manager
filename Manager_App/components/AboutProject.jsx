import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  Modal,
  Dimensions,
  I18nManager,
  Platform,
  Share,
  TextInput
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
// import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Entypo from "@expo/vector-icons/Entypo";
import { Ionicons } from "@expo/vector-icons";
import * as Sharing from "expo-sharing";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SERVER_URL } from "@env";
import api from "../services/api";
import TasksInputModal from "./TasksInputModal";
import MaterialsInputModal from "./MaterialsInputModal";
import { generatePDF } from "./generatePdf";
import { useAuth } from "./useAuth";
import IncomeReceiptGenerator from "./IncomeReceiptGenerator";
import { generateIncomeReceiptPDF } from "../services/generateIncomePDF";

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
  const [showAll, setShowAll] = useState(false);
  const [toDoList, setToDoList] = useState([]);
  const [materialsArray, setMaterialsArray] = useState([]);
  const [visible, setVisible] = useState(false);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [isAddingMaterial, setIsAddingMaterial] = useState(false);
  const [itemValue, setItemValue] = useState("");
  const [qtyValue, setQtyValue] = useState("");
  const [taskValue, setTaskValue] = useState("");
  const [detailsValue, setDetailsValue] = useState("");
  // Fetch token once
  const getToken = async () => {
    return await AsyncStorage.getItem("token");
  };

  const fetchProject = async () => {
    try {
      const response = await api.get(`/getProject/${projectId}`);

      setProjectDetails(response.data);
      setExpenses(response.data.expenses || 0);

      const receiptsResponse = await api.get(`/getReceipts/${projectId}`);
      setReceipts(receiptsResponse.data);
    } catch (error) {
      console.error("Error fetching project details:", error);
    }
  };
  useEffect(() => {
    // fetchProject();
    // console.log(projectDetails);
    setToDoList(project?.toDoList || []);
    setMaterialsArray(project?.materials[0]?.items || []);
    
  }, [project]);

  useEffect(() => {
    if (!shouldRefresh) {
      // console.log("refreshing");
      
      fetchProject();
      navigation.setParams({ shouldRefresh: false });
    }
  }, [shouldRefresh]);

  const renderStatBlock = (label, value, variant) => {
  const gradients = {
    info: ["#E3F2FD", "#BBDEFB"],
    payment: ["#4ade80", "#10b981"],
    expenses: ["#f87171", "#ef4444"],
    default: ["#FAFAFA", "#F0F0F0"],
  };

  const gradientColors = gradients[variant] || gradients.default;


  return (
    <LinearGradient
      key={label}
      colors={gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.statBlock}
    >
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </LinearGradient>
  );
};

  const addReceipts = () => {
    navigation.navigate("Receipts", { projectId: projectId });
  };

  const toggleCheck = async (item, index) => {
    const updatedList = toDoList.map((task, i) =>
      i === index ? { ...task, checked: !task.checked } : task
    );
    updatedList.sort((a, b) => a.checked - b.checked);
    setToDoList(updatedList);

    try {
      const token = await getToken();
      await api.post(`/updateTasks/${projectId}`, {
        ...item,
        checked: !item.checked,
      });
    } catch (error) {
      console.error("Error updating task:", error);
    }
    !shouldRefresh;
  };

  const handleAddTask = async (newTask) => {
    setToDoList([...toDoList, { ...newTask, checked: false }]);
    const newItem = {
        task: taskValue,
        details: detailsValue
    }
    // console.log(newItem);
    // onSubmit(newItem);
    setTaskValue(null);
    setDetailsValue(null);
    try {
      const token = await AsyncStorage.getItem("token")
              await api.post(`/AddTask/${projectId}`, newItem);
            } catch (error) {
              console.error("Error adding task:", error);
            }
  };

  const handleAddMaterial = async (newItem) => {
    setMaterialsArray([...materialsArray, newItem]);
    setItemValue('');
    setQtyValue('');
    try {
      const token = AsyncStorage.getItem("token");
              await api.post(`/AddItem/${projectId}`, newItem);
            } catch (error) {
              console.error("Error adding product:", error);
            }  
  };

  const visibleReceipts = showAll ? receipts : receipts.slice(0, 6);
  async function submitIncomeReceipt(data) {
     try {
      const res = await api.post("/incomeReceipt", data); 
  
      const receipt = await res.data;
      console.log("Saved receipt:", receipt);
      const response = await api.get(`/getUser`);
      console.log(response.data);
      
      generateIncomeReceiptPDF(receipt);
    } catch (err) {
      console.error(err);
    }
  }
  const handleProjectDelete = async () => {
    Alert.alert(
      "Approve",
      "Are you sure you want to delete this project?",
      [
        { text: "cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const token = await getToken();
              const res = await api.delete(`/deleteProject/${projectId}`);
              Alert.alert(res.data.message);
              navigation.goBack();
            } catch (error) {
              console.error("Failed to delete project:", error);
              Alert.alert("error", "לא ניתן היה למחוק את הפרויקט.");
            }
          }
        }
      ]
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {/* Project Summary */}
      <View style={styles.projectCard}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialIcons
           name="arrow-back-ios" 
           size={24} 
           color="#374151" 
           style={{
            transform: [{ scaleX: I18nManager.isRTL ? -1 : 1 }],
            marginBottom: 40
           }}
           />
        </TouchableOpacity>
        <Text style={styles.projectTitle}>{project?.name}</Text>
         <View style={styles.projectStats}>
        {/* {renderStatBlock("ימים", project?.days, "info")} */}
        {renderStatBlock("Total payment", `${project?.payment}₪`, "payment")}
        {renderStatBlock("Expenses", `${expenses}₪`, "expenses")}
      </View>
      </View>

      {/* To-Do List */}
      <View style={styles.section}>
      <View style={styles.sectionTop}>
      <Text style={styles.sectionTitle}>Tasks</Text>
        <TouchableOpacity
                style={styles.shareButton}
                onPress={() => generatePDF({
  type: "tasks",
  data: {list: toDoList,
  name: project.name,}
})}
              >
                <Ionicons name="share-outline" size={25} color="#000" />
                {/* <Text style={[styles.actionText, { color: "#000" }]}>שתף</Text> */}
              </TouchableOpacity>
      </View>
        <View style={styles.tableHeader}>
          <Text style={[styles.cell, styles.headerText, { flex: 0.5 }]}>✔</Text>
          <Text style={[styles.cell, styles.headerText, { flex: 1 }]}>Category</Text>
          <Text style={[styles.cell, styles.headerText, { flex: 1.8 }]}>Items</Text>
        </View>

        <FlatList
          data={toDoList}
          keyExtractor={(item, index) => index.toString()}
          scrollEnabled={false}
          renderItem={({ item, index }) => (
            <View style={styles.row}  key={index}>
              <TouchableOpacity
                onPress={() => toggleCheck(item, index)}
                style={[styles.cell, { flex: 0.5 }]}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={item.checked ? "checkbox" : "square-outline"}
                  size={24}
                  color={item.checked ? "#2E7D32" : "#616161"}
                />
              </TouchableOpacity>
              <Text style={[styles.cell, styles.taskText, { flex: 1 }, item.checked && styles.checkedText]}>
                {item.task}
              </Text>
              <Text style={[styles.cell, styles.taskText, { flex: 1.8 }, item.checked && styles.checkedText]}>
                {item.details}
              </Text>
            </View>
          )}
        />
        {isAddingTask && (
  <View style={styles.expandContainer}>
    <TextInput
      placeholder="Task"
      value={taskValue}
      onChangeText={setTaskValue}
      style={styles.input}
    />

    <TextInput
      placeholder="Task Details"
      value={detailsValue}
      onChangeText={setDetailsValue}
      // keyboardType="numeric"
      style={styles.input}
    />

    <View style={styles.expandActions}>
      <TouchableOpacity
        style={styles.addBtn}
        onPress={() => {
          if (!taskValue || !detailsValue) return;

          handleAddTask({
            task: taskValue,
            details: detailsValue
          });
          // addTask();
          setTaskValue("");
          setDetailsValue("");
          // setIsAddingTask(false);
        }}
      >
        <Text style={styles.addText}>Add</Text>
      </TouchableOpacity>
    </View>
  </View>
)}

        <TouchableOpacity
  style={styles.fabButton}
  onPress={() => setIsAddingTask(prev => !prev)}
  activeOpacity={0.8}
>
  <Ionicons
    name={isAddingTask ? "close" : "add"}
    size={28}
    color="#FFF"
  />
</TouchableOpacity>
      </View>

      {/* Materials List */}
      <View style={styles.section}>
      <View style={styles.sectionTop}>
      <Text style={styles.sectionTitle}>Material List</Text>
        <TouchableOpacity
                style={styles.shareButton}
                onPress={() => generatePDF({
  type: "materials",
  data: {list: materialsArray,
  name: project.name}
})}
              >
                <Ionicons name="share-outline" size={25} color="#000" />
                {/* <Text style={[styles.actionText, { color: "#000" }]}>שתף</Text> */}
              </TouchableOpacity>
      </View>
        <View style={styles.tableHeader}>
          <Text style={[styles.cell, styles.headerText, { flex: 1 }]}>Qty</Text>
          <Text style={[styles.cell, styles.headerText, { flex: 2 }]}>Item</Text>
        </View>
        <FlatList
          data={materialsArray}
          keyExtractor={(item, index) => index.toString()}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={[styles.cell, styles.taskText, { flex: 1 }]}>{item.qty}</Text>
              <Text style={[styles.cell, styles.taskText, { flex: 2 }]}>{item.item}</Text>
            </View>
          )}
        />
        {isAddingMaterial && (
  <View style={styles.expandContainer}>
    <TextInput
      placeholder="Item"
      value={itemValue}
      onChangeText={setItemValue}
      style={styles.input}
    />

    <TextInput
      placeholder="Qty"
      value={qtyValue}
      onChangeText={setQtyValue}
      keyboardType="numeric"
      style={styles.input}
    />

    <View style={styles.expandActions}>
      <TouchableOpacity
        style={styles.addBtn}
        onPress={() => {
          if (!itemValue || !qtyValue) return;

          handleAddMaterial({
            item: itemValue,
            qty: qtyValue,
          });
          setItemValue("");
          setQtyValue("");
          // setIsAddingMaterial(false);
        }}
      >
        <Text style={styles.addText}>Add</Text>
      </TouchableOpacity>
    </View>
  </View>
)}

        <TouchableOpacity
  style={styles.fabButton}
  onPress={() =>{ setItemValue('')
    setQtyValue(''), setIsAddingMaterial(prev => !prev)}}
  activeOpacity={0.8}
>
  <Ionicons
    name={isAddingMaterial ? "close" : "add"}
    size={28}
    color="#FFF"
  />
</TouchableOpacity>
      </View>
      <View style={{ flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      {/* Open modal */}
      <TouchableOpacity
        onPress={() => setVisible(true)}
        style={{
          backgroundColor: "#10b981",
          // padding: 14,
          paddingVertical: 14,
          borderRadius: 28,
          margin: 16,
          alignItems: "center",
          justifyContent: "center",
          alignSelf: "center",
          marginBottom: 25,
          paddingStart: 24,
          paddingEnd: 24
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 18, marginStart: 10, marginEnd: 10, }}>
          New Income Receipt
        </Text>
      </TouchableOpacity>

      {/* Modal */}
      <Modal
  visible={visible}
  animationType="fade"
  transparent
  onRequestClose={() => setVisible(false)}
>
  <View style={styles.backdrop}>
    <View style={styles.modalCard}>
      <IncomeReceiptGenerator
        onSubmit={(data) => {
          submitIncomeReceipt(data)
          setVisible(false);
        }}
        onClose={() => setVisible(false)}
      />
    </View>
  </View>
</Modal>
{/* Upload Receipt Button */}
      <TouchableOpacity style={styles.uploadButton} onPress={addReceipts} activeOpacity={0.8}>
        <Ionicons name="cloud-upload-outline" size={22} color="#FFF" />
        <Text style={styles.uploadButtonText}>upload receipt</Text>
      </TouchableOpacity>
    </View>

      {/* Receipts Gallery */}
      <View style={styles.section}>
        <TouchableOpacity onPress={() => setShowAll(!showAll)}>
          <Text style={styles.toggleText}>{showAll ? "show more" : "show less"}</Text>
        </TouchableOpacity>
        <FlatList
          data={visibleReceipts}
          horizontal
          keyExtractor={(item) => item._id}
          key={(item) => item._id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: 10 }}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => navigation.navigate("ReceiptPreview", { item })}>
              <Image source={{ uri: item.imageUrl }} style={styles.receiptImage} resizeMode="cover" />
            </TouchableOpacity>
          )}
        />
      </View>

      <TouchableOpacity style={styles.deleteButton} onPress={handleProjectDelete}>
        <Text style={styles.deleteText}>Delete Project</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const StatBlock = ({ label, value }) => (
  <View style={styles.statBlock}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const { width } = Dimensions.get("window");
const isRTL = I18nManager.isRTL;

const styles = StyleSheet.create({
  container: {
    paddingTop: 50,
    paddingStart: width * 0.05,
    paddingEnd: width * 0.05,
    paddingBottom: 40,
    backgroundColor: "#F9F9F9",
    flexGrow: 1,
  },
  projectCard: { borderRadius: 16, paddingVertical: 18, marginBottom: 30 },
  projectTitle: { fontSize: 26, fontWeight: "700", color: "#333", marginBottom: 20, textAlign: !isRTL ? "left" : "right" },
  projectStats: { flexDirection: !isRTL ? "row" : "row-reverse", justifyContent: "space-between",},
   statBlock: {
    position: "relative",
    flex: 1,
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 6,
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.18,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      },
      android: {
        elevation: 4,
        shadowColor: "#000",
      },
    }),
  },
  statValue: {
    fontSize: 25,
    fontWeight: "700",
    color: "#fff",
    textAlign: !isRTL ? "left" : "right",
  },
  statLabel: {
    fontSize: 15,
    color: "#fff",
    marginTop: 4,
    textAlign: !isRTL ? "left" : "right",
  },
  sectionTop: {
    flexDirection: "row",
    position: '',
    justifyContent: "space-between",
    // backgroundColor: "#999",
    
  },
  shareButton: {
    // alignSelf: "flex-start",

  },
  section: { backgroundColor: "#FFF", borderRadius: 16, padding: 18, marginBottom: 30, ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.18,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      },
      android: {
        elevation: 4,
        shadowColor: "#000",
      },
    }),},
  sectionTitle: { fontSize: 22, fontWeight: "700", color: "#444", marginBottom: 18, textAlign: !isRTL ? "left" : "right" },
  tableHeader: { flexDirection: !isRTL ? "row" : "row-reverse", borderBottomWidth: 1, borderColor: "#E0E0E0", paddingBottom: 10, marginBottom: 10 },
  row: { flexDirection: !isRTL ? "row" : "row-reverse", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderColor: "#F0F0F0" },
  cell: { color: "#424242", fontSize: 16, textAlign: !isRTL ? "left" : "right", paddingStart: 12, paddingEnd: 12 },
  headerText: { fontWeight: "700", color: "#666", fontSize: 17, textAlign: !isRTL ? "left" : "right" },
  taskText: { color: "#222", textAlign: !isRTL ? "left" : "right" },
  checkedText: { textDecorationLine: "line-through", color: "#999", textAlign: !isRTL ? "left" : "right" },
  fabButton: { bottom: 0, marginTop: 10, backgroundColor: "#333", borderRadius: 28, width: 56, height: 56, justifyContent: "center", alignItems: "center", flexDirection: !isRTL ? "row" : "row-reverse", alignSelf: !isRTL ? "flex-end" : "flex-start" },
  uploadButton: { backgroundColor: "#1a73e8", paddingVertical: 14, borderRadius: 28, flexDirection: !isRTL ? "row" : "row-reverse", justifyContent: "center", alignItems: "center", alignSelf: "center", marginBottom: 25, paddingStart: 24, paddingEnd: 24 },
  uploadButtonText: { color: "#FFF", fontWeight: "700", fontSize: 18, marginStart: 10, marginEnd: 10, textAlign: !isRTL ? "left" : "right" },
  toggleText: { color: "#555", fontWeight: "700", fontSize: 16, textAlign: "center", marginBottom: 14 },
  receiptImage: { width: 140, height: 140, marginStart: !isRTL ? 16 : 0, marginEnd: isRTL ? 0 : 16, borderRadius: 14, backgroundColor: "#F0F0F0" },
  deleteButton: { backgroundColor: "#fff0f0", padding: 14, borderRadius: 12, alignItems: "center", ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.18,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      },
      android: {
        elevation: 4,
        shadowColor: "#000",
      },
    }), },
    expandContainer: {
  marginTop: 12,
  backgroundColor: "#F8F8F8",
  padding: 12,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: "#E0E0E0",
},

input: {
  backgroundColor: "#FFF",
  borderRadius: 8,
  paddingHorizontal: 12,
  paddingVertical: 10,
  fontSize: 16,
  borderWidth: 1,
  borderColor: "#DDD",
  marginBottom: 8,
},

expandActions: {
  flexDirection: "row",
  justifyContent: "flex-end",
  gap: 12,
  marginTop: 4,
},

cancelBtn: {
  paddingVertical: 8,
  paddingHorizontal: 12,
},

cancelText: {
  color: "#999",
  fontSize: 16,
},

addBtn: {
  backgroundColor: "#0A7AFF",
  paddingVertical: 8,
  paddingHorizontal: 16,
  borderRadius: 8,
},

addText: {
  color: "#FFF",
  fontSize: 16,
  fontWeight: "600",
},
  deleteText: { color: "#d32f2f",
  textAlign: !isRTL ? "right" : "left" 
  },
   backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",          
    alignItems: "center",
  },

  modalCard: {
    width: "92%",
    maxHeight: "90%",
    backgroundColor: "#ffffff",
    borderRadius: 24,

    // Shadow (iOS)
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },

    // Shadow (Android)
    elevation: 12,

    overflow: "hidden", 
  }
});

export default AboutProject;
