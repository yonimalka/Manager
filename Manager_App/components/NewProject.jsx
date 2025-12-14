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

    if (isNaN(Number(details.days)) || Number(details.days) <= 0) {
      Alert.alert("Invalid input", "Number of days must be a positive number.");
      return;
    }

    if (isNaN(Number(details.payment)) || Number(details.payment) <= 0) {
      Alert.alert("Invalid input", "Total payment must be a positive number.");
      return;
    }

    try {
      // תיקון קטן: קיבלנו את הטוקן עם await
      const token = await AsyncStorage.getItem("token");

      const newDetails = { ...details, materialsList, toDoList: taskList, userId };
      // אם ה־api זקוק לכותרת Authorization, ניתן להוסיף אותה ב־api instance או כאן
      await api.post(`/updateDetails`, newDetails);

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
      // שמור איך שהיית רוצה: משמרים פורמט הקודם (item, count)
      setMaterialsList([
        ...materialsList,
        { item: inputValue.trim(), count: inputCountValue.trim() },
      ]);
      setInputValue("");
      setInputCountValue("");
    } else {
      Alert.alert("Missing fields", "Please provide material name and quantity.");
    }
  };

  const handleRemoveMaterial = (index) => {
    setMaterialsList(materialsList.filter((_, i) => i !== index));
  };

  const handleAddTask = () => {
    Keyboard.dismiss();
    if (taskNameInput) {
      setTaskList([
        ...taskList,
        { task: taskNameInput.trim(), details: taskDetailsInput.trim() || "N/A" },
      ]);
      setTaskNameInput("");
      setTaskDetailsInput("");
    } else {
      Alert.alert("Missing field", "Please provide a task name.");
    }
  };

  const handleRemoveTask = (index) => {
    setTaskList(taskList.filter((_, i) => i !== index));
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#f0fdf4" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
    <LinearGradient
    colors={["#6ee7b7", "#10b981", "#059669"]}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 1 }}
    style={styles.header}
    >
      <View >
        <View style={styles.headerInner}>
          <Text style={styles.headerTitle}>פרוייקט חדש</Text>
          <Text style={styles.headerSubtitle}>מלא את פרטי הפרוייקט למטה</Text>
        </View>
      </View>
</LinearGradient>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Project Details Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>פרטי הפרוייקט</Text>

          <Text style={styles.label}>שם הפרוייקט</Text>
          <TextInput
            style={styles.input}
            placeholder="שם הפרוייקט"
            placeholderTextColor="#94a3b8"
            value={details.name}
            onChangeText={(text) => setDetails({ ...details, name: text })}
          />

          <Text style={styles.label}>מספר ימים</Text>
          <TextInput
            style={styles.input}
            placeholder="מספר ימים"
            placeholderTextColor="#94a3b8"
            keyboardType="numeric"
            value={details.days}
            onChangeText={(text) => setDetails({ ...details, days: text })}
          />

          <Text style={styles.label}>תשלום כולל</Text>
          <TextInput
            style={styles.input}
            placeholder="תשלום כולל"
            placeholderTextColor="#94a3b8"
            keyboardType="numeric"
            value={details.payment}
            onChangeText={(text) => setDetails({ ...details, payment: text })}
          />
        </View>

        {/* Materials Card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>כתב כמויות</Text>
          </View>

          <View style={styles.row}>
          
            <TextInput
              style={[styles.input, { flex: 2 } ]}
              placeholder="פריט"
              placeholderTextColor="#94a3b8"
              value={inputValue}
              onChangeText={setInputValue}
            />
            
            <TextInput
              style={[styles.input, { flex: 1, marginLeft: isRTL ? 0 : 8, marginRight: isRTL ? 8 : 0 }]}
              placeholder="כמות"
              placeholderTextColor="#94a3b8"
              keyboardType="numeric"
              value={inputCountValue}
              onChangeText={setInputCountValue}
            />
            <TouchableOpacity style={styles.fabAdd} onPress={handleAddMaterial}>
              <Text style={styles.fabAddText}>+</Text>
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

          {materialsList.length === 0 && (
            <Text style={styles.hintText}>אין חומרי גלם — הוסף אחד באמצעות השדות למעלה</Text>
          )}
        </View>

        {/* Tasks Card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>משימות</Text>
          </View>

          <View style={styles.row}>
            <TextInput
              style={[styles.input, { flex: 2 }]}
              placeholder="משימה"
              placeholderTextColor="#94a3b8"
              value={taskNameInput}
              onChangeText={setTaskNameInput}
            />
            <TextInput
              style={[styles.input, { flex: 2, marginLeft: isRTL ? 0 : 8, marginRight: isRTL ? 8 : 0 }]}
              placeholder="תיאור המשימה"
              placeholderTextColor="#94a3b8"
              value={taskDetailsInput}
              onChangeText={setTaskDetailsInput}
            />
            <TouchableOpacity style={styles.fabAdd} onPress={handleAddTask}>
              {/* <Text style={styles.smallAddButtonText}>+</Text> */}
              <Text style={styles.fabAddText}>＋</Text>
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

          {taskList.length === 0 && (
            <Text style={styles.hintText}>אין משימות — הוסף משימה חדשה</Text>
          )}
        </View>

        {/* Spacer to allow for scrolling above submit */}
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Submit */}
      <LinearGradient
      colors={["#6ee7b7", "#10b981", "#059669"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.submitButton}
      >
        <TouchableOpacity onPress={handleSubmit}>
        <Text style={styles.submitText}>צור פרוייקט</Text>
      </TouchableOpacity>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  header: {
    flex: 1,
    position: "relative",
    alignSelf: "center",
    minHeight: 100,
    alignItems: "center",
    width: 420,
    // backgroundColor: "#065f46", 
    justifyContent: "flex-end",
    paddingBottom: 28,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    // marginBottom: 10,
    // ...Platform.select({
    //   ios: {
    //     shadowColor: "#000",
    //     shadowOpacity: 0.18,
    //     shadowRadius: 8,
    //     shadowOffset: { width: 0, height: 2 },
    //   },
    //   android: {
    //     elevation: 4,
    //     shadowColor: "#000",
    //   },
    // }),
  },
  headerInner: {
    marginTop: 10,
  },
  headerTitle: {
    color: "#ecfccb",
    fontSize: 26,
    fontWeight: "700",
    textAlign: isRTL ? "left" : "right",
  },
  headerSubtitle: {
    color: "#bbf7d0",
    fontSize: 13,
    marginTop: 6,
    textAlign: isRTL ? "left" : "right",
  },
  container: {
    paddingTop: 18,
    paddingStart: width * 0.05,
    paddingEnd: width * 0.05,
    paddingBottom: 40,
    flexGrow: 1,
    backgroundColor: "#f0fdf4",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    shadowColor: "#00000010",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
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
  cardHeaderRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#000",
    textAlign: isRTL ? "left" : "right",
  },
  label: {
    color: "#666",
    marginTop: 10,
    marginBottom: 6,
    fontWeight: "600",
    textAlign: isRTL ? "left" : "right",
  },
  input: {
    backgroundColor: "#fff",
    borderColor: "#999",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    fontSize: 15,
    // marginBottom: ,
    color: "#0f172a",
    textAlign: isRTL ? "left" : "right",
  },
  row: {
    flexDirection: isRTL ? "row" : "row-reverse",
    alignItems: "center",
    // justifyContent: "center",
    gap: 8,
    marginBottom: 8,
  },
  fabAdd: {
    // alignSelf: "center",
    backgroundColor: "#10b981",
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 999,
    
  },
  fabAddText: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
  },
  smallAddButton: {
    backgroundColor: "#065f46",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginLeft: 8,
  },
  smallAddButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
  },
  itemRow: {
    flexDirection: isRTL ? "row" : "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#ffffff",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderColor: "#ecfdf5",
    borderWidth: 1,
  },
  itemText: {
    textAlign: isRTL ? "left" : "right",
    fontSize: 15,
    color: "#0f172a",
    fontWeight: "500",
    flex: 1,
  },
  removeButton: {
    color: "#ef4444",
    fontSize: 20,
    fontWeight: "700",
    paddingLeft: 10,
  },
  submitButton: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: "#065f46",
    paddingVertical: 16,
    borderRadius: 12,
    width: 300,
    alignItems: "center",
    justifyContent: "center",
    // marginHorizontal: 20,
    bottom: 30,
    
  },
  submitText: {
    color: "#ecfccb",
    fontSize: 18,
    fontWeight: "700",
  },
  hintText: {
    color: "#64748b",
    marginTop: 8,
    fontSize: 14,
    textAlign: isRTL ? "left" : "right",
  },
});

export default NewProject;
