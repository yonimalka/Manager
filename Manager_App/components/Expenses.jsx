import React, { useState, useEffect } from "react";
import { Text } from "react-native";
import axios from "axios";
import { SERVER_URL } from "@env";

const Expenses = ({ userId, refresh }) => {
  const [totalExpenses, setTotalExpenses] = useState(null);

  useEffect(() => {
    fetchExpenses();
  }, [refresh]);

  const fetchExpenses = async () => {
    try {
      const response = await axios.get(`${SERVER_URL}/getTotalExpenses/${userId}`);
      setTotalExpenses(response.data);
    } catch (err) {
      console.error("Error fetching expenses: ", err);
    }
  };

  return <Text>{totalExpenses ? `${totalExpenses}₪` : "0₪"}</Text>;
};

export default Expenses;
