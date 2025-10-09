import React, { useState } from "react";
import { Modal, View, Text, TextInput, Button, StyleSheet, I18nManager, } from "react-native";
import axios from "axios";
import { SERVER_URL } from "@env";
import Constants from 'expo-constants';
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../services/api"
// const SERVER_URL = Constants.expoConfig.extra.SERVER_URL;

const TasksInputModal = ({ userId, visible, onClose, onSubmit, projectId }) => {
    const [itemValue, setItemValue] = useState("");
    const [countValue, setCountValue] = useState("");

   const addItem = async () => {
    const newItem = {
        task: itemValue,
        details: countValue
    }
    // console.log(newItem);
    onSubmit(newItem);
    setItemValue(null);
    setCountValue(null);
    try {
      const token = await AsyncStorage.getItem("token")
              await api.post(`/AddTask/${projectId}`, newItem);
            } catch (error) {
              console.error("Error adding task:", error);
            }
            
            
        
   }
    return (
        <Modal visible={visible} animationType="slide" transparent={true}>
            <View style={styles.modalContainer}>
                <View style={styles.modalContent}>
                    <Text>Task</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Type here..."
                        value={itemValue}
                        onChangeText={setItemValue}
                    />
                    <Text>Details</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Type here..."
                        value={countValue}
                        onChangeText={setCountValue}
                    />
                    <Button title="Submit" onPress={() => addItem()} />
                    <Button title="Cancel" onPress={onClose} />
                </View>
            </View>
        </Modal>
    );
};

const isRTL = I18nManager.isRTL;

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 10,
    width: "80%",
    alignItems: "center",
  },
  input: {
    borderBottomWidth: 1,
    width: "100%",
    marginVertical: 10,
    padding: 5,
    textAlign: isRTL ? "right" : "left",
  },
});
export default TasksInputModal;