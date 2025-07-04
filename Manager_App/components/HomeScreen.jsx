import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  I18nManager,
} from "react-native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import axios from "axios";
import { SERVER_URL } from "@env";
import Constants from 'expo-constants';

// Import Screens
import Incomes from "./Incomes";
import Expenses from "./Expenses";
import Project from "./Project";
import { ValueProvider } from "./ValueContext";

// const SERVER_URL = Constants.expoConfig.extra.SERVER_URL;

const HomeScreen = ({ navigation }) => {
  
  const route = useRoute();
  const userId = route.params?.userId;

  const [loading, setLoading] = useState(false);
  const [projectDetails, setProjectDetails] = useState([]);
  const [userName, setUserName] = useState(null);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${SERVER_URL}/getUsers/${userId}`);
      setUserName(response.data.name);
      setProjectDetails(response.data.projects);
    } catch (error) {
      console.error("Error occurred: " + error);
    } finally {
      setLoading(false);
    }
  };

  const renderProjectCard = ({ item }) => (
    <TouchableOpacity
      onPress={() => navigation.navigate("AboutProject", { project: item, userId })}
      style={styles.projectCard}
    >
      <Project
        userId={userId}
        id={item._id}
        projectName={item.name}
        totalDays={item.days}
        totalAmount={item.payment}
      />
    </TouchableOpacity>
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.welcome}>שלום {userName} 👋</Text>
     <View style={{ flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse', width: '100%', marginBottom: 20 }}>
       <Text style={{ fontSize: 20 }}>{I18nManager.isRTL ? 'RTL is true' : 'false'}</Text>
       </View>
      <ValueProvider>
        <View style={styles.overviewRow}>
          <Incomes userId={userId} />
          <Expenses userId={userId} refresh={loading} />
        </View>

        <View style={styles.buttonsRow}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate("CashFlow", { userId })}
          >
            <Text style={styles.buttonText}>📈 תזרים מזומנים</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate("NewProject", { userId })}
          >
            <Text style={styles.buttonText}>➕ פרויקט חדש</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate("PriceOffer", { userId })}
          >
            <Text style={styles.buttonText}>💰 הצעת מחיר</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate("ProfileDetails", { userId })}
          >
            <Text style={styles.buttonText}>איזור אישי</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>הפרויקטים שלך</Text>

        {loading ? (
          <ActivityIndicator size="large" color="#00796b" />
        ) : (
          <FlatList
            data={projectDetails}
            scrollEnabled={false}
            keyExtractor={(item) => item._id}
            renderItem={renderProjectCard}
            contentContainerStyle={{ paddingBottom: 30 }}
          />
        )}
      </ValueProvider>
    </ScrollView>
  );
};

const isRTL = I18nManager.isRTL;

const styles = StyleSheet.create({
  container: {
    paddingTop: 70,
    paddingStart: 16,
    paddingEnd: 16,
    backgroundColor: "#f2f4f7",
    flexDirection: I18nManager.isRTL ? "row" : "row-reverse",
  },
  welcome: {
    fontSize: 26,
    fontWeight: "bold",
    textAlign: I18nManager.isRTL ? "left" : "right",
    marginBottom: 20,
  },
  overviewRow: {
    flexDirection: I18nManager.isRTL ? "row" : "row-reverse",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  buttonsRow: {
    flexDirection: "column",
    rowGap: 10, // `gap` is not supported, use `rowGap` if you're using React Native Web or apply margin
    marginBottom: 30,
  },
  actionButton: {
    backgroundColor: "#ffffff",
    paddingVertical: 14,
    paddingStart: 16,
    paddingEnd: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 2,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    textAlign: I18nManager.isRTL ? "right" : "left",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: I18nManager.isRTL ? "left" : "right",
    marginBottom: 12,
  },
  projectCard: {
    marginBottom: 12,
    borderRadius: 10,
    padding: 10,
    elevation: 2,
  },
});


export default HomeScreen;
