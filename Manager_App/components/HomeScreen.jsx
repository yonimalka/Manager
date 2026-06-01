import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
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
  Modal,
  Platform,
  PixelRatio,
  StatusBar,
  KeyboardAvoidingView,
} from "react-native";
import { useRoute, useNavigation, useIsFocused } from "@react-navigation/native";
// import { SERVER_URL } from "@env";
// import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AgentScreen from "./AgentScreen";
import Receipts from "./Receipts";
import IncomeReceiptGenerator from "./IncomesReceiptGenerator";
// import { generateIncomeReceiptPDF } from "../services/generateIncomePDF";
import Project from "./Project";
import { ValueProvider } from "./ValueContext";
import BottomNavBar from "../components/BottomNavBar";
import { useAuth } from "./useAuth";
import api from "../services/api";
import { signInAnonymously } from "firebase/auth";
import { auth } from "./firebase";
import { formatCurrency } from "../services/formatCurrency";
import { refreshSubscriptionStatus, hasProAccess } from "../services/subscription";
import { presentRevenueCatPaywallIfNeeded } from "../services/revenuecat";
import WelcomeModal from "./WelcomeModal";
import Svg, { Path, Rect } from "react-native-svg";
import { Building2 } from "lucide-react-native";

const { width } = Dimensions.get("window");

export const firebaseLogin = async () => {
  if (!auth.currentUser) {
    await signInAnonymously(auth);
  }
};

const HomeScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { userId, authLoading, isAuthenticated, userDetails } = useAuth();
  const isFocused = useIsFocused();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserName] = useState(null);
  const [userLogo, setUserLogo] = useState(null);
  const [projectDetails, setProjectDetails] = useState([]);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [totalIncomes, setTotalIncomes] = useState(0);
  const [netBalance, setNetBalance] = useState(0);
  const [scrollY] = useState(new Animated.Value(0));
  const [incomeModalVisible, setIncomeModalVisible] = useState(false);
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);
  const [heroCardHeight, setHeroCardHeight] = useState(0);

  // First-run onboarding
  const [welcomeVisible, setWelcomeVisible] = useState(false);

  // Tour overlay
  const [tourVisible, setTourVisible] = useState(false);
  const [tourStep, setTourStep]       = useState(1);

  // One ref per tour target — measured at runtime
  const refHeroCard   = useRef(null);
  const refAddIncome  = useRef(null);
  const refNewProject = useRef(null);
  const refAddExpense = useRef(null);
  const refCashFlow   = useRef(null);

  // Biz details gate
  const [bizVisible, setBizVisible] = useState(false);
  const [bizId, setBizId] = useState("");
  const [bizAddress, setBizAddress] = useState("");
  const [bizState, setBizState] = useState("");
  const [bizCountry, setBizCountry] = useState("US");
  const [bizZip, setBizZip] = useState("");
  const [bizSaving, setBizSaving] = useState(false);
  const [bizErrors, setBizErrors] = useState({});
  const slideAnim = useRef(new Animated.Value(300)).current;

  // Tracks current scroll offset — ref to avoid re-renders
  const scrollOffsetRef = useRef(0);

  // Pre-measured tooltip card height — updated by off-screen View in render
  const tourCardHeightRef = useRef(180);
  const hasCheckedOnboarding = useRef(false);

  // Stores measured { x, y, width, height, pageX, pageY } per target
  const [measurements, setMeasurements] = useState({});

  /* ── Data fetching ── */
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
      setTotalExpenses(response.data?.totalExpenses ?? 0);
      setTotalIncomes(response.data?.totalIncomes ?? 0);
      const net = (response.data?.totalIncomes ?? 0) - (response.data?.totalExpenses ?? 0);
      setNetBalance(net);
      console.log("[HERO] fetchData complete — totalIncomes:", response.data?.totalIncomes, "totalExpenses:", response.data?.totalExpenses, "net:", net);
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

  /* ── Measurement ── */
  const measureTargets = () => {
    const keys = ["heroCard", "newProject", "addIncome", "addExpense", "cashFlow"];
    const refs = [refHeroCard, refNewProject, refAddIncome, refAddExpense, refCashFlow];
    const next = {};
    let done = 0;
    const ratio = PixelRatio.get();

    refs.forEach((ref, i) => {
      if (ref.current) {
        ref.current.measure((x, y, width, height, pageX, pageY) => {
          // .measure() should return points but some Android versions return pixels.
          // Detect: if pageX > SCREEN_W, values are in pixels — divide by ratio.
          const { width: screenW } = Dimensions.get("window");
          const needsRatio = pageX > screenW;
          const px = needsRatio ? pageX / ratio : pageX;
          const py = needsRatio ? pageY / ratio : pageY;
          const pw = needsRatio ? width  / ratio : width;
          const ph = needsRatio ? height / ratio : height;
          next[keys[i]] = { pageX: px, pageY: py, width: pw, height: ph };
          console.log(`[TOUR] ${keys[i]}: pageX=${px.toFixed(1)} pageY=${py.toFixed(1)} w=${pw.toFixed(1)} h=${ph.toFixed(1)} needsRatio=${needsRatio}`);
          done++;
          if (done === keys.length) setMeasurements({ ...next });
        });
      }
    });
  };

  /* ── Tour handlers ── */
  const handleTourStart = useCallback(() => {
    setTimeout(() => {
      measureTargets();
    }, 200);
    setTimeout(() => {
      // console.log("[TOUR] 800ms setTimeout firing, calling setTourVisible");
      // console.log("[TOUR] About to setTourVisible true");
      setTourStep(1);
      setTourVisible(true);
      AsyncStorage.setItem(`maggo_tour_step_${userId}`, "1");
    }, 800);
  }, []);

  const handleTourNext = async () => {
    if (tourStep >= 5) {
      setTourVisible(false);
      setTourStep(1);
      await AsyncStorage.setItem(`maggo_tour_step_${userId}`, "0");
      await AsyncStorage.setItem(`maggo_checklist_dismissed_${userId}`, "true");
    } else {
      const next = tourStep + 1;
      setTourStep(next);
      await AsyncStorage.setItem(`maggo_tour_step_${userId}`, String(next));
    }
  };

  const handleTourSkip = async () => {
    setTourVisible(false);
    setTourStep(1);
    await AsyncStorage.setItem(`maggo_tour_step_${userId}`, "0");
    await AsyncStorage.setItem(`maggo_checklist_dismissed_${userId}`, "true");
  };

  /* ── Effects ── */
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
      // Small delay lets the layout settle before measuring
      setTimeout(measureTargets, 400);
    }
  }, [isFocused]);

  // First-run: show welcome modal and resume tour if in progress
  useEffect(() => {
    if (authLoading) return;
    if (!userId) return;
    if (hasCheckedOnboarding.current) return;
    hasCheckedOnboarding.current = true;

    const checkFirstRun = async () => {
      const onboardingDone = await AsyncStorage.getItem(`maggo_onboarding_complete_${userId}`);
      if (!onboardingDone) {
        setWelcomeVisible(true);
        return;
      }
      // Returning user — resume tour only if interrupted mid-session
      const savedStep = await AsyncStorage.getItem(`maggo_tour_step_${userId}`);
      const step = parseInt(savedStep, 10) || 0;
      if (step > 0) {
        setTourStep(step);
        setTourVisible(true);
        setTimeout(measureTargets, 400);
      }
    };

    checkFirstRun();
  }, [authLoading, userId]);

  /* ── Demo project seeding ── */
  const DEMO_PROJECTS = {
    freelancer: { name: "Brand identity for Acme Co.", task: "Initial concepts" },
    agency:     { name: "Q3 campaign — Northfield",    task: "Creative brief"    },
    trades:     { name: "Kitchen renovation — Unit 4B", task: "Materials quote"  },
    other:      { name: "My first project",             task: "First task"       },
  };

  const handleWelcomeComplete = async (userType) => {
    await AsyncStorage.setItem(`maggo_onboarding_complete_${userId}`, "true");
    await AsyncStorage.setItem(`maggo_user_type_${userId}`, userType);
    setWelcomeVisible(false);
    // Seed demo project
    const demo = DEMO_PROJECTS[userType] || DEMO_PROJECTS.other;
    try {
      await api.post("/newProject", {
        name: demo.name,
        payment: 0,
        days: 30,
        toDoList: [{ task: demo.task, details: "" }],
        isDemo: true,
      });
      fetchData();
    } catch (e) {
      console.error("Demo project creation failed:", e);
    }
    handleTourStart();
  };

  /* ── Biz details gate ── */
  useEffect(() => {
    if (bizVisible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 4,
      }).start();
    } else {
      slideAnim.setValue(300);
    }
  }, [bizVisible]);

  const handleSaveBizDetails = async () => {
    const errs = {};
    if (!bizId.trim()) errs.bizId = "Business ID is required";
    if (!bizAddress.trim()) errs.bizAddress = "Address is required";
    if (!bizState.trim()) errs.bizState = "State is required";
    if (!bizCountry.trim()) errs.bizCountry = "Country is required";
    if (!bizZip.trim()) errs.bizZip = "ZIP Code is required";
    if (Object.keys(errs).length) { setBizErrors(errs); return; }
    setBizSaving(true);
    try {
      await api.post("/updateUser", {
        businessId: bizId.trim(),
        address: {
          street: bizAddress.trim(),
          state: bizState.trim().toUpperCase(),
          country: bizCountry.trim().toUpperCase(),
          zip: bizZip.trim(),
        },
      });
      await AsyncStorage.setItem("maggo_biz_details_complete", "true");
      setBizVisible(false);
      setIncomeModalVisible(true);
    } catch (e) {
      Alert.alert("Error", "Could not save details. Please try again.");
    } finally {
      setBizSaving(false);
    }
  };

  const handleAddIncomePress = async () => {
    const bizDone = await AsyncStorage.getItem("maggo_biz_details_complete");
    if (bizDone === "true") {
      setIncomeModalVisible(true);
    } else {
      setBizVisible(true);
    }
  };

  /* ── Auth guard ── */
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
      console.log("[HERO] submitIncomeReceipt called, fetching data...");
      await fetchData();
      console.log("[HERO] fetchData done after income submit");
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
    <Animated.View style={[styles.projectCardWrapper]}>
      <TouchableOpacity
        onPress={() => navigation.navigate("AboutProject", { project: item })}
        activeOpacity={0.7}
      >
        <Project
          userId={userId}
          id={item._id}
          projectName={item.name}
          totalDays={item.days}
          totalAmount={item.payment}
          isDemo={item.isDemo === true}
        />
      </TouchableOpacity>
    </Animated.View>
  );

  const renderEmptyProjects = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconCircle}>
        <Ionicons name="briefcase-outline" size={48} color="#9CA3AF" />
      </View>
      <Text style={styles.emptyTitle}>Track your projects</Text>
      <Text style={styles.emptySubtitle}>
        Manage tasks, invoices, and expenses in one place
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
          <Text style={styles.emptyButtonText}>Create your first project</Text>
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

  const handleAgentPress = async () => {
    try {
      const subscription = await refreshSubscriptionStatus();
      if (hasProAccess(subscription)) {
        navigation.navigate("AgentScreen");
      } else {
        try {
          await presentRevenueCatPaywallIfNeeded();
        } catch {
          navigation.navigate("SubscriptionScreen");
        }
      }
    } catch (err) {
      navigation.navigate("AgentScreen");
    }
  };

  return (
    <View style={styles.screen}>
      <WelcomeModal visible={welcomeVisible} onComplete={handleWelcomeComplete} />

      {/* Biz details gate — shown before income modal, no Modal nesting */}
      {bizVisible && (
        <View style={{
          position: "absolute",
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(0,0,0,0.45)",
          justifyContent: "flex-end",
          zIndex: 9999,
          elevation: 9999,
        }}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
            <Animated.View style={[styles.bizSheet, { transform: [{ translateY: slideAnim }] }]}>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="none"
                showsVerticalScrollIndicator={false}
                style={{ width: "100%" }}
                contentContainerStyle={{ alignItems: "center" }}
              >
                <View style={styles.bizHandle} />
                <View style={styles.bizIconCircle}>
                  <Building2 size={28} color="#3B82F6" />
                </View>
                <Text style={styles.bizTitle}>One last thing</Text>
                <Text style={styles.bizSubtitle}>
                  Your business details are printed on every invoice. Fill them once and you're done.
                </Text>
                <View style={styles.bizField}>
                  <Text style={styles.bizLabel}>Business ID / Tax Number</Text>
                  <TextInput
                    style={[styles.bizInput, bizErrors.bizId && styles.bizInputError]}
                    value={bizId}
                    onChangeText={(v) => { setBizId(v); setBizErrors((e) => ({ ...e, bizId: null })); }}
                    placeholder="e.g. 12-3456789"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                  />
                  {bizErrors.bizId ? <Text style={styles.bizErrText}>{bizErrors.bizId}</Text> : null}
                </View>
                <View style={styles.bizField}>
                  <Text style={styles.bizLabel}>Business Address</Text>
                  <TextInput
                    style={[styles.bizInput, bizErrors.bizAddress && styles.bizInputError]}
                    value={bizAddress}
                    onChangeText={(v) => { setBizAddress(v); setBizErrors((e) => ({ ...e, bizAddress: null })); }}
                    placeholder="123 Main St"
                    placeholderTextColor="#9CA3AF"
                  />
                  {bizErrors.bizAddress ? <Text style={styles.bizErrText}>{bizErrors.bizAddress}</Text> : null}
                </View>
                <View style={styles.bizField}>
                  <Text style={styles.bizLabel}>State</Text>
                  <TextInput
                    style={[styles.bizInput, bizErrors.bizState && styles.bizInputError]}
                    value={bizState}
                    onChangeText={(v) => { setBizState(v); setBizErrors((e) => ({ ...e, bizState: null })); }}
                    placeholder="e.g. NY"
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="characters"
                    maxLength={2}
                  />
                  {bizErrors.bizState ? <Text style={styles.bizErrText}>{bizErrors.bizState}</Text> : null}
                </View>
                <View style={styles.bizField}>
                  <Text style={styles.bizLabel}>Country</Text>
                  <TextInput
                    style={[styles.bizInput, bizErrors.bizCountry && styles.bizInputError]}
                    value={bizCountry}
                    onChangeText={(v) => { setBizCountry(v); setBizErrors((e) => ({ ...e, bizCountry: null })); }}
                    placeholder="e.g. US"
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="characters"
                    maxLength={2}
                  />
                  {bizErrors.bizCountry ? <Text style={styles.bizErrText}>{bizErrors.bizCountry}</Text> : null}
                </View>
                <View style={styles.bizField}>
                  <Text style={styles.bizLabel}>ZIP Code</Text>
                  <TextInput
                    style={[styles.bizInput, bizErrors.bizZip && styles.bizInputError]}
                    value={bizZip}
                    onChangeText={(v) => { setBizZip(v); setBizErrors((e) => ({ ...e, bizZip: null })); }}
                    placeholder="10001"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                  />
                  {bizErrors.bizZip ? <Text style={styles.bizErrText}>{bizErrors.bizZip}</Text> : null}
                </View>
                <TouchableOpacity
                  style={styles.bizSaveBtn}
                  onPress={handleSaveBizDetails}
                  disabled={bizSaving}
                  activeOpacity={0.85}
                >
                  {bizSaving
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.bizSaveBtnText}>Save & Continue</Text>
                  }
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.bizSkipBtn}
                  onPress={() => { setBizVisible(false); setIncomeModalVisible(true); }}
                >
                  <Text style={styles.bizSkipText}>Skip for now</Text>
                </TouchableOpacity>
              </ScrollView>
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      )}

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
        scrollEnabled={!incomeModalVisible && !receiptModalVisible}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          {
            useNativeDriver: true,
            listener: (e) => { scrollOffsetRef.current = e.nativeEvent.contentOffset.y; }
          }
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
              <TouchableOpacity style={styles.seeAllButton} onPress={() => navigation.navigate("Finance")}>
                <Text style={styles.seeAllText}>See All</Text>
                <Ionicons name="arrow-forward" size={16} color="#3B82F6" />
              </TouchableOpacity>
            </View>
            <View
              ref={refHeroCard}
              onLayout={(e) => setHeroCardHeight(e.nativeEvent.layout.height)}
              style={{
                borderRadius: 24,
                padding: 24,
                backgroundColor: "#0F172A",
                overflow: "hidden",
                shadowColor: "#000",
                shadowOpacity: 0.25,
                shadowRadius: 20,
                shadowOffset: { width: 0, height: 8 },
                elevation: 12,
              }}
            >
              {/* Period */}
              <Text style={{ fontSize: 11, fontWeight: "700", color: "rgba(255,255,255,0.4)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>
                {new Date().toLocaleString("default", { month: "long", year: "numeric" })}
              </Text>

              {/* Label */}
              <Text style={{ fontSize: 13, fontWeight: "600", color: "rgba(255,255,255,0.55)", marginBottom: 8 }}>
                Net Balance
              </Text>

              {/* Hero number */}
              <Text style={{
                fontSize: 42,
                fontWeight: "800",
                color: netBalance >= 0 ? "#34d399" : "#f87171",
                letterSpacing: -1.5,
                lineHeight: 44,
                marginBottom: 20,
              }}>
                {netBalance >= 0 ? "+" : ""}{formatCurrency(
                                        netBalance,
                                        userDetails?.currency || "USD",
                                        userDetails?.locale || "en-US"
                                      )}
              </Text>

              {/* Divider */}
              <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.07)", marginBottom: 16 }} />

              {/* Income + Expense pills */}
              <View style={{ flexDirection: "row", gap: 10 }}>
                {/* Income pill */}
                <View style={{
                  flex: 1, flexDirection: "row", alignItems: "center", gap: 10,
                  backgroundColor: "rgba(255,255,255,0.07)",
                  borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
                  borderRadius: 14, padding: 12,
                }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#34d399" }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 10, fontWeight: "600", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>Income</Text>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: "rgba(255,255,255,0.9)" }}>{formatCurrency(
                                            totalIncomes,
                                            userDetails?.currency || "USD",
                                            userDetails?.locale || "en-US"
                                          )}</Text>
                  </View>
                </View>
                {/* Expense pill */}
                <View style={{
                  flex: 1, flexDirection: "row", alignItems: "center", gap: 10,
                  backgroundColor: "rgba(255,255,255,0.07)",
                  borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
                  borderRadius: 14, padding: 12,
                }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#f87171" }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 10, fontWeight: "600", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>Expenses</Text>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: "rgba(255,255,255,0.9)" }}>{formatCurrency(
                                            totalExpenses,
                                            userDetails?.currency || "USD",
                                            userDetails?.locale || "en-US"
                                          )}</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Quick Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.quickActions}>

              {/* New Project */}
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => navigation.navigate("NewProject")}
              >
                <View ref={refNewProject} style={[styles.actionIcon, tourVisible && tourStep === 2 && { shadowOpacity: 0, elevation: 0 }]}>
                  <Ionicons name="add-circle" size={24} color="#3B82F6" />
                </View>
                <Text style={styles.actionText}>New Project</Text>
              </TouchableOpacity>

              {/* Add Income */}
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleAddIncomePress}
              >
                <View ref={refAddIncome} style={[styles.actionIcon, tourVisible && tourStep === 3 && { shadowOpacity: 0, elevation: 0 }]}>
                  <Ionicons name="cash" size={24} color="#10B981" />
                </View>
                <Text style={styles.actionText}>Add Income</Text>
              </TouchableOpacity>

              {/* Add Expense */}
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => setReceiptModalVisible(true)}
              >
                <View ref={refAddExpense} style={[styles.actionIcon, tourVisible && tourStep === 4 && { shadowOpacity: 0, elevation: 0 }]}>
                  <Ionicons name="card" size={24} color="#EF4444" />
                </View>
                <Text style={styles.actionText}>Add Expense</Text>
              </TouchableOpacity>

              {/* CashFlow */}
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => navigation.navigate("CashFlow")}
              >
                <View ref={refCashFlow} style={[styles.actionIcon, tourVisible && tourStep === 5 && { shadowOpacity: 0, elevation: 0 }]}>
                  <Ionicons name="stats-chart" size={24} color="#8B5CF6" />
                </View>
                <Text style={styles.actionText}>CashFlow</Text>
              </TouchableOpacity>

            </View>

            {/* Modals live outside the flex row to avoid layout side-effects */}
            <Modal visible={incomeModalVisible} animationType="fade" transparent statusBarTranslucent onRequestClose={() => setIncomeModalVisible(false)}>
              <View style={styles.backdrop}>
                <View style={styles.modalCard}>
                  <IncomeReceiptGenerator
                    onSubmit={(data) => { submitIncomeReceipt(data); setIncomeModalVisible(false); }}
                    onClose={() => setIncomeModalVisible(false)}
                  />
                </View>
              </View>
            </Modal>
            <Modal visible={receiptModalVisible} transparent animationType="fade" statusBarTranslucent>
              <View style={styles.backdrop}>
                <View style={styles.modalCard}>
                  <Receipts
                    onClose={() => setReceiptModalVisible(false)}
                    onSubmit={() => { setReceiptModalVisible(false); fetchData(); }}
                  />
                </View>
              </View>
            </Modal>
          </View>

          {/* Projects Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                Active Projects | {projectDetails.length}
              </Text>
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
      <View style={styles.navContainer}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={handleAgentPress}
        >
          <Ionicons name="sparkles-outline" size={31} color="#10b981" />
        </TouchableOpacity>
      </View>

      {/* TourOverlay card pre-measure — off screen, always mounted */}
      <View
        style={{ position: "absolute", top: -9999, left: 0, width: 260, opacity: 0, pointerEvents: "none" }}
        onLayout={(e) => { tourCardHeightRef.current = e.nativeEvent.layout.height; }}
      >
        <Text style={{ fontSize: 10, marginBottom: 7 }}>Step 1 of 5</Text>
        <Text style={{ fontSize: 15, fontWeight: "700", marginBottom: 6, lineHeight: 21 }}>
          Your income, live
        </Text>
        <Text style={{ fontSize: 12, lineHeight: 18, marginBottom: 16 }}>
          Every payment you log shows up here instantly.
        </Text>
        <View style={{ height: 30 }} />
      </View>

      <SpotlightOverlay
        visible={tourVisible}
        measurement={measurements[TOUR_STEPS[tourStep - 1]?.key]}
        onPress={handleTourSkip}
        measurementKey={TOUR_STEPS[tourStep - 1]?.key}
        cardHeights={{ heroCard: heroCardHeight }}
        scrollOffset={scrollOffsetRef.current}
      />

      <TourOverlay
        visible={tourVisible}
        step={tourStep}
        measurements={measurements}
        onNext={handleTourNext}
        onSkip={handleTourSkip}
        cardHeightRef={tourCardHeightRef}
        scrollOffset={scrollOffsetRef.current}
      />
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
    paddingBottom: 17,
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
    width: 58,
    height: 58,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: "#fff",
    justifyContent: "center"
  },
  avatar: {
    width: 52,
    height: 52,
    alignSelf: "center",
    borderRadius: 50,
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
    // marginTop: 40,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    // marginBottom: 16,
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
    backgroundColor: "#ffffff",
    borderRadius: 24,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
    overflow: "visible",
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

  navContainer: {
    position: "absolute",
    bottom: 25,
    alignSelf: "flex-end",
    height: 70,
    width: 70,
    flexDirection: "row",
    borderRadius: 50,
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: "#ffffff",
    paddingVertical: 0,
    marginHorizontal: 25,
    borderTopColor: "#e0e0e0",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.15,
        shadowOffset: { width: 0, height: 0 },
        shadowRadius: 5,
      },
      android: {
        elevation: 5,
        shadowColor: "#000",
      }
    }),
  },
  navButton: {
    alignItems: "center",
    justifyContent: "center",
  },
  navText: {
    fontSize: 12,
    color: "#00796b",
    marginTop: 4,
    fontWeight: "400",
  },

  // ── Business details sheet ──
  bizSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 28,
    paddingBottom: 44,
    alignItems: "center",
  },
  bizHandle: {
    width: 40, height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EB",
    marginBottom: 24,
  },
  bizIconCircle: {
    width: 72, height: 72,
    borderRadius: 36,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  bizTitle: {
    fontSize: 22, fontWeight: "800",
    color: "#111827",
    marginBottom: 8,
    textAlign: "center",
  },
  bizSubtitle: {
    fontSize: 14, color: "#6B7280",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  bizField: {
    width: "100%",
    marginBottom: 16,
  },
  bizLabel: {
    fontSize: 13, fontWeight: "700",
    color: "#374151",
    marginBottom: 6,
  },
  bizInput: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    paddingVertical: 13,
    paddingHorizontal: 14,
    fontSize: 15,
    color: "#111827",
    width: "100%",
  },
  bizInputError: {
    borderColor: "#EF4444",
  },
  bizErrText: {
    fontSize: 12, color: "#EF4444",
    marginTop: 4,
  },
  bizSaveBtn: {
    backgroundColor: "#2563EB",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    width: "100%",
    marginTop: 8,
  },
  bizSaveBtnText: {
    color: "#fff", fontSize: 16, fontWeight: "700",
  },
  bizSkipBtn: {
    marginTop: 14, paddingVertical: 6,
  },
  bizSkipText: {
    fontSize: 14, color: "#9CA3AF", fontWeight: "600",
  },
});

/* ─────────────────────────────────────────────
   SPOTLIGHT OVERLAY
───────────────────────────────────────────── */
const SpotlightOverlay = ({ visible, measurement, onPress, measurementKey, cardHeights = {}, scrollOffset = 0 }) => {
  if (!visible || !measurement) return null;

  const { width: SW, height: SH } = Dimensions.get("window");
  const statusBarHeight = StatusBar.currentHeight || 0;
  const { pageX, pageY, width: mW, height: mH } = measurement;

  const adjustedH = (measurementKey === "heroCard" && cardHeights.heroCard > 0)
    ? cardHeights.heroCard
    : mH;

  const holeTop    = Math.floor(pageY - statusBarHeight - scrollOffset);
  const holeLeft   = Math.floor(pageX);
  const holeWidth  = Math.ceil(mW);
  const holeHeight = Math.ceil(adjustedH - 1);
  const radius     = measurementKey === "heroCard" ? 30 : 16;
  const RGBA       = "rgb(15,23,42)";

  // SVG even-odd path: full screen rect minus a rounded rect hole
  const r = radius;
  const x = holeLeft;
  const y = holeTop;
  const w = holeWidth;
  const h = holeHeight;

  const holePath   = `M${x + r} ${y} H${x + w - r} Q${x + w} ${y} ${x + w} ${y + r} V${y + h - r} Q${x + w} ${y + h} ${x + w - r} ${y + h} H${x + r} Q${x} ${y + h} ${x} ${y + h - r} V${y + r} Q${x} ${y} ${x + r} ${y} Z`;
  const screenPath = `M0 0 H${SW} V${SH} H0 Z`;
  const svgPath    = `${screenPath} ${holePath}`;

  return (
    <View pointerEvents="box-none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 }}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      >
        <Svg width={SW} height={SH}>
          <Path
            d={svgPath}
            fill={RGBA}
            fillOpacity={0.62}
            fillRule="evenodd"
          />
          {/* White border ring around hole */}
          {/* <Rect
            x={x - 1}
            y={y - 1}
            width={w + 2}
            height={h + 2}
            rx={r }
            ry={r + 1}
            fill="none"
            stroke="rgba(255,255,255,0.3)"
            strokeWidth={2}
          /> */}
        </Svg>
      </TouchableOpacity>
    </View>
  );
};

/* ─────────────────────────────────────────────
   TOUR OVERLAY
───────────────────────────────────────────── */
const TOUR_STEPS = [
  {
    key: "heroCard",
    headline: "Your business at a glance",
    body: "Net balance updates in real time. Green means you're profitable this month — red means it's time to check your expenses.",
  },
  {
    key: "newProject",
    headline: "Start a project",
    body: "Each project gets tasks, a timeline, and its own invoice. Your work — finally in one place.",
  },
  {
    key: "addIncome",
    headline: "Log a payment received",
    body: "Got paid for a job? Record it here. Your net balance updates instantly.",
  },
  {
    key: "addExpense",
    headline: "Log an expense",
    body: "Bought something for a job? Add it here. Maggo links it to the right project automatically.",
  },
  {
    key: "cashFlow",
    headline: "See your cash flow",
    body: "The clearest view of money in vs out. Finally know if you're actually making money this month.",
  },
];

const CARD_WIDTH  = 260;
const CARD_PADDING = 18;
const ARROW_SIZE  = 8;

const TourOverlay = ({ visible, step, measurements, onNext, onSkip, cardHeightRef, scrollOffset = 0 }) => {
  const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
  const statusBarHeight = StatusBar.currentHeight || 0;
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    if (visible) {
      fadeAnim.setValue(0);
      slideAnim.setValue(8);
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, step]);

  const stepIndex  = step - 1;
  const stepData   = TOUR_STEPS[stepIndex];
  const isLastStep = step === TOUR_STEPS.length;
  const m          = measurements[stepData?.key];

  // ── Card position — computed from real measurements ──
  let cardTop        = SCREEN_H / 2 - 80;
  let cardLeft       = (SCREEN_W - CARD_WIDTH) / 2;
  let arrowStyle     = {};
  let arrowPointsUp  = true; // true = card is above target, arrow points down at bottom of card

  if (m) {
    const targetCenterX = m.pageX + m.width / 2;
    const targetBottom  = m.pageY - statusBarHeight - scrollOffset + m.height;
    const targetTop     = m.pageY - statusBarHeight - scrollOffset;
    const cardHeight    = cardHeightRef.current;
    const spaceBelow    = SCREEN_H - targetBottom;

    if (spaceBelow >= cardHeight + 24) {
      // Place below target — arrow on top of card, points up
      cardTop       = targetBottom + 14;
      arrowPointsUp = false;
    } else {
      // Place above target — arrow on bottom of card, points down
      cardTop       = targetTop - cardHeight - 14;
      arrowPointsUp = true;
    }

    cardLeft = Math.max(16, Math.min(SCREEN_W - CARD_WIDTH - 16, targetCenterX - CARD_WIDTH / 2));

    const arrowX = Math.max(16, Math.min(CARD_WIDTH - 24, targetCenterX - cardLeft - ARROW_SIZE));
    arrowStyle = arrowPointsUp
      ? { bottom: -ARROW_SIZE, left: arrowX }
      : { top:    -ARROW_SIZE, left: arrowX };
  }

  const arrowBorderStyle = arrowPointsUp
    ? { borderTopWidth: ARROW_SIZE, borderTopColor: "#1E293B", borderBottomWidth: 0 }
    : { borderBottomWidth: ARROW_SIZE, borderBottomColor: "#1E293B", borderTopWidth: 0 };

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <View style={{ flex: 1 }}>

        {/* Tooltip card */}
        <Animated.View
          style={{
            position:        "absolute",
            top:             cardTop,
            left:            cardLeft,
            width:           CARD_WIDTH,
            backgroundColor: "#1E293B",
            borderRadius:    18,
            padding:         CARD_PADDING,
            shadowColor:     "#000",
            shadowOpacity:   0.45,
            shadowRadius:    20,
            shadowOffset:    { width: 0, height: 8 },
            elevation:       24,
            opacity:         fadeAnim,
            transform:       [{ translateY: slideAnim }],
          }}
        >
          {/* Arrow pointer */}
          <View style={{
            position:         "absolute",
            width:            0,
            height:           0,
            borderLeftWidth:  ARROW_SIZE,
            borderRightWidth: ARROW_SIZE,
            borderLeftColor:  "transparent",
            borderRightColor: "transparent",
            ...arrowBorderStyle,
            ...arrowStyle,
          }} />

          {/* Step counter */}
          <Text style={{
            fontSize:      10,
            fontWeight:    "700",
            color:         "#475569",
            letterSpacing: 1,
            marginBottom:  7,
            textTransform: "uppercase",
          }}>
            Step {step} of {TOUR_STEPS.length}
          </Text>

          {/* Headline */}
          <Text style={{
            fontSize:     15,
            fontWeight:   "700",
            color:        "#F1F5F9",
            marginBottom: 6,
            lineHeight:   21,
          }}>
            {stepData?.headline}
          </Text>

          {/* Body */}
          <Text style={{
            fontSize:     12,
            color:        "#94A3B8",
            lineHeight:   18,
            marginBottom: 16,
          }}>
            {stepData?.body}
          </Text>

          {/* Footer */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            {/* Dot progress */}
            <View style={{ flexDirection: "row", gap: 5, alignItems: "center" }}>
              {TOUR_STEPS.map((_, i) => (
                <View key={i} style={{
                  height:          6,
                  width:           i === stepIndex ? 14 : 6,
                  borderRadius:    3,
                  backgroundColor: i === stepIndex ? "#3B82F6" : "#334155",
                }} />
              ))}
            </View>

            {/* Buttons */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <TouchableOpacity onPress={onSkip} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={{ fontSize: 12, color: "#475569", paddingHorizontal: 6 }}>Skip</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onNext}
                style={{
                  backgroundColor:  "#3B82F6",
                  borderRadius:     8,
                  paddingVertical:  7,
                  paddingHorizontal: 14,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: "#fff" }}>
                  {isLastStep ? "Done ✓" : "Next →"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>

      </View>
    </Modal>
  );
};

export default HomeScreen;
