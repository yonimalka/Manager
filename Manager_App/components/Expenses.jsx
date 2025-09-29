import React, { useState, useEffect } from "react";
import { Text } from "react-native";
import axios from "axios";
import { SERVER_URL } from "@env";
import AsyncStorage from "@react-native-async-storage/async-storage";

const Expenses = ({ userId, refresh }) => {
  const [totalExpenses, setTotalExpenses] = useState(null);
  

  useEffect(() => {
    fetchExpenses();
  }, [refresh]);

  const fetchExpenses = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
       
      const response = await axios.get(`${SERVER_URL}/getTotalExpenses`, {
        headers: {Authorization: `Bearer ${token}`}
      });
      setTotalExpenses(response.data);
    } catch (err) {
      console.error("Error fetching expenses: ", err);
    }
  };

  return <Text>{totalExpenses ? `${totalExpenses}₪` : "0₪"}</Text>;
};

export default Expenses;
