import React, { useEffect, useState } from "react";
import { Text } from "react-native";
import axios from "axios";
import { SERVER_URL } from "@env";
import { useValue } from "./ValueContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../services/api";

const Incomes = () => {
  const { value } = useValue();
  const [totalIncomes, setTotalIncomes] = useState(null);

  
  const fetchIncomes = async () => {
    
    try {
      const token = await AsyncStorage.getItem("token");
      
      if (!token) {
            console.log("No token found on incomes");
            // Alert.alert("No token found, redirect to login")
            // navigation.reset({ index: 0, routes: [{ name: "Login" }] });
            return;
          }
      const response = await api.get(`/getTotalIncomes`);
      
      setTotalIncomes(response.data);
    } catch (err) {
      console.error("Error fetching incomes: ", err);
    }
  };

  useEffect(() => {
    fetchIncomes();
  }, [value]);

  // מחזיר רק את הערך, בלי עיצוב
  return <Text>{value ? `${value}₪` : totalIncomes ? `${totalIncomes}₪` : "0₪"}</Text>;
};

export default Incomes;
