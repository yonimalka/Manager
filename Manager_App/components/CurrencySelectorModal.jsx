import React from "react";
import { View, Text, Modal, TouchableOpacity, FlatList, StyleSheet } from "react-native";
import { useAuth } from "./useAuth";
import api from "../services/api";

const currencies = [
  { code: "USD", locale: "en-US", label: "🇺🇸 USD - US Dollar" },
  { code: "GBP", locale: "en-GB", label: "🇬🇧 GBP - British Pound" },
  { code: "EUR", locale: "de-DE", label: "🇪🇺 EUR - Euro" },
  { code: "ILS", locale: "he-IL", label: "🇮🇱 ILS - Israeli Shekel" },
];

export default function CurrencySelectorModal({ visible, onClose }) {
  const { userDetails, setUserDetails } = useAuth();

  const selectCurrency = async (item) => {
    await api.put("/updateCurrency", {
      currency: item.code,
      locale: item.locale,
    });

    setUserDetails({
      ...userDetails,
      currency: item.code,
      locale: item.locale,
    });

    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.container}>
        <Text style={styles.title}>Select Currency</Text>

        <FlatList
          data={currencies}
          keyExtractor={(item) => item.code}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.option}
              onPress={() => selectCurrency(item)}
            >
              <Text>{item.label}</Text>
            </TouchableOpacity>
          )}
        />

        <TouchableOpacity onPress={onClose}>
          <Text style={{ marginTop: 20 }}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 20 },
  option: {
    padding: 15,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
});