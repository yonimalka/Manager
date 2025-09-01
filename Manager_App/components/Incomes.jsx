import React, { useEffect, useState } from "react";
import { Text } from "react-native";
import axios from "axios";
import { SERVER_URL } from "@env";
import { useValue } from "./ValueContext";

const Incomes = ({ userId }) => {
  const { value } = useValue();
  const [totalIncomes, setTotalIncomes] = useState(null);

  useEffect(() => {
    fetchIncomes();
  }, [value]);

  const fetchIncomes = async () => {
    try {
      const response = await axios.get(`${SERVER_URL}/getTotalIncomes/${userId}`);
      setTotalIncomes(response.data);
    } catch (err) {
      console.error("Error fetching incomes: ", err);
    }
  };

  // מחזיר רק את הערך, בלי עיצוב
  return <Text>{value ? `${value}₪` : totalIncomes ? `${totalIncomes}₪` : "0₪"}</Text>;
};

export default Incomes;
