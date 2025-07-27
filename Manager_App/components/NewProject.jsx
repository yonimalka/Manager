import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  Keyboard,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  I18nManager,
} from "react-native";
import axios from "axios";
import { useNavigation, useRoute } from "@react-navigation/native";
import { SERVER_URL } from "@env";
import Constants from 'expo-constants';

// const SERVER_URL = Constants.expoConfig.extra.SERVER_URL;

const NewProject = () => {
  
  const navigation = useNavigation();
  const route = useRoute();
  const userId = route.params?.userId;

  const [details, setDetails] = useState({
    name: "",
    days: "",
    payment: "",
    materialsList: [],
    toDoList: [],
  });

  const [inputValue, setInputValue] = useState("");
  const [inputCountValue, setInputCountValue] = useState("");
  const [materialsList, setMaterialsList] = useState([]);

  const [taskNameInput, setTaskNameInput] = useState("");
  const [taskDetailsInput, setTaskDetailsInput] = useState("");
  const [taskList, setTaskList] = useState([]);

  const handleSubmit = async () => {
    
    if (!details.name || !details.days || !details.payment) {
      Alert.alert("Missing Fields", "Please fill in all main project details.");
      return;
    }
    
    try {
      const newDetails = { ...details, materialsList, toDoList: taskList };
      await axios.post(`${SERVER_URL}/updateDetails/${userId}`, newDetails, {
        headers: { "Content-Type": "application/json" },
      });
      
      Alert.alert("Success", "Project added successfully!");
      setTimeout(() => {
      navigation.goBack();
    }, 200);
    } catch (error) {
      console.error("Submission error:", error);
      Alert.alert("Error", "Failed to add project.");
    }
    
  };

  const handleAddMaterial = () => {
    Keyboard.dismiss();
    if (inputValue && inputCountValue) {
      setMaterialsList([...materialsList, { item: inputValue.trim(), count: inputCountValue.trim() }]);
      setInputValue("");
      setInputCountValue("");
    }
  };

  const handleRemoveMaterial = (index) => {
    setMaterialsList(materialsList.filter((_, i) => i !== index));
  };

  const handleAddTask = () => {
    Keyboard.dismiss();
    if (taskNameInput) {
      setTaskList([...taskList, { task: taskNameInput.trim(), details: taskDetailsInput.trim() || "N/A" }]);
      setTaskNameInput("");
      setTaskDetailsInput("");
    }
  };

  const handleRemoveTask = (index) => {
    setTaskList(taskList.filter((_, i) => i !== index));
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#f8fafc" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
    <View style={styles.heading}>
        <Text style={styles.title}>פרוייקט חדש</Text>
      </View>
      <ScrollView contentContainerStyle={styles.container}>

        <TextInput
          style={styles.input}
          placeholder="שם הפרוייקט"
          value={details.name}
          onChangeText={(text) => setDetails({ ...details, name: text })}
        />
        <TextInput
          style={styles.input}
          placeholder="מספר ימים"
          keyboardType="numeric"
          value={details.days}
          onChangeText={(text) => setDetails({ ...details, days: text })}
        />
        <TextInput
          style={styles.input}
          placeholder="תשלום כולל"
          keyboardType="numeric"
          value={details.payment}
          onChangeText={(text) => setDetails({ ...details, payment: text })}
        />

        {/* Materials Section */}
        <Text style={styles.sectionTitle}>כתב כמויות</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 2 }]}
            placeholder="פריט"
            value={inputValue}
            onChangeText={setInputValue}
          />
          <TextInput
            style={[styles.input, { flex: 1, marginLeft: 8 }]}
            placeholder="כמות"
            keyboardType="numeric"
            value={inputCountValue}
            onChangeText={setInputCountValue}
          />
          <TouchableOpacity style={styles.addButton} onPress={handleAddMaterial}>
            <Text style={styles.addButtonText}>＋</Text>
          </TouchableOpacity>
        </View>
        {materialsList.map((mat, index) => (
          <View style={styles.itemRow} key={index}>
            <Text style={styles.itemText}>{mat.item} (x{mat.count})</Text>
            <TouchableOpacity onPress={() => handleRemoveMaterial(index)}>
              <Text style={styles.removeButton}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* Tasks Section */}
        <Text style={styles.sectionTitle}>משימות</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 2 }]}
            placeholder="משימה"
            value={taskNameInput}
            onChangeText={setTaskNameInput}
          />
          <TextInput
            style={[styles.input, { flex: 2, marginLeft: 8 }]}
            placeholder="תיאור המשימה"
            value={taskDetailsInput}
            onChangeText={setTaskDetailsInput}
          />
          <TouchableOpacity style={styles.addButton} onPress={handleAddTask}>
            <Text style={styles.addButtonText}>＋</Text>
          </TouchableOpacity>
        </View>
        {taskList.map((task, index) => (
          <View style={styles.itemRow} key={index}>
            <Text style={styles.itemText}>{task.task} - {task.details}</Text>
            <TouchableOpacity onPress={() => handleRemoveTask(index)}>
              <Text style={styles.removeButton}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}

      </ScrollView>
      {/* Submit */}
        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.submitText}>צור פרוייקט</Text>
        </TouchableOpacity>
    </KeyboardAvoidingView>
  );
};

const { width } = Dimensions.get("window");
const isRTL = I18nManager.isRTL;

  
const styles = StyleSheet.create({
  container: {
    paddingTop: 70,
    paddingStart: width * 0.05,
    paddingEnd: width * 0.05,
    paddingBottom: 40,
    flexGrow: 1,
    backgroundColor: "#f8fafc",
    
  },
  heading: {
    // paddingTop: 70,
    paddingVertical: 30,
    paddingRight: 30,
    marginLeft: 20,
    // paddingEnd: 50,
    marginVertical: 50,
    backgroundColor: "#3b49df",
    borderBottomRightRadius: 40,
    // alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#f1f5f9",
    textAlign: isRTL ? "left" : "right",
    marginBottom: 17,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1e293b",
    marginVertical: 16,
    textAlign: isRTL ? "left" : "right",
  },
  input: {
    backgroundColor: "#ffffff",
    borderColor: "#cbd5e1",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 15,
    fontSize: 16,
    marginBottom: 12,
    color: "#1e293b",
    textAlign: isRTL ? "right" : "left",
  },
  row: {
    flexDirection: isRTL ? "row" : "row-reverse",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  addButton: {
    backgroundColor: "#333",
    paddingVertical: 10,
    marginBottom: 13,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  addButtonText: {
    color: "#e0f2fe",
    fontSize: 20,
    fontWeight: "bold",
  },
  removeButton: {
    color: "#fb923c",
    fontSize: 20,
    fontWeight: "bold",
    paddingLeft: 10,
  },
  submitButton: {
    backgroundColor: "#3b49df",
    paddingVertical: 16,
    borderRadius: 12,
    // justifyContent: "center",
    alignItems: "center",
    // marginTop: 32,
    // marginEnd: 45,
    marginBottom: 30,
    marginHorizontal: 20,
  },
  submitText: {
    color: "#f1f5f9",
    fontSize: 18,
    fontWeight: "600",
  },
  itemRow: {
    flexDirection: isRTL ? "row" : "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#ffffff",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: "#00000010",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 1,
  },
  itemText: {
    textAlign: isRTL ? "left" : "right",
    fontSize: 16,
    color: "#1e293b",
    fontWeight: "500",
    flex: 1,
  },
});

export default NewProject;
