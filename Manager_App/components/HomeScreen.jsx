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
  Image,
} from "react-native";
import { useRoute, useNavigation, useIsFocused } from "@react-navigation/native";
import { SERVER_URL } from "@env";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";

import Incomes from "./Incomes";
import Expenses from "./Expenses";
import Project from "./Project";
import { ValueProvider } from "./ValueContext";
import BottomNavBar from "../components/BottomNavBar";
import { useAuth } from "./useAuth";
import api from "../services/api";
import Menu from "./Menu";
import testing from "./testing";
import { signInAnonymously } from "firebase/auth";
import { auth } from "./firebase";

export const firebaseLogin = async () => {
  if (!auth.currentUser) {
    await signInAnonymously(auth);
  }
};

const HomeScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { userId, authLoading, isAuthenticated } = useAuth();
  const isFocused = useIsFocused();

  const [loading, setLoading] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [userName, setUserName] = useState(null);
  const [userLogo, setUserLogo] = useState(null);
  const [projectDetails, setProjectDetails] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  
 const fetchData = async () => {
    try {
      setLoading(true);
      // setLoadingProjects(true);

      const token = await AsyncStorage.getItem("token");
      // console.log("Home screen token:", token);
      
    if (!token) {
      console.log("No token found, redirect to login");
      Alert.alert("No token found, redirect to login")
      navigation.reset({ index: 0, routes: [{ name: "LoginScreen" }] });
      return;
    }
    // console.log("before api");
      const response = await api.get('/getUser');
      // console.log(response.data);
      // console.log("userId:", userId)
      setUserName(response.data?.name ?? "user");
      setUserLogo(response.data.logo);
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

useEffect(() => {
  firebaseLogin();
}, []);

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
    
    <Menu visible={menuVisible} onClose={() => setMenuVisible(false)} />
        <View style={styles.header}>
        <Image source={{ uri: userLogo }} style={styles.logo} />
        <TouchableOpacity
          onPress={() => setMenuVisible(!menuVisible)}
          style={styles.hamburger}
        >
          <Ionicons name="menu" size={40} color="#333" />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.welcome}>welcome</Text>
        <ValueProvider>
          {/* Summary Row */}
          <View style={styles.summaryRow}>
            {/* Incomes Card */}
            <View style={styles.gradientCard} >
             <Incomes refresh={loading} />
            </View>
                <View style={styles.gradientCard}>
{/* Expenses Card */}
                <Expenses userId={userId} refresh={loading} />
                </View>
          </View>
          
          {/* Projects Section */}
          <Text style={styles.sectionTitle}>Projects</Text>

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
  container: { paddingTop: 30, paddingStart: 16, paddingEnd: 16, paddingBottom: 90 },
  welcome: { fontSize: 26, fontWeight: "bold", textAlign: !isRTL ? "left" : "right", marginBottom: 37 },
  header: {
    // position: "absolute",
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    // marginBottom: 20,
    marginTop: 70,
    marginHorizontal: 10,
    shadowColor: "#000",
    // shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  logo: {
    alignSelf: "center",
    width: 70,
    height: 70,
    borderRadius: 50,
    backgroundColor: "#fff",
  },
  hamburger: {
    
    padding: 1,
  },
  summaryRow: { flexDirection: !isRTL ? "row" : "row-reverse", justifyContent: "space-between", marginBottom: 35 },
  gradientCard: { flex: 1, borderRadius: 20, padding: 9, overflow: "hidden", position: "relative" },
  sectionTitle: { fontSize: 20, fontWeight: "bold", textAlign: !isRTL ? "left" : "right", marginBottom: 20 },
  projectCard: { marginBottom: 12 },
});

export default HomeScreen;
