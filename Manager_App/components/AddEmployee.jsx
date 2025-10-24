import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, I18nManager, ScrollView } from "react-native";
import DropDownPicker from "react-native-dropdown-picker"
import axios from "axios";
import api from "../services/api";
import { useNavigation, useRoute } from "@react-navigation/native";

const isRTL = I18nManager.isRTL;

const AddEmployee = () => {
   const navigation = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    role: "",
    phone: "",
    email: "",
    salaryType: "hourly",
    salaryRate: "",
    totalHoursWorked: "",
    totalDaysWorked: "",
    photoUrl: "",
  });
  const [open, setOpen] = useState(false);

  const handleChange = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.role || !formData.salaryRate) {
      Alert.alert("שגיאה", "אנא מלא את כל השדות החיוניים");
      return;
    }

    try {
      await api.post("/addEmployee", formData);
      Alert.alert("נוסף בהצלחה", "העובד נוסף למערכת");
      setFormData({
        name: "",
        role: "",
        phone: "",
        email: "",
        salaryType: "hourly",
        salaryRate: "",
        totalHoursWorked: "",
        totalDaysWorked: "",
        photoUrl: "",
      });
    } catch (error) {
      console.error(error);
      Alert.alert("שגיאה", "לא ניתן להוסיף את העובד");
    }
    navigation.navigate(-1);
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>הוסף עובד חדש</Text>

      <TextInput
        style={styles.input}
        placeholder="שם מלא"
        value={formData.name}
        onChangeText={(text) => handleChange("name", text)}
      />

      <TextInput
        style={styles.input}
        placeholder="תפקיד"
        value={formData.role}
        onChangeText={(text) => handleChange("role", text)}
      />

      <TextInput
        style={styles.input}
        placeholder="טלפון"
        value={formData.phone}
        onChangeText={(text) => handleChange("phone", text)}
        keyboardType="phone-pad"
      />

      <TextInput
        style={styles.input}
        placeholder="אימייל"
        value={formData.email}
        onChangeText={(text) => handleChange("email", text)}
        keyboardType="email-address"
      />

      <View style={{ width: "100%", marginVertical: 8 }}>
  <Text style={styles.label}>סוג שכר:</Text>
  <DropDownPicker
    open={open}
    value={formData.salaryType}
    items={[
      { label: "לפי שעה", value: "hourly" },
      { label: "לפי יום", value: "daily" },
    ]}
    setOpen={setOpen}
    setValue={(callback) => handleChange("salaryType", callback(formData.salaryType))}
    placeholder="בחר סוג שכר"
    style={{ borderColor: "#ddd", backgroundColor: "#fff" }}
    dropDownContainerStyle={{ borderColor: "#ddd" }}
  />
</View>


      <TextInput
        style={styles.input}
        placeholder="שיעור שכר (₪)"
        value={formData.salaryRate}
        onChangeText={(text) => handleChange("salaryRate", text)}
        keyboardType="numeric"
      />

      <TouchableOpacity style={styles.button} onPress={handleSubmit}>
        <Text style={styles.buttonText}>הוסף עובד</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: "#F9F9F9",
    alignItems: "center",
    direction: isRTL ? "rtl" : "ltr",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 20,
    color: "#333",
  },
  input: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    marginVertical: 8,
    fontSize: 16,
    textAlign: isRTL ? "right" : "left",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  pickerContainer: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 10,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  label: {
    fontSize: 16,
    marginStart: 10,
    marginTop: 6,
    color: "#444",
  },
  picker: {
    width: "100%",
  },
  button: {
    width: "100%",
    backgroundColor: "#007AFF",
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 20,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
});

export default AddEmployee;
