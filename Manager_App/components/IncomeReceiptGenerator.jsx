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

export default function IncomeReceiptGenerator({ onSubmit }) {
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
      <Text style={styles.title}>Income Receipt</Text>

      <Input icon={<DollarSign />} value={amount} onChange={setAmount} placeholder="Amount" />
      <Input icon={<User />} value={payer} onChange={setPayer} placeholder="Received from" />
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
