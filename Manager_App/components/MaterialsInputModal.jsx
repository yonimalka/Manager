import React, { useState } from "react";
import { Modal, View, Text, TextInput, Button, StyleSheet, I18nManager } from "react-native";
import axios from "axios";
import { SERVER_URL } from "@env";
import Constants from 'expo-constants';
// const SERVER_URL = Constants.expoConfig.extra.SERVER_URL;
// אני צריך עכשיו לקבל מהמשתמש את הנתונים ולהעביר אותם לשרתת בנוסף אני צריך שהטבלה תתעדכן מיד עם קבלת הנתונים ולעשות את התהליך הזה גם ךרשימת המשימות
const MaterialsInputModal = ({ userId, visible, onClose, onSubmit, projectId }) => {
    
    const [itemValue, setItemValue] = useState("");
    const [countValue, setCountValue] = useState("");

   const addItem = async () => {
    const newItem = {
        item: itemValue,
        count: countValue
    }
    // console.log(newItem);
    onSubmit(newItem);
    setItemValue(null);
    setCountValue(null);
    try {
              await axios.post(`${SERVER_URL}/AddItem/${userId}/${projectId}`, newItem, {
                headers: { "Content-Type": "application/json" },
              });
            } catch (error) {
              console.error("Error adding product:", error);
            }
            
            
        
   }
    return (
        <Modal visible={visible} animationType="slide" transparent={true}>
            <View style={styles.modalContainer}>
                <View style={styles.modalContent}>
                    <Text>Enter Item:</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Type here..."
                        value={itemValue}
                        onChangeText={setItemValue}
                    />
                    <Text>Enter Count:</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Type here..."
                        value={countValue}
                        onChangeText={setCountValue}
                    />
                    <Button title="Submit" onPress={()=> addItem()} />
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


export default MaterialsInputModal;