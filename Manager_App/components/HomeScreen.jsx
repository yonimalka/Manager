import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  I18nManager,
  Alert,
  Image,
  Animated,
  Dimensions,
  Modal
} from "react-native";
import { useRoute, useNavigation, useIsFocused } from "@react-navigation/native";
import { SERVER_URL } from "@env";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import Receipts from "./Receipts";
import IncomeReceiptGenerator from "./IncomeReceiptGenerator";
import { generateIncomeReceiptPDF } from "../services/generateIncomePDF";
import Incomes from "./Incomes";
import Expenses from "./Expenses";
import Project from "./Project";
import { ValueProvider } from "./ValueContext";
import BottomNavBar from "../components/BottomNavBar";
import { useAuth } from "./useAuth";
import api from "../services/api";
import { signInAnonymously } from "firebase/auth";
import { auth } from "./firebase";

const { width } = Dimensions.get("window");

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
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserName] = useState(null);
  const [userLogo, setUserLogo] = useState(null);
  const [projectDetails, setProjectDetails] = useState([]);
  const [scrollY] = useState(new Animated.Value(0));
  const [incomeModalVisible ,setIncomeModalVisible] = useState(false);
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);

  const fetchData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const token = await AsyncStorage.getItem("token");

      if (!token) {
        console.log("No token found, redirect to login");
        navigation.reset({ index: 0, routes: [{ name: "LoginScreen" }] });
        return;
      }

      const response = await api.get("/getUser");
      setUserName(response.data?.name ?? "User");
      setUserLogo(response.data.logo);
      setProjectDetails(response.data?.projects ?? []);
    } catch (err) {
      console.error("Error fetching user data: ", err);
      Alert.alert("Error", "Failed to load data. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    fetchData(true);
  }, []);

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

  useEffect(() => {
    if (isFocused) {
      fetchData();
    }
  }, [isFocused]);

  if (authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading your dashboard...</Text>
      </View>
    );
  }
  const submitIncomeReceipt = async (data) => {
    try {
      const res = await api.post("/incomeReceipt", data);
      const receipt = await res.data;
      console.log("Saved receipt:", receipt);
      const response = await api.get(`/getUserDetails/${userId}`);
      console.log(response.data);
      const userDetails = response.data;
      generateIncomeReceiptPDF(receipt, userDetails);
    } catch (err) {
      console.error(err);
    }
  };
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const renderProjectCard = ({ item, index }) => (
    <Animated.View
      style={[
        styles.projectCardWrapper,
        // {
        //   opacity: scrollY.interpolate({
        //     inputRange: [-1, 0, index * 100, (index + 1) * 100],
        //     outputRange: [1, 1, 1, 0.8],
        //   }),
        // },
      ]}
    >
      <TouchableOpacity
        onPress={() => navigation.navigate("AboutProject", { project: item })}
        // style={styles.projectCard}
        activeOpacity={0.7}
      >
        <Project
          userId={userId}
          id={item._id}
          projectName={item.name}
          totalDays={item.days}
          totalAmount={item.payment}
        />
      </TouchableOpacity>
    </Animated.View>
  );

  const renderEmptyProjects = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconCircle}>
        <Ionicons name="briefcase-outline" size={48} color="#9CA3AF" />
      </View>
      <Text style={styles.emptyTitle}>No Projects Yet</Text>
      <Text style={styles.emptySubtitle}>
        Start by creating your first project
      </Text>
      <TouchableOpacity
        style={styles.emptyButton}
        onPress={() => navigation.navigate("NewProject")}
      >
        <LinearGradient
          colors={["#3B82F6", "#2563EB"]}
          style={styles.emptyButtonGradient}
        >
          <Ionicons name="add-circle-outline" size={20} color="#fff" />
          <Text style={styles.emptyButtonText}>Create Project</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  const renderLoadingSkeleton = () => (
    <View style={styles.skeletonContainer}>
      <View style={styles.skeletonCard} />
      <View style={styles.skeletonCard} />
      <View style={styles.skeletonCard} />
    </View>
  );

  return (
    <View style={styles.screen}>
      {/* Animated Header Background */}
      <Animated.View style={[styles.headerBackground, { opacity: headerOpacity }]}>
        <LinearGradient
          colors={["#3B82F6", "#6C8CF5"]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Fixed Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <View style={styles.greetingContainer}>
              <Text style={styles.greetingTime}>
                {new Date().getHours() < 12
                  ? "Good Morning"
                  : new Date().getHours() < 18
                  ? "Good Afternoon"
                  : "Good Evening"}
              </Text>
              <Text style={styles.greetingName}>
                {userName == "Apple User" ? null : userName}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => navigation.navigate("ProfileDetails")}
          >
            {userLogo ? (
              <Image source={{ uri: userLogo }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={24} color="#3B82F6" />
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <Animated.ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#3B82F6"
            colors={["#3B82F6"]}
          />
        }
      >
        <ValueProvider>
          {/* Financial Overview Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Financial Overview</Text>
              <TouchableOpacity style={styles.seeAllButton} onPress={()=> navigation.navigate("Finance")}>
                <Text style={styles.seeAllText}>See All</Text>
                <Ionicons name="arrow-forward" size={16} color="#3B82F6" />
              </TouchableOpacity>
            </View>

            <View style={styles.summaryRow}>
                  <Incomes refresh={loading} />
                  <Expenses userId={userId} refresh={loading} />
            </View> 
          </View>

          {/* Quick Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.quickActions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => navigation.navigate("NewProject")}
              >
                <View style={styles.actionIcon}>
                  <Ionicons name="add-circle" size={24} color="#3B82F6" />
                </View>
                <Text style={styles.actionText}>New Project</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => setIncomeModalVisible(true)}
              >
                <View style={styles.actionIcon}>
                  <Ionicons name="cash" size={24} color="#10B981" />
                </View>
                <Text style={styles.actionText}>Add Income</Text>
              </TouchableOpacity>
              <Modal visible={incomeModalVisible} animationType="fade" transparent onRequestClose={() => setIncomeModalVisible(false)}>
                      <View style={styles.backdrop}>
                        <View style={styles.modalCard}>
                          <IncomeReceiptGenerator
                            onSubmit={(data) => {
                              submitIncomeReceipt(data);
                              setIncomeModalVisible(false);
                            }}
                            onClose={() => setIncomeModalVisible(false)}
                          />
                        </View>
                      </View>
                    </Modal>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => setReceiptModalVisible(true)}
              >
                <View style={styles.actionIcon}>
                  <Ionicons name="card" size={24} color="#EF4444" />
                </View>
                <Text style={styles.actionText}>Add Expense</Text>
              </TouchableOpacity>
              <Modal visible={receiptModalVisible} transparent animationType="fade" statusBarTranslucent>
                      <View style={styles.backdrop}>
                        <View style={styles.modalCard}>
                          <Receipts onClose={() => setReceiptModalVisible(false)} />
                        </View>
                      </View>
                    </Modal>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => navigation.navigate("CashFlow")}
              >
                <View style={styles.actionIcon}>
                  <Ionicons name="stats-chart" size={24} color="#8B5CF6" />
                </View>
                <Text style={styles.actionText}>CashFlow</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Projects Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                Active Projects ({projectDetails.length})
              </Text>
              {/* {projectDetails.length > 0 && (
                <TouchableOpacity
                  style={styles.addProjectButton}
                  onPress={() => navigation.navigate("NewProject")}
                >
                  <Ionicons name="add" size={20} color="#3B82F6" />
                </TouchableOpacity>
              )} */}
            </View>

            {loading && !refreshing ? (
              renderLoadingSkeleton()
            ) : projectDetails.length === 0 ? (
              renderEmptyProjects()
            ) : (
              <FlatList
                data={projectDetails}
                scrollEnabled={false}
                keyExtractor={(item) => item._id}
                renderItem={renderProjectCard}
                contentContainerStyle={styles.projectsList}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        </ValueProvider>
      </Animated.ScrollView>

      {/* <BottomNavBar /> */}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#6B7280",
    fontWeight: "500",
  },

  // Header
  headerBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 135,
    zIndex: 0,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    zIndex: 10,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: {
    flex: 1,
  },
  greetingContainer: {
    gap: 4,
  },
  greetingTime: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
  greetingName: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111827",
  },
  profileButton: {
    marginLeft: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: "#fff",
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#E0F2FE",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
  },

  // Scroll Content
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 100,
    paddingHorizontal: 20,
  },

  // Section
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 30
  },
  seeAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 30
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3B82F6",
  },
  addProjectButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E0F2FE",
    alignItems: "center",
    justifyContent: "center",
  },

  // Financial Cards
  summaryRow: {
    flexDirection: "row",
    gap: 16,
  },
  financeCard: {
    flex: 1,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  financeCardGradient: {
    padding: 20,
    minHeight: 140,
  },
  financeIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  // Quick Actions
  quickActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  actionButton: {
    width: (width - 80) / 4,
    alignItems: "center",
    gap: 8,
    marginBottom: 30
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  actionText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
    textAlign: "center",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },

  modalCard: {
    width: "92%",
    height: "90%",
    // flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
    overflow: "hidden",
  },
  // Projects
  projectsList: {
    gap: 12,
  },
  projectCardWrapper: {
    marginBottom: 12,
  },
  projectCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  projectArrow: {
    marginLeft: "auto",
    paddingLeft: 12,
  },

  // Empty State
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
  },
  emptyIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 24,
  },
  emptyButton: {
    borderRadius: 12,
    overflow: "hidden",
  },
  emptyButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  emptyButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  // Loading Skeleton
  skeletonContainer: {
    gap: 12,
  },
  skeletonCard: {
    height: 100,
    backgroundColor: "#E5E7EB",
    borderRadius: 16,
    opacity: 0.5,
  },
});

export default HomeScreen;