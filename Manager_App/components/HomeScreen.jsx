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
import { useFocusEffect, useRoute } from "@react-navigation/native";
import axios from "axios";
import { SERVER_URL } from "@env";
import { MaterialIcons } from "@expo/vector-icons"; // ✅ אייקונים

// Import Screens
import Incomes from "./Incomes";
import Expenses from "./Expenses";
import Project from "./Project";
import { ValueProvider } from "./ValueContext";
import BottomNavBar from "../components/BottomNavBar";

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
      onPress={() =>
        navigation.navigate("AboutProject", { project: item, userId })
      }
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
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconButton}>
            <MaterialIcons name="notifications" size={24} color="#555" />
            {/* אפשר להוסיף בול אדום קטן כמו ב-Stitch אם תרצה */}
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerSub}>שלום בחזרה,</Text>
            <Text style={styles.headerTitle}>{userName}</Text>
          </View>
          <TouchableOpacity style={styles.iconButton}>
            <MaterialIcons name="menu" size={24} color="#555" />
          </TouchableOpacity>
        </View>

        <ValueProvider>
          {/* Summary Cards */}
          <View style={styles.summaryRow}>
            <View style={[styles.summaryCard, { borderColor: "#4caf50" }]}>
              <View style={styles.summaryHeader}>
                <MaterialIcons name="arrow-upward" size={22} color="#4caf50" />
                <Text style={styles.summaryTitle}>הכנסות</Text>
              </View>
              <Incomes userId={userId} />
            </View>
            <View style={[styles.summaryCard, { borderColor: "#f44336" }]}>
              <View style={styles.summaryHeader}>
                <MaterialIcons name="arrow-downward" size={22} color="#f44336" />
                <Text style={styles.summaryTitle}>הוצאות</Text>
              </View>
              <Expenses userId={userId} refresh={loading} />
            </View>
          </View>

          {/* Projects */}
          <View style={styles.projectsHeader}>
            <Text style={styles.sectionTitle}>פרויקטים</Text>
            <TouchableOpacity>
              <Text style={styles.viewAll}>הצג הכל</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color="#3b82f6" />
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

      {/* Bottom Navigation */}
      <BottomNavBar userId={userId} />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f0f4ff",
  },
  container: {
    paddingBottom: 90,
    backgroundColor: "#f0f4ff",
  },
  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  headerCenter: {
    alignItems: "center",
  },
  headerSub: {
    fontSize: 14,
    color: "#666",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111",
  },
  iconButton: {
    backgroundColor: "#fff",
    borderRadius: 50,
    padding: 8,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },

  // Summary
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: -20,
    marginHorizontal: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 6,
    borderLeftWidth: 5,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  summaryHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#444",
  },

  // Projects
  projectsHeader: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111",
  },
  viewAll: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3b82f6",
  },
  projectCard: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
});

export default HomeScreen;
