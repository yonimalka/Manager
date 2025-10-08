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
  Alert,
} from "react-native";
import { useRoute, useNavigation, useIsFocused } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from "@expo/vector-icons";
import { SERVER_URL } from "@env";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

import Incomes from "./Incomes";
import Expenses from "./Expenses";
import Project from "./Project";
import { ValueProvider } from "./ValueContext";
import BottomNavBar from "../components/BottomNavBar";
import { useAuth } from "./useAuth";
import api from "../services/api";

const HomeScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { userId, authLoading, isAuthenticated } = useAuth();
  const isFocused = useIsFocused();

  const [loading, setLoading] = useState(false);
  const [userName, setUserName] = useState(null);
  const [projectDetails, setProjectDetails] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  
 const fetchData = async () => {
    try {
      setLoading(true);
      setLoadingProjects(true);

      const token = await AsyncStorage.getItem("token");
      console.log("Home screen token:", token);
      
    if (!token) {
      console.log("No token found, redirect to login");
      Alert.alert("No token found, redirect to login")
      // navigation.reset({ index: 0, routes: [{ name: "Login" }] });
      return;
    }
    console.log("before api");
      const response = await api.get('/getUser');
      setUserName(response.data?.name ?? "משתמש");
      setProjectDetails(response.data?.projects ?? [])
    } catch (err) {
      console.error("Error fetching user data: ", err);
    } finally {
      setLoading(false);
      setLoadingProjects(false);
    }
  };
useEffect(() => {
  if (!authLoading && !isAuthenticated) {
    navigation.reset({
      index: 0,
      routes: [{ name: "LoginScreen" }],
    });
  }
}, [authLoading, isAuthenticated]);

  useEffect(() =>{
    if (isFocused){
      fetchData();
    }
  },[isFocused]);

   if (authLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const renderProjectCard = ({ item }) => (
    <TouchableOpacity
      onPress={() => navigation.navigate("AboutProject", { project: item })}
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
        <Text style={styles.welcome}>ברוך השב,{"\n"}{userName}</Text>

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
                <Text style={styles.summaryAmount}>
                <Incomes refresh={loading} />
                </Text>
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
                <Text style={styles.summaryAmount}>
                <Expenses userId={userId} refresh={loading} />
                </Text>
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
      <BottomNavBar />
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
  sectionTitle: { fontSize: 20, fontWeight: "bold", textAlign: isRTL ? "left" : "right", marginBottom: 20 },
  projectCard: { marginBottom: 12 },
});

export default HomeScreen;
