import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  ScrollView,
  StyleSheet,
  I18nManager,
  Dimensions,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import axios from "axios";
import { SERVER_URL } from "@env";
import Constants from 'expo-constants';
import MaterialsInputModal from "./MaterialsInputModal";
import TaskInputModal from "./TasksInputModal";
import { Ionicons } from "@expo/vector-icons";
import WebView from "react-native-webview";

  // const SERVER_URL = Constants.expoConfig.extra.SERVER_URL;

const AboutProject = () => {

  const navigation = useNavigation();
  const route = useRoute();
  const project = route.params?.project;
  const projectId = project?._id;
  const shouldRefresh = route.params?.shouldRefresh;
  const userId = route.params?.userId;

  const [projectDetails, setProjectDetails] = useState(null);
  const [expenses, setExpenses] = useState(0);
  const [receipts, setReceipts] = useState([]);
  const [showAll, setShowAll] = useState(false);
  const [toDoList, setToDoList] = useState([]);
  const [materialsArray, setMaterialsArray] = useState([]);
  const [isTaskModalVisible, setTaskModalVisible] = useState(false);
  const [isMaterialsModalVisible, setMaterialsModalVisible] = useState(false);

  const fetchProject = async () => {
    try {
      const response = await axios.get(`${SERVER_URL}/getProject/${userId}/${projectId}`);
      setProjectDetails(response.data);
      setExpenses(response.data.expenses || 0);

      const receiptsResponse = await axios.get(`${SERVER_URL}/getReceipts/${userId}/${projectId}`);
      setReceipts(receiptsResponse.data);
    } catch (error) {
      console.error("Error fetching project details:", error);
    }
  };

  useEffect(() => {
    setToDoList(project?.toDoList || []);
    setMaterialsArray(project?.materials[0]?.items || []);
    fetchProject();
  }, [project]);

  useEffect(() => {
    if (shouldRefresh) {
      fetchProject();
      navigation.setParams({ shouldRefresh: false });
    }
  }, [shouldRefresh]);

  const addReceipts = () => {
    navigation.navigate("Receipts", { projectId, userId });
  };

  const toggleCheck = async (item, index) => {
    const updatedList = toDoList.map((task, i) =>
      i === index ? { ...task, checked: !task.checked } : task
    );
    updatedList.sort((a, b) => a.checked - b.checked);
    setToDoList(updatedList);

    try {
      await axios.post(`${SERVER_URL}/updateTasks/${userId}/${projectId}`, {
        ...item,
        checked: !item.checked,
      });
    } catch (error) {
      console.error("Error updating task:", error);
    }
  };

  const handleAddTask = (newTask) => {
    setToDoList([...toDoList, { ...newTask, checked: false }]);
    setTaskModalVisible(false);
  };

  const handleAddMaterial = (newItem) => {
    setMaterialsArray([...materialsArray, newItem]);
    setMaterialsModalVisible(false);
  };

  // const handleReceiptPress = (item) => {
  //   // console.log("item");
  //     navigation.navigate("ReceiptPreview", { item });
    
  // }

  const visibleReceipts = showAll ? receipts : receipts.slice(0, 6);

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {/* Project Summary */}
      <View style={styles.projectCard}>
        <Text style={styles.projectTitle}>{project?.name}</Text>
        <View style={styles.projectStats}>
          <StatBlock label="ימים" value={project?.days} />
          <StatBlock label="תשלום כולל" value={`${project?.payment}₪`} />
          <StatBlock label="הוצאות" value={`${expenses}₪`} />
        </View>
      </View>

      {/* To-Do List */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>משימות</Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.cell, styles.headerText, { flex: 0.5 }]}>✔</Text>
          <Text style={[styles.cell, styles.headerText, { flex: 1 }]}>קטגוריה</Text>
          <Text style={[styles.cell, styles.headerText, { flex: 1.8 }]}>פרטים</Text>
        </View>

        <FlatList
          data={toDoList}
          keyExtractor={(item, index) => index.toString()}
          scrollEnabled={false}
          renderItem={({ item, index }) => (
            <View style={styles.row}>
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
        <TouchableOpacity
          style={[styles.fabButton]}
          onPress={() => setTaskModalVisible(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={28} color="#FFF" />
        </TouchableOpacity>
        <TaskInputModal
          userId={userId}
          visible={isTaskModalVisible}
          onClose={() => setTaskModalVisible(false)}
          onSubmit={handleAddTask}
          projectId={projectId}
          TaskList={toDoList}
        />
      </View>

      {/* Materials List */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>כתב כמויות</Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.cell, styles.headerText, { flex: 1 }]}>כמות</Text>
          <Text style={[styles.cell, styles.headerText, { flex: 2 }]}>פריט</Text>
        </View>
        <FlatList
          data={materialsArray}
          keyExtractor={(item, index) => index.toString()}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={[styles.cell, styles.taskText, { flex: 1 }]}>{item.count}</Text>
              <Text style={[styles.cell, styles.taskText, { flex: 2 }]}>{item.item}</Text>
            </View>
          )}
        />
        <TouchableOpacity
          style={[styles.fabButton]}
          onPress={() => setMaterialsModalVisible(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={28} color="#FFF" />
        </TouchableOpacity>
        <MaterialsInputModal
          userId={userId}
          visible={isMaterialsModalVisible}
          onClose={() => setMaterialsModalVisible(false)}
          onSubmit={handleAddMaterial}
          projectId={projectId}
          materialsList={materialsArray}
        />
      </View>

      {/* Upload Receipt Button */}
      <TouchableOpacity
        style={styles.uploadButton}
        onPress={addReceipts}
        activeOpacity={0.8}
      >
        <Ionicons name="cloud-upload-outline" size={22} color="#FFF" />
        <Text style={styles.uploadButtonText}>העלאת חשבונית</Text>
      </TouchableOpacity>

      {/* Receipts Gallery */}
      <View style={styles.section}>
        <TouchableOpacity onPress={() => setShowAll(!showAll)}>
          <Text style={styles.toggleText}>
            {showAll ? "תראה פחות" : "תראה פחות"}
          </Text>
        </TouchableOpacity>
        <FlatList
          data={visibleReceipts}
          horizontal
          keyExtractor={(item) => item._id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: 10 }}
          renderItem={({ item }) => (
           <TouchableOpacity onPress={() => navigation.navigate("ReceiptPreview", { item })}>
            <Image
              source={{ uri: item.data }}
              style={styles.receiptImage}
              resizeMode="cover"
            />
           </TouchableOpacity>
            
          )}
        />
      </View>
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
    paddingTop: 70,
    paddingStart: width * 0.05,
    paddingEnd: width * 0.05,
    paddingBottom: 40,
    backgroundColor: "#F9F9F9",
    flexGrow: 1,
    // flexDirection: isRTL ? "row" : "row-reverse",
  },
  projectCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 30,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  projectTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#333",
    marginBottom: 20,
    textAlign: isRTL ? "left" : "right",
  },
  projectStats: {
    flexDirection: isRTL ? "row" : "row-reverse",
    justifyContent: "space-around",
  },
  statBlock: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 7,
    marginHorizontal: 1,
    alignItems: "center",
    backgroundColor: "#FAFAFA",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#212121",
    textAlign: isRTL ? "left" : "right",
  },
  statLabel: {
    fontSize: 14,
    color: "#616161",
    marginTop: 4,
    textAlign: isRTL ? "left" : "right",
  },
  section: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    marginBottom: 30,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#444",
    marginBottom: 18,
    textAlign: isRTL ? "left" : "right",
  },
  tableHeader: {
    flexDirection: isRTL ? "row" : "row-reverse",
    borderBottomWidth: 1,
    borderColor: "#E0E0E0",
    paddingBottom: 10,
    marginBottom: 10,
  },
  row: {
    flexDirection: isRTL ? "row" : "row-reverse",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: "#F0F0F0",
  },
  cell: {
    color: "#424242",
    fontSize: 16,
    textAlign: isRTL ? "left" : "right",
    paddingStart: 12,
    paddingEnd: 12,
  },
  headerText: {
    fontWeight: "700",
    color: "#666",
    fontSize: 17,
    textAlign: isRTL ? "left" : "right",
  },
  taskText: {
    color: "#222",
    textAlign: isRTL ? "left" : "right",
  },
  checkedText: {
    textDecorationLine: "line-through",
    color: "#999",
    textAlign: isRTL ? "left" : "right",
  },
  fabButton: {
    bottom: 0,
    marginTop: 10,
    backgroundColor: "#333",
    borderRadius: 28,
    width: 56,
    height: 56,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
    flexDirection: isRTL ? "row-reverse" : "row",
  },
  uploadButton: {
    backgroundColor: "#3b49df",
    paddingVertical: 14,
    borderRadius: 28,
    flexDirection: isRTL ? "row" : "row-reverse",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 25,
    paddingStart: 24,
    paddingEnd: 24,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  uploadButtonText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 18,
    marginStart: 10,
    marginEnd: 10,
    textAlign: isRTL ? "left" : "right",
  },
  toggleText: {
    color: "#555",
    fontWeight: "700",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 14,
  },
  receiptImage: {
    width: 140,
    height: 140,
    marginStart: isRTL ? 16 : 0,
    marginEnd: isRTL ? 0 : 16,
    borderRadius: 14,
    backgroundColor: "#F0F0F0",
  },
});




export default AboutProject;
