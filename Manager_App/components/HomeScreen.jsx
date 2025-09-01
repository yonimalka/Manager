import React, { useState, useCallback } from "react";
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
import { useFocusEffect, useRoute, useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from "@expo/vector-icons";
import axios from "axios";

import Incomes from "./Incomes";
import Expenses from "./Expenses";
import Project from "./Project";
import { ValueProvider } from "./ValueContext";
import BottomNavBar from "../components/BottomNavBar";



const HomeScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const userId = route.params?.userId;

  const [loading, setLoading] = useState(false);
  const [userName, setUserName] = useState(null);
  const [projectDetails, setProjectDetails] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  useEffect(()=>{
   fetchData();
  },[]);

  const fetchData = async () => {
    try {
      setLoadingProjects(true);
      const response = await axios.get(`${SERVER_URL}/getUsers/${userId}`);
      setUserName(response.data.name);
      setProjectDetails(response.data.projects);
    } catch (err) {
      console.error("Error fetching user data: ", err);
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
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.welcome}>שלום {userName}</Text>

        <ValueProvider>
          {/* Summary Row */}
          <View style={styles.summaryRow}>
            {/* Incomes Card */}
            <LinearGradient
              colors={["#4ade80", "#10b981"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gradientCard}
            >
              <View style={styles.summaryHeader}>
                <View style={styles.iconCircle}>
                  <MaterialIcons name="trending-up" size={22} color="#fff" />
                </View>
                <Text style={styles.summaryTitleWhite}>הכנסות</Text>
              </View>
              {loading ? (
                <ActivityIndicator size="small" color="#fff" style={{ marginTop: 12 }} />
              ) : (
                <Incomes style={styles.summaryAmount} userId={userId} />
              )}
              <MaterialIcons
                name="account-balance-wallet"
                size={100}
                color="rgba(255,255,255,0.2)"
                style={styles.bgIcon}
              />
            </LinearGradient>

            {/* Expenses Card */}
            <LinearGradient
              colors={["#f87171", "#ef4444"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gradientCard}
            >
              <View style={styles.summaryHeader}>
                <View style={styles.iconCircle}>
                  <MaterialIcons name="trending-down" size={22} color="#fff" />
                </View>
                <Text style={styles.summaryTitleWhite}>הוצאות</Text>
              </View>
              {loading ? (
                <ActivityIndicator size="small" color="#fff" style={{ marginTop: 12 }} />
              ) : (
                <Expenses style={styles.summaryAmount} userId={userId} refresh={loading} />
              )}
              <MaterialIcons
                name="shopping-cart"
                size={100}
                color="rgba(255,255,255,0.2)"
                style={styles.bgIcon}
              />
            </LinearGradient>
          </View>

          {/* Projects Section */}
          <Text style={styles.sectionTitle}>הפרויקטים שלך</Text>

          {loadingProjects ? (
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
      <BottomNavBar userId={userId} />
    </View>
  );
};

const isRTL = I18nManager.isRTL;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f2f4f7" },
  container: { paddingTop: 70, paddingStart: 16, paddingEnd: 16, paddingBottom: 90 },
  welcome: { fontSize: 26, fontWeight: "bold", textAlign: isRTL ? "left" : "right", marginBottom: 37 },
  summaryRow: { flexDirection: isRTL ? "row" : "row-reverse", justifyContent: "space-between", marginBottom: 35 },
  gradientCard: { flex: 1, borderRadius: 20, padding: 16, marginHorizontal: 6, overflow: "hidden", position: "relative" },
  summaryHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconCircle: { backgroundColor: "rgba(255,255,255,0.2)", padding: 6, borderRadius: 50 },
  summaryTitleWhite: { fontSize: 14, fontWeight: "600", color: "#fff" },
  summaryAmount: { fontSize: 20, fontWeight: "700", color: "#fff" },
  bgIcon: { position: "absolute", bottom: -20, right: -20, transform: [{ rotate: "-12deg" }] },
  sectionTitle: { fontSize: 20, fontWeight: "bold", textAlign: isRTL ? "left" : "right", marginBottom: 12 },
  projectCard: { marginBottom: 12 },
});

export default HomeScreen;
