// React Native version visually matched to Claude's web design (iOS / Tailwind-like)
// Focus: cards, spacing, colors, rounded corners, subtle shadows, section headers

import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Keyboard,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  I18nManager,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../services/api";
import { Folder, Calendar, DollarSign, Package, CheckSquare, Plus, X } from "lucide-react-native";

const { width } = Dimensions.get("window");
const isRTL = I18nManager.isRTL;

const NewProject = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const userId = route.params?.userId;

  const [details, setDetails] = useState({
    name: "",
    days: "",
    payment: "",
  });

  const [materialItem, setMaterialItem] = useState("");
  const [materialQty, setMaterialQty] = useState("");
  const [materialsList, setMaterialsList] = useState([]);

  const [taskName, setTaskName] = useState("");
  const [taskDetails, setTaskDetails] = useState("");
  const [taskList, setTaskList] = useState([]);

  const handleSubmit = async () => {
    if (!details.name || !details.days || !details.payment) {
      Alert.alert("Missing Fields", "Please fill in all main project details.");
      return;
    }

    try {
      const token = await AsyncStorage.getItem("token");
      await api.post("/newProject", {
        ...details,
        materialsList,
        toDoList: taskList,
        userId,
      });

      Alert.alert("Success", "Project added successfully!");
      navigation.goBack();
    } catch (err) {
      Alert.alert("Error", "Failed to add project");
    }
  };

  const addMaterial = () => {
    Keyboard.dismiss();
    if (!materialItem || !materialQty) return;
    setMaterialsList([
      ...materialsList,
      { item: materialItem.trim(), qty: materialQty.trim() },
    ]);
    setMaterialItem("");
    setMaterialQty("");
  };

  const addTask = () => {
    Keyboard.dismiss();
    if (!taskName) return;
    setTaskList([
      ...taskList,
      { task: taskName.trim(), details: taskDetails.trim() },
    ]);
    setTaskName("");
    setTaskDetails("");
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#F9FAFB" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.headerBlock}>
          <Text style={styles.headerTitle}>New Project</Text>
          <Text style={styles.headerSubtitle}>Create and configure your project</Text>
        </View>

        {/* Project Details */}
        <View style={styles.card}>
          <SectionHeader icon={<Folder size={20} color="#2563EB" />} title="Project Details" />

          <Label text="Project Name" />
          <Input value={details.name} onChangeText={(t) => setDetails({ ...details, name: t })} placeholder="Enter project name" />

          <View style={styles.gridRow}>
            <View style={{ flex: 1 }}>
              <Label text="Duration (Days)" />
              <IconInput icon={<Calendar size={18} color="#9CA3AF" />} value={details.days} onChangeText={(t) => setDetails({ ...details, days: t })} placeholder="30" />
            </View>
            <View style={{ flex: 1 }}>
              <Label text="Total Payment" />
              <IconInput icon={<DollarSign size={18} color="#9CA3AF" />} value={details.payment} onChangeText={(t) => setDetails({ ...details, payment: t })} placeholder="10000" />
            </View>
          </View>
        </View>

        {/* Materials */}
        <View style={styles.card}>
          <SectionHeader icon={<Package size={20} color="#7C3AED" />} title="Materials" />

          <View style={styles.inlineRow}>
            <Input style={{ flex: 1 }} value={materialItem} onChangeText={setMaterialItem} placeholder="Material name" />
            <Input style={{ width: 90 }} value={materialQty} onChangeText={setMaterialQty} placeholder="Qty" keyboardType="numeric" />
            <AddButton color="#7C3AED" onPress={addMaterial} />
          </View>

          {materialsList.map((m, i) => (
            <ListItem key={i} dotColor="#7C3AED" text={`${m.item}  ·  Qty ${m.qty}`} onRemove={() => setMaterialsList(materialsList.filter((_, x) => x !== i))} />
          ))}
        </View>

        {/* Tasks */}
        <View style={styles.card}>
          <SectionHeader icon={<CheckSquare size={20} color="#16A34A" />} title="Tasks" />

          <Input value={taskName} onChangeText={setTaskName} placeholder="Task name" />
          <View style={styles.inlineRow}>
            <Input style={{ flex: 1 }} value={taskDetails} onChangeText={setTaskDetails} placeholder="Task details" />
            <AddButton color="#16A34A" onPress={addTask} />
          </View>

          {taskList.map((t, i) => (
            <ListItem key={i} dotColor="#16A34A" text={`${t.task} — ${t.details}`} onRemove={() => setTaskList(taskList.filter((_, x) => x !== i))} />
          ))}
        </View>

        <TouchableOpacity style={[styles.submitButton, !(details.name && details.days && details.payment) && { opacity: 0.4 }]} disabled={!(details.name && details.days && details.payment)} onPress={handleSubmit}>
          <Text style={styles.submitText}>Create Project</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

/* ---------- Small UI helpers ---------- */

const SectionHeader = ({ icon, title }) => (
  <View style={styles.sectionHeader}>
    <View style={styles.iconBubble}>{icon}</View>
    <Text style={styles.sectionTitle}>{title}</Text>
  </View>
);

const Label = ({ text }) => <Text style={styles.label}>{text}</Text>;

const Input = (props) => <TextInput {...props} style={[styles.input, props.style]} placeholderTextColor="#C7C7CC" />;

const IconInput = ({ icon, ...props }) => (
  <View style={styles.iconInputWrap}>
    {icon}
    <TextInput {...props} style={styles.iconInput} placeholderTextColor="#C7C7CC" />
  </View>
);

const AddButton = ({ onPress, color }) => (
  <TouchableOpacity onPress={onPress} style={[styles.addButton, { backgroundColor: color }]}>
    <Plus size={20} color="#fff" />
  </TouchableOpacity>
);

const ListItem = ({ text, onRemove, dotColor }) => (
  <View style={styles.listItem}>
    <View style={styles.listLeft}>
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <Text style={styles.listText}>{text}</Text>
    </View>
    <TouchableOpacity onPress={onRemove}>
      <X size={18} color="#9CA3AF" />
    </TouchableOpacity>
  </View>
);

/* ---------- Styles ---------- */

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingVertical: 45,
  },
  headerBlock: {
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: "#111827",
  },
  headerSubtitle: {
    marginTop: 4,
    color: "#6B7280",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  iconBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#111827",
    marginBottom: 10,
  },
  iconInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  iconInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  gridRow: {
    flexDirection: "row",
    gap: 12,
  },
  inlineRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  addButton: {
    width: 45,
    height: 45,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginBottom:10,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    padding: 12,
    marginTop: 8,
  },
  listLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  listText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#111827",
  },
  submitButton: {
    backgroundColor: "#2563EB",
    paddingVertical: 16,
    borderRadius: 18,
    marginTop: 8,
    shadowColor: "#2563EB",
    shadowOpacity: 0.3,
    shadowRadius: 20,
    alignItems: "center",
  },
  submitText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
});

export default NewProject;
