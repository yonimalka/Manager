import React, { useState, useEffect } from "react";
import { Text } from "react-native";
import axios from "axios";
import { SERVER_URL } from "@env";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../services/api";

const Expenses = ({ userId, refresh }) => {
  const [totalExpenses, setTotalExpenses] = useState(null);
  

  useEffect(() => {
    fetchExpenses();
  }, [refresh]);

  const fetchExpenses = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
       
      const response = await api.get(`/getTotalExpenses`);
      setTotalExpenses(response.data);
    } catch (err) {
      console.error("Error fetching expenses: ", err);
    }
  };

  return <Text>{totalExpenses ? `${totalExpenses}₪` : "0₪"}</Text>;
};

export default Expenses;
