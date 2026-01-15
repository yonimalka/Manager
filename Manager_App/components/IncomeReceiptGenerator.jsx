import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Upload, DollarSign, User, Tag, Calendar } from "lucide-react-native";

export default function IncomeReceiptGenerator({ onSubmit, onClose }) {
  const [amount, setAmount] = useState("");
  const [payer, setPayer] = useState("");
  const [category, setCategory] = useState("");
  const [currency, setCurrency] = useState("ILS");
  const [date, setDate] = useState(new Date());
  const [showDate, setShowDate] = useState(false);
  const [notes, setNotes] = useState("");
  const [image, setImage] = useState(null);

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!res.canceled) setImage(res.assets[0].uri);
  };

  const submit = () => {
    onSubmit({
      amount: Number(amount),
      payer,
      category,
      currency,
      date,
      notes: notes || `Income from ${payer}`,
      image,
    });
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
  <Text style={styles.title}>Income Receipt</Text>

  <TouchableOpacity onPress={onClose}>
    <Text style={styles.close}>✕</Text>
  </TouchableOpacity>
</View>

      <Input icon={<DollarSign />} value={amount} onChange={setAmount} placeholder="Amount" />
      <Input icon={<User />} value={payer} onChange={setPayer} placeholder="Client's name" />
      <Input icon={<Tag />} value={category} onChange={setCategory} placeholder="Category" />

      {/* Currency */}
      <View style={styles.currencyRow}>
        {["ILS", "USD", "EUR"].map((c) => (
          <TouchableOpacity
            key={c}
            onPress={() => setCurrency(c)}
            style={[styles.currencyBtn, currency === c && styles.active]}
          >
            <Text>{c}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Date */}
      <TouchableOpacity style={styles.dateRow} onPress={() => setShowDate(true)}>
        <Calendar size={18} />
        <Text style={{ marginLeft: 8 }}>{date.toLocaleDateString()}</Text>
      </TouchableOpacity>

      {showDate && (
        <DateTimePicker
          value={date}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "default"}
          onChange={(e, d) => {
            setShowDate(false);
            if (d) setDate(d);
          }}
        />
      )}

      <TextInput
        placeholder="Notes"
        value={notes}
        onChangeText={setNotes}
        style={styles.notes}
        multiline
      />

      <TouchableOpacity style={styles.uploadBtn} onPress={pickImage}>
        <Upload size={18} />
        <Text>{image ? "Change Image" : "Upload Image"}</Text>
      </TouchableOpacity>

      {image && <Image source={{ uri: image }} style={styles.preview} />}

      <TouchableOpacity style={styles.submitBtn} onPress={submit}>
        <Text style={styles.submitText}>Save Receipt</Text>
      </TouchableOpacity>
    </View>
  );
}

const Input = ({ icon, value, onChange, placeholder }) => (
  <View style={styles.inputRow}>
    {icon}
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      style={styles.input}
    />
  </View>
);
const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    margin: 16,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  header: {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 16,
},

close: {
  fontSize: 22,
  color: "#9ca3af",
},

  title: {
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 16,
  },

  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    backgroundColor: "#fff",
  },

  input: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
  },

  currencyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  currencyBtn: {
    flex: 1,
    paddingVertical: 10,
    marginHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
  },

  active: {
    backgroundColor: "#dcfce7",
    borderColor: "#22c55e",
  },

  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 12,
  },

  notes: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 12,
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: 12,
    fontSize: 15,
  },

  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    marginBottom: 12,
  },

  preview: {
    width: "100%",
    height: 180,
    borderRadius: 12,
    marginBottom: 12,
  },

  submitBtn: {
    backgroundColor: "#16a34a",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 8,
  },

  submitText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});

