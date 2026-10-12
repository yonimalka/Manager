import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  InputAccessoryView,
  ScrollView,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  RefreshControl,
  I18nManager,
  Alert,
  Image,
  Animated,
  Dimensions,
  useWindowDimensions,
  Modal,
  Platform,
  PixelRatio,
  StatusBar,
  KeyboardAvoidingView,
  Keyboard,
  Linking,
} from "react-native";
import { useRoute, useNavigation, useIsFocused } from "@react-navigation/native";
// import { SERVER_URL } from "@env";
// import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AgentScreen from "./AgentScreen";
import Receipts from "./Receipts";

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
import DateTimePicker from "@react-native-community/datetimepicker";
import Svg, { Path, Rect } from "react-native-svg";
import { Building2 } from "lucide-react-native";
import { registerPushToken } from "../utils/registerPushToken";
import { track } from "../utils/analytics";
import { useSafeAreaInsets } from "react-native-safe-area-context";


const { width } = Dimensions.get("window");

export const firebaseLogin = async () => {
  if (!auth.currentUser) {
    await signInAnonymously(auth);
  }
};

const calcDayDiff = (dueDate) => {
  const now = new Date();
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const due = new Date(dueDate);
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  return Math.round((dueDay - nowDay) / (1000 * 60 * 60 * 24));
};

const isRemindedToday = (inv) => {
  if (!inv.lastRemindedAt) return false;
  const today = new Date();
  const d = new Date(inv.lastRemindedAt);
  return d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
};

const HomeScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { userId, authLoading, isAuthenticated, userDetails } = useAuth();
  const isFocused = useIsFocused();
  const { height: windowHeight } = useWindowDimensions();
  const { top: topInset } = useSafeAreaInsets();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserName] = useState(null);
  const [userLogo, setUserLogo] = useState(null);
  const [projectDetails, setProjectDetails] = useState([]);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [totalIncomes, setTotalIncomes] = useState(0);
  const [netBalance, setNetBalance] = useState(0);
  const [scrollY] = useState(new Animated.Value(0));

  const [receiptModalVisible, setReceiptModalVisible] = useState(false);
  const [heroCardHeight, setHeroCardHeight] = useState(0);

  // Post-tour nudge + post-income success
  const [showNudge, setShowNudge] = useState(false);
  const [postIncomeVisible, setPostIncomeVisible] = useState(false);

  // Lightweight log income modal
  const [logIncomeVisible, setLogIncomeVisible] = useState(false);
  const logIncomeSheetY = useRef(new Animated.Value(600)).current;
  useEffect(() => {
    if (logIncomeVisible) {
      logIncomeSheetY.setValue(0);
      requestAnimationFrame(() => logIncomeAmountRef.current?.focus());
    }
  }, [logIncomeVisible]);
  const [logIncomeAmount, setLogIncomeAmount] = useState("");
  const [logIncomeDescription, setLogIncomeDescription] = useState("");
  const [logIncomeProject, setLogIncomeProject] = useState(null);
  const [logIncomeSaving, setLogIncomeSaving] = useState(false);
  const [logIncomeDate, setLogIncomeDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Log income: paid vs owed segmented control
  const [logIncomePaidStatus, setLogIncomePaidStatus] = useState("paid");
  const [logIncomeClient, setLogIncomeClient] = useState("");
  const [logIncomeClientPhone, setLogIncomeClientPhone] = useState("");
  const [logIncomeDueDays, setLogIncomeDueDays] = useState(14);

  // Owed to You section
  const [owedSummary, setOwedSummary] = useState({ totalOwed: 0, overdueCount: 0, items: [] });

  // Remind sheet
  const [remindSheetVisible, setRemindSheetVisible] = useState(false);
  const [remindInvoice, setRemindInvoice] = useState(null);
  const [remindedIds, setRemindedIds] = useState({});

  const [kbHeight, setKbHeight] = useState(0);
  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const s = Keyboard.addListener(showEvt, (e) => setKbHeight(e.endCoordinates.height));
    const h = Keyboard.addListener(hideEvt, () => setKbHeight(0));
    return () => { s.remove(); h.remove(); };
  }, []);

  const logIncomeAmountRef = useRef(null);
  const logIncomeClientRef = useRef(null);
  const logIncomePhoneRef = useRef(null);
  const logIncomeDescRef = useRef(null);
  const logIncomeScrollRef = useRef(null);
  const LOG_INCOME_ACCESSORY_ID = "logIncomeAccessory";

  // First-run onboarding
  const [welcomeVisible, setWelcomeVisible] = useState(false);

  // Tour overlay
  const [tourVisible, setTourVisible] = useState(false);
  const [tourStep, setTourStep]       = useState(1);

  // One ref per tour target — measured at runtime
  const refHeroCard   = useRef(null);
  const refAddIncome  = useRef(null);
  const refOwed       = useRef(null);
  const refAddExpense = useRef(null);
  const refCashFlow   = useRef(null);

  // Scroll view ref for programmatic scrolling during tour
  const scrollViewRef = useRef(null);

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

      const [response, owedRes] = await Promise.all([
        api.get("/getUser"),
        api.get("/invoices/summary").catch(() => null),
      ]);
      setUserName(response.data?.name ?? "User");
      setUserLogo(response.data.logo);
      setProjectDetails(response.data?.projects ?? []);
      setTotalExpenses(response.data?.totalExpenses ?? 0);
      setTotalIncomes(response.data?.totalIncomes ?? 0);
      const net = (response.data?.totalIncomes ?? 0) - (response.data?.totalExpenses ?? 0);
      setNetBalance(net);
      if (owedRes?.data) setOwedSummary(owedRes.data);
      
    } catch (err) {
      console.error("Error fetching user data: ", err);
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
    const keys = ["heroCard", "addIncome", "owed", "addExpense", "cashFlow"];
    const refs = [refHeroCard, refAddIncome, refOwed, refAddExpense, refCashFlow];
    const next = {};
    // Only count refs that are currently mounted so the done-check can fire
    const mountedCount = refs.filter(r => r.current).length;
    if (mountedCount === 0) return;
    let done = 0;
    const ratio = PixelRatio.get();

    refs.forEach((ref, i) => {
      if (ref.current) {
        ref.current.measure((x, y, width, height, pageX, pageY) => {
          const { width: screenW } = Dimensions.get("window");
          const needsRatio = pageX > screenW;
          const px = needsRatio ? pageX / ratio : pageX;
          const py = needsRatio ? pageY / ratio : pageY;
          const pw = needsRatio ? width  / ratio : width;
          const ph = needsRatio ? height / ratio : height;
          next[keys[i]] = { pageX: px, pageY: py, width: pw, height: ph };
          done++;
          if (done === mountedCount) setMeasurements({ ...next });
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
      track("tour_started");
      AsyncStorage.setItem(`maggo_tour_step_${userId}`, "1");
    }, 800);
  }, []);

  const handleTourNext = async () => {
    if (tourStep >= TOUR_STEPS.length) {
      setTourVisible(false);
      setTourStep(1);
      setShowNudge(true);
      track("tour_completed");
      track("nudge_card_shown");
      await AsyncStorage.setItem(`maggo_tour_step_${userId}`, "0");
      await AsyncStorage.setItem(`maggo_checklist_dismissed_${userId}`, "true");
    } else {
      const next = tourStep + 1;
      // Step 3 is the Owed section — scroll it into view before the tooltip renders
      if (next === 3 && measurements.owed) {
        const docY = measurements.owed.pageY + scrollOffsetRef.current;
        try {
          scrollViewRef.current?.getScrollResponder()?.scrollTo({ y: Math.max(0, docY - 120), animated: true });
        } catch (_) {}
      }
      setTourStep(next);
      await AsyncStorage.setItem(`maggo_tour_step_${userId}`, String(next));
    }
  };

  const handleTourSkip = async () => {
    setTourVisible(false);
    track("tour_skipped", { skippedAtStep: tourStep });
    setTourStep(1);
    setShowNudge(true);
    track("nudge_card_shown");
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
    if (isFocused && !authLoading && isAuthenticated) {
      fetchData();
      api.post("/user/ping").catch(() => {});
      // Small delay lets the layout settle before measuring
      setTimeout(measureTargets, 400);
    }
  }, [isFocused, authLoading, isAuthenticated]);

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
      const rawStep = parseInt(savedStep, 10) || 0;
      const step = Math.min(rawStep, TOUR_STEPS.length);
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
    freelancer: { name: "Brand identity for Acme Co.", task: "Initial concepts", payment: 3200 },
    agency:     { name: "Q3 campaign — Northfield",    task: "Creative brief",   payment: 8500 },
    trades:     { name: "Kitchen renovation — Unit 4B", task: "Materials quote", payment: 4750 },
    other:      { name: "My first project",             task: "First task",      payment: 2500 },
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
        payment: demo.payment,
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

  const handleGenerateInvoicePress = () => {
    track("invoice_button_tapped");
    track("income_modal_opened", { source: "invoice" });
    navigation.navigate("InvoiceGenerator", {
      onSuccess: (data) => {
        submitIncomeReceipt(data);
      },
    });
  };

  const resetLogIncomeModal = () => {
    setLogIncomeAmount("");
    setLogIncomeDescription("");
    setLogIncomeProject(null);
    setLogIncomeDate(new Date());
    setShowDatePicker(false);
    setLogIncomePaidStatus("paid");
    setLogIncomeClient("");
    setLogIncomeClientPhone("");
    setLogIncomeDueDays(14);
  };

  const handleLogIncomeSubmit = async () => {
    logIncomeAmountRef.current?.blur();
    Keyboard.dismiss();
    if (!logIncomeAmount || isNaN(Number(logIncomeAmount)) || Number(logIncomeAmount) <= 0) {
      Alert.alert("Invalid amount", "Please enter a valid amount.");
      return;
    }

    if (logIncomePaidStatus === "owed") {
      if (!logIncomeClient.trim()) {
        Alert.alert("Client name required", "Please enter the client's name.");
        return;
      }
      setLogIncomeSaving(true);
      try {
        await api.post("/invoices", {
          client: logIncomeClient.trim(),
          clientPhone: logIncomeClientPhone.trim() || null,
          amount: Number(logIncomeAmount),
          projectId: logIncomeProject?._id || null,
          dueDays: logIncomeDueDays,
        });
        setLogIncomeVisible(false);
        resetLogIncomeModal();
        track("owed_entry_created", {
          amount: Number(logIncomeAmount),
          dueDays: logIncomeDueDays,
          hasProject: !!logIncomeProject,
        });
        await fetchData();
      } catch (e) {
        Alert.alert("Error", "Could not save. Please try again.");
      } finally {
        setLogIncomeSaving(false);
      }
      return;
    }

    setLogIncomeSaving(true);
    try {
      await api.post("/income", {
        amount: Number(logIncomeAmount),
        description: logIncomeDescription.trim() || "Income",
        projectId: logIncomeProject?._id || null,
        date: logIncomeDate.toISOString(),
      });
      setLogIncomeVisible(false);
      resetLogIncomeModal();
      track("income_saved", {
        amount: Number(logIncomeAmount),
        hasProject: !!logIncomeProject,
        hasDescription: !!logIncomeDescription.trim(),
      });
      await fetchData();
      showPostIncomeIfFirst();
      const alreadyAsked = await AsyncStorage.getItem("maggo_push_asked");
      if (!alreadyAsked) {
        await AsyncStorage.setItem("maggo_push_asked", "true");
        registerPushToken().catch(console.warn);
      }
    } catch (e) {
      Alert.alert("Error", "Could not save income. Please try again.");
    } finally {
      setLogIncomeSaving(false);
    }
  };

  const handleMarkPaid = (invoice) => {
    Alert.alert(
      "Mark as paid?",
      `${formatCurrency(invoice.amount, userDetails?.currency || "USD", userDetails?.locale || "en-US")} from ${invoice.client} will be added to this month's income.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, mark paid",
          onPress: async () => {
            try {
              await api.patch(`/invoices/${invoice._id}/pay`);
              track("owed_marked_paid", { amount: invoice.amount });
              await fetchData();
            } catch (e) {
              if (e.response?.status === 409) {
                await fetchData(); // already paid — just refresh silently
              } else {
                Alert.alert("Error", "Could not mark as paid. Please try again.");
              }
            }
          },
        },
      ]
    );
  };

  const handleOpenRemind = async (invoice) => {
    setRemindInvoice(invoice);
    setRemindSheetVisible(true);
    setRemindedIds(prev => ({ ...prev, [invoice._id]: true }));
    try {
      await api.patch(`/invoices/${invoice._id}/remind`);
      track("owed_reminder_sent", { amount: invoice.amount });
    } catch (e) {}
  };

  const getRemindMessage = (invoice) => {
    if (!invoice) return "";
    const clientFirst = (invoice.client || "there").trim().split(/\s+/)[0];
    const userFirst = (userName || "").trim().split(/\s+/)[0] || "me";
    const amt = formatCurrency(invoice.amount || 0, userDetails?.currency || "USD", userDetails?.locale || "en-US");
    const days = calcDayDiff(invoice.dueDate);
    if (days < 0) {
      const n = Math.abs(days);
      return `Hi ${clientFirst}, a quick reminder about the ${amt} payment for the job I did for you. It was due ${n} day${n !== 1 ? "s" : ""} ago. Could you take care of it this week? Thanks, ${userFirst}`;
    } else if (days === 0) {
      return `Hi ${clientFirst}, just a reminder that the ${amt} payment is due today. Thanks, ${userFirst}`;
    } else {
      return `Hi ${clientFirst}, a friendly heads-up that the ${amt} payment is due in ${days} day${days !== 1 ? "s" : ""}. Thanks, ${userFirst}`;
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

  const showPostIncomeIfFirst = async () => {
    const key = `maggo_post_income_nudge_${userId}`;
    const seen = await AsyncStorage.getItem(key);
    if (!seen) {
      await AsyncStorage.setItem(key, "true");
      setPostIncomeVisible(true);
    }
  };

  const submitIncomeReceipt = async (data) => {
    try {
      console.log("[HERO] submitIncomeReceipt called, fetching data...");
      await fetchData();
      console.log("[HERO] fetchData done after income submit");
      showPostIncomeIfFirst();
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
        onPress={() => { track("project_create_started"); navigation.navigate("NewProject"); }}
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
                {userName == "Apple User" ? "Hey there..." : userName}
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
                <Text style={styles.avatarInitials}>
                  {userName ? userName.trim().split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase() : "?"}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <Animated.ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!receiptModalVisible}
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
                    <Text style={{ fontSize: 10, fontWeight: "600", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>Earned</Text>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: "rgba(255,255,255,0.9)" }}>{formatCurrency(totalIncomes, userDetails?.currency || "USD", userDetails?.locale || "en-US")}</Text>
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
                    <Text style={{ fontSize: 14, fontWeight: "700", color: "rgba(255,255,255,0.9)" }}>{formatCurrency(totalExpenses, userDetails?.currency || "USD", userDetails?.locale || "en-US")}</Text>
                  </View>
                </View>
              </View>

              {/* In/out bar */}
              {(totalIncomes + totalExpenses) > 0 && (
                <View style={{ marginTop: 14, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                  <View style={{
                    height: 4, borderRadius: 2, backgroundColor: "#34d399",
                    width: `${Math.round(totalIncomes / (totalIncomes + totalExpenses) * 100)}%`,
                  }} />
                </View>
              )}

              {/* Tax estimate */}
              {netBalance > 0 && (
                <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 10, fontWeight: "500" }}>
                  {`Keep about ${formatCurrency(netBalance * 0.25, userDetails?.currency || "USD", userDetails?.locale || "en-US")} aside for tax.`}
                </Text>
              )}
            </View>
          </View>

          {/* Primary Actions */}
          <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
            {/* Log Payment */}
            <TouchableOpacity
              ref={refAddIncome}
              style={[
                styles.primaryActionBtn,
                { backgroundColor: tourVisible && tourStep === 2 ? "transparent" : "#10B981" },
              ]}
              onPress={() => {
                track("income_modal_opened", { source: "primary_btn" });
                setLogIncomeVisible(true);
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="cash" size={20} color="#fff" />
              <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>Log Payment</Text>
            </TouchableOpacity>

            {/* Add Expense */}
            <TouchableOpacity
              ref={refAddExpense}
              style={[
                styles.primaryActionBtn,
                {
                  backgroundColor: "#fff",
                  borderWidth: 1.5,
                  borderColor: "#E2E8F0",
                  shadowOpacity: tourVisible && tourStep === 4 ? 0 : 0.06,
                  elevation: tourVisible && tourStep === 4 ? 0 : 3,
                },
              ]}
              onPress={() => setReceiptModalVisible(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="card" size={20} color="#EF4444" />
              <Text style={{ fontSize: 14, fontWeight: "700", color: "#0F172A" }}>Add Expense</Text>
            </TouchableOpacity>
          </View>

          {/* Secondary Actions */}
          <View style={{ flexDirection: "row", gap: 12, marginBottom: 28 }}>
            <TouchableOpacity
              style={styles.secondaryActionBtn}
              onPress={() => {
                track("payment_receipt_opened");
                handleGenerateInvoicePress();
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="document-text-outline" size={16} color="#F59E0B" />
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#374151" }}>Payment Receipt</Text>
            </TouchableOpacity>
            <TouchableOpacity
              ref={refCashFlow}
              style={[
                styles.secondaryActionBtn,
                tourVisible && tourStep === 5 && { shadowOpacity: 0, elevation: 0 },
              ]}
              onPress={() => {
                track("cashflow_opened");
                navigation.navigate("CashFlow");
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="stats-chart" size={16} color="#8B5CF6" />
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#374151" }}>CashFlow</Text>
            </TouchableOpacity>
          </View>

          {/* Post-tour nudge card */}
          {showNudge && (
            <View style={{ backgroundColor: "#111827", borderRadius: 14, borderWidth: 0.5, borderColor: "rgba(255,255,255,0.08)", overflow: "hidden", marginBottom: 20 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 14, paddingBottom: 0 }}>
                <Text style={{ fontSize: 11, color: "#34d399", letterSpacing: 1.5, textTransform: "uppercase", fontWeight: "500" }}>Get started</Text>
                <TouchableOpacity onPress={() => setShowNudge(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>Dismiss</Text>
                </TouchableOpacity>
              </View>
              <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14 }}>
                <Text style={{ fontSize: 17, fontWeight: "600", color: "#F8FAFC", letterSpacing: -0.3, marginBottom: 4, lineHeight: 22 }}>
                  Ready, {userName?.split(" ")[0]}.
                </Text>
                <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", lineHeight: 19, marginBottom: 14 }}>
                  Log your first payment and watch your balance update live.
                </Text>
              </View>
              <View style={{ height: 0.5, backgroundColor: "rgba(255,255,255,0.07)", marginHorizontal: 16, marginBottom: 14 }} />
              <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingBottom: 14 }}>
                <TouchableOpacity style={{ flex: 1, paddingVertical: 9, borderRadius: 8, borderWidth: 0.5, borderColor: "rgba(255,255,255,0.1)", alignItems: "center" }} onPress={() => setShowNudge(false)}>
                  <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>Later</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 2, paddingVertical: 9, borderRadius: 8, backgroundColor: "#34d399", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 }}
                  onPress={() => { track("nudge_log_payment_tapped"); setShowNudge(false); track("income_modal_opened", { source: "nudge" }); setLogIncomeVisible(true); }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "600", color: "#052e16" }}>Log payment</Text>
                  <Ionicons name="arrow-forward" size={13} color="#052e16" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Owed to You */}
          <View ref={refOwed} style={{ marginBottom: 28 }}>
            {/* Header */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#0F172A", letterSpacing: -0.3 }}>Owed to You</Text>
              <TouchableOpacity
                style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: "#EFF6FF" }}
                onPress={() => {
                  track("income_modal_opened", { source: "owed_add" });
                  setLogIncomePaidStatus("owed");
                  setLogIncomeVisible(true);
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "600", color: "#2563EB" }}>+ Add</Text>
              </TouchableOpacity>
            </View>

            {owedSummary.items.length === 0 ? (
              /* Empty state */
              <View style={{ backgroundColor: "#fff", borderRadius: 16, padding: 28, alignItems: "center", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}>
                <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                  <Ionicons name="checkmark" size={20} color="#059669" />
                </View>
                <Text style={{ fontSize: 15, fontWeight: "600", color: "#0F172A", marginBottom: 6 }}>No one owes you right now</Text>
                <Text style={{ fontSize: 13, color: "#64748B", textAlign: "center", lineHeight: 20 }}>
                  {'When a client will pay later, log it as "Not yet" and it waits here until they do.'}
                </Text>
              </View>
            ) : (
              /* Single white card */
              <View style={{ backgroundColor: "#fff", borderRadius: 16, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}>

                {/* Summary row */}
                <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View>
                    <Text style={{ fontSize: 26, fontWeight: "800", color: "#0F172A", letterSpacing: -0.8 }}>
                      {formatCurrency(owedSummary.totalOwed, userDetails?.currency || "USD", userDetails?.locale || "en-US")}
                    </Text>
                    <Text style={{ fontSize: 13, color: "#64748B", marginTop: 2 }}>
                      {`from ${owedSummary.items.length} client${owedSummary.items.length !== 1 ? "s" : ""}`}
                    </Text>
                  </View>
                  {owedSummary.overdueCount > 0 && (
                    <View style={{ backgroundColor: "#FEF2F2", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
                      <Text style={{ fontSize: 12, fontWeight: "700", color: "#DC2626" }}>{owedSummary.overdueCount} late</Text>
                    </View>
                  )}
                </View>

                {/* Invoice rows — server already sorts overdue first then by dueDate */}
                {owedSummary.items.map((inv, rowIndex) => {
                  const days = calcDayDiff(inv.dueDate);
                  const isLate = days < 0;
                  const isToday = days === 0;
                  const isSoon = days >= 1 && days <= 3;
                  const reminded = !!remindedIds[inv._id] || isRemindedToday(inv);

                  // Initials
                  const words = (inv.client || "?").trim().split(/\s+/);
                  const initials = words.length >= 2
                    ? (words[0][0] + words[words.length - 1][0]).toUpperCase()
                    : words[0][0].toUpperCase();
                  const circleBg = isLate ? "#FEF2F2" : (isToday || isSoon) ? "#FFFBEB" : "#F1F5F9";
                  const circleText = isLate ? "#DC2626" : (isToday || isSoon) ? "#B45309" : "#475569";

                  // Status label
                  let statusLabel, statusColor, statusWeight;
                  if (isLate) {
                    const n = Math.abs(days);
                    statusLabel = `${n} day${n !== 1 ? "s" : ""} late`;
                    statusColor = "#DC2626"; statusWeight = "600";
                  } else if (isToday) {
                    statusLabel = "Due today";
                    statusColor = "#B45309"; statusWeight = "600";
                  } else if (days === 1) {
                    statusLabel = "Due tomorrow";
                    statusColor = "#B45309"; statusWeight = "600";
                  } else if (isSoon) {
                    statusLabel = `Due in ${days} days`;
                    statusColor = "#B45309"; statusWeight = "600";
                  } else {
                    statusLabel = `Due in ${days} days`;
                    statusColor = "#64748B"; statusWeight = "400";
                  }

                  // Progress bar (96px track)
                  let barPct;
                  if (days <= 0) {
                    barPct = 1;
                  } else {
                    const nowMs = Date.now();
                    const createdMs = new Date(inv.createdAt).getTime();
                    const dueMs = new Date(inv.dueDate).getTime();
                    const total = dueMs - createdMs;
                    barPct = total > 0 ? Math.max(0.06, Math.min(0.99, (nowMs - createdMs) / total)) : 0.06;
                  }
                  const barColor = isLate ? "#EF4444" : (isToday || isSoon) ? "#F59E0B" : "#94A3B8";

                  // Remind button style
                  let remBg, remBorderW, remBorderC, remTxt, remLabel;
                  if (reminded) {
                    remBg = "#F8FAFC"; remBorderW = 0; remBorderC = "transparent"; remTxt = "#94A3B8"; remLabel = "Sent";
                  } else if (isLate) {
                    remBg = "#FEF2F2"; remBorderW = 0; remBorderC = "transparent"; remTxt = "#DC2626"; remLabel = "Remind";
                  } else {
                    remBg = "#fff"; remBorderW = 1; remBorderC = "#E2E8F0"; remTxt = "#334155"; remLabel = "Remind";
                  }

                  return (
                    <View key={inv._id} style={{ borderTopWidth: rowIndex === 0 ? 0 : 1, borderTopColor: "#F1F5F9" }}>
                      <View style={{ flexDirection: "row" }}>
                        {/* Late left-edge bar */}
                        {isLate && <View style={{ width: 3, backgroundColor: "#EF4444" }} />}

                        <View style={{ flex: 1, paddingTop: 14, paddingBottom: 14, paddingLeft: isLate ? 13 : 16, paddingRight: 16 }}>
                          {/* Row 1: initials + name + amount */}
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
                            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: circleBg, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <Text style={{ fontSize: 13, fontWeight: "700", color: circleText }}>{initials}</Text>
                            </View>
                            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                              <Text style={{ fontSize: 16, fontWeight: "600", color: "#0F172A", flex: 1, marginRight: 8 }} numberOfLines={1}>{inv.client}</Text>
                              <Text style={{ fontSize: 16, fontWeight: "700", color: "#0F172A" }}>
                                {formatCurrency(inv.amount, userDetails?.currency || "USD", userDetails?.locale || "en-US")}
                              </Text>
                            </View>
                          </View>

                          {/* Row 2: status + bar (left), buttons (right) */}
                          <View style={{ flexDirection: "row", alignItems: "flex-end", marginLeft: 48, gap: 10 }}>
                            {/* Status + progress bar */}
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 13, fontWeight: statusWeight, color: statusColor, marginBottom: 5 }}>{statusLabel}</Text>
                              <View style={{ width: 96, height: 4, backgroundColor: "#F1F5F9", borderRadius: 2, overflow: "hidden" }}>
                                <View style={{ width: Math.round(barPct * 96), height: 4, backgroundColor: barColor, borderRadius: 2 }} />
                              </View>
                            </View>

                            {/* Action buttons */}
                            <View style={{ flexDirection: "row", gap: 6 }}>
                              <TouchableOpacity
                                onPress={() => { if (!reminded) handleOpenRemind(inv); }}
                                style={{ minHeight: 34, paddingHorizontal: 10, borderRadius: 10, backgroundColor: remBg, borderWidth: remBorderW, borderColor: remBorderC, flexDirection: "row", alignItems: "center", gap: 5 }}
                              >
                                <Ionicons name="chatbubble-outline" size={13} color={remTxt} />
                                <Text style={{ fontSize: 13, fontWeight: "600", color: remTxt }}>{remLabel}</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => handleMarkPaid(inv)}
                                style={{ minHeight: 34, paddingHorizontal: 10, borderRadius: 10, backgroundColor: "#ECFDF5", flexDirection: "row", alignItems: "center", gap: 5 }}
                              >
                                <Ionicons name="checkmark" size={13} color="#059669" />
                                <Text style={{ fontSize: 13, fontWeight: "700", color: "#059669" }}>Paid</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* Modals */}
          <View>
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

            {/* Log Income / Log Owed Modal */}
            <Modal
              visible={logIncomeVisible}
              animationType="fade"
              transparent
              statusBarTranslucent
              onRequestClose={() => {
                logIncomeAmountRef.current?.blur();
                Keyboard.dismiss();
                resetLogIncomeModal();
                setLogIncomeVisible(false);
              }}
            >
              <View style={{ flex: 1 }}>
                <Pressable
                  style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }}
                  onPress={() => {
                    logIncomeAmountRef.current?.blur();
                    Keyboard.dismiss();
                    resetLogIncomeModal();
                    setLogIncomeVisible(false);
                  }}
                />
                <KeyboardAvoidingView
                  behavior={Platform.OS === "ios" ? "padding" : "height"}
                  style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}
                >
                  <Animated.View style={{ transform: [{ translateY: logIncomeSheetY }] }}>
                  <ScrollView
                    ref={logIncomeScrollRef}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    style={{
                      backgroundColor: "#FFFFFF",
                      borderTopLeftRadius: 28,
                      borderTopRightRadius: 28,
                      maxHeight: kbHeight > 0
                        ? windowHeight - kbHeight - topInset - 24
                        : windowHeight * 0.88,
                    }}
                    contentContainerStyle={{ paddingBottom: Platform.OS === "ios" ? 40 : 28 }}
                    bounces={false}
                  >
                    {/* Drag pill */}
                    <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "#E5E7EB", alignSelf: "center", marginTop: 12 }} />

                    {/* Header */}
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 22, paddingTop: 18, paddingBottom: 4 }}>
                      <Text style={{ fontSize: 17, fontWeight: "700", color: "#0F172A", letterSpacing: -0.3 }}>Log income</Text>
                      <Pressable
                        onPress={() => {
                          logIncomeAmountRef.current?.blur();
                          Keyboard.dismiss();
                          track("income_modal_closed_no_save");
                          resetLogIncomeModal();
                          setLogIncomeVisible(false);
                        }}
                        style={({ pressed }) => ({ width: 28, height: 28, borderRadius: 14, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons name="close" size={15} color="#64748B" />
                      </Pressable>
                    </View>

                    {/* Segmented control: Has the money arrived? */}
                    <View style={{ paddingHorizontal: 22, paddingTop: 14, paddingBottom: 4 }}>
                      <Text style={{ fontSize: 12, fontWeight: "600", color: "#64748B", marginBottom: 8 }}>Has the money arrived?</Text>
                      <View style={{ flexDirection: "row", backgroundColor: "#F1F5F9", borderRadius: 10, padding: 3 }}>
                        <TouchableOpacity
                          style={{
                            flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center",
                            backgroundColor: logIncomePaidStatus === "paid" ? "#fff" : "transparent",
                            shadowColor: logIncomePaidStatus === "paid" ? "#000" : "transparent",
                            shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
                            elevation: logIncomePaidStatus === "paid" ? 2 : 0,
                          }}
                          onPress={() => setLogIncomePaidStatus("paid")}
                        >
                          <Text style={{ fontSize: 13, fontWeight: "600", color: logIncomePaidStatus === "paid" ? "#10B981" : "#94A3B8" }}>Yes, paid</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={{
                            flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center",
                            backgroundColor: logIncomePaidStatus === "owed" ? "#fff" : "transparent",
                            shadowColor: logIncomePaidStatus === "owed" ? "#000" : "transparent",
                            shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
                            elevation: logIncomePaidStatus === "owed" ? 2 : 0,
                          }}
                          onPress={() => setLogIncomePaidStatus("owed")}
                        >
                          <Text style={{ fontSize: 13, fontWeight: "600", color: logIncomePaidStatus === "owed" ? "#F59E0B" : "#94A3B8" }}>Not yet</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Amount hero */}
                    <View style={{ paddingVertical: kbHeight > 0 ? 10 : 20, paddingHorizontal: 22, alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#F1F5F9" }}>
                      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                        <Text style={{ fontSize: kbHeight > 0 ? 22 : 26, fontWeight: "600", color: logIncomeAmount ? "#94A3B8" : "#CBD5E1", marginTop: kbHeight > 0 ? 6 : 8, marginRight: 2 }}>$</Text>
                        <TextInput
                          ref={logIncomeAmountRef}
                          value={logIncomeAmount}
                          onChangeText={setLogIncomeAmount}
                          keyboardType="decimal-pad"
                          inputAccessoryViewID={LOG_INCOME_ACCESSORY_ID}
                          placeholder="0"
                          placeholderTextColor="#CBD5E1"
                          style={{ fontSize: kbHeight > 0 ? 44 : 56, fontWeight: "700", color: "#0F172A", letterSpacing: -2, minWidth: 60, maxWidth: 220, textAlign: "center", padding: 0 }}
                        />
                      </View>
                      <Text style={{ fontSize: 12, color: "#94A3B8", marginTop: 4 }}>
                        {logIncomePaidStatus === "paid" ? "Enter amount received" : "Enter amount owed"}
                      </Text>
                    </View>

                    {/* Project pills */}
                    {projectDetails.length > 0 && (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 14, paddingBottom: 2, gap: 8 }}>
                        <TouchableOpacity
                          onPress={() => setLogIncomeProject(null)}
                          style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: !logIncomeProject ? "#ECFDF5" : "#F8FAFC", borderWidth: 1, borderColor: !logIncomeProject ? "#34d399" : "#E2E8F0" }}
                        >
                          <Text style={{ fontSize: 12, fontWeight: !logIncomeProject ? "600" : "400", color: !logIncomeProject ? "#059669" : "#94A3B8" }}>No project</Text>
                        </TouchableOpacity>
                        {projectDetails.map((p) => (
                          <TouchableOpacity
                            key={p._id}
                            onPress={() => setLogIncomeProject(p)}
                            style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: logIncomeProject?._id === p._id ? "#ECFDF5" : "#F8FAFC", borderWidth: 1, borderColor: logIncomeProject?._id === p._id ? "#34d399" : "#E2E8F0" }}
                          >
                            <Text style={{ fontSize: 12, fontWeight: logIncomeProject?._id === p._id ? "600" : "400", color: logIncomeProject?._id === p._id ? "#059669" : "#64748B" }}>{p.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    )}

                    {/* Field rows — paid path */}
                    {logIncomePaidStatus === "paid" && (
                      <View style={{ paddingHorizontal: 22, marginTop: 12 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" }}>
                          <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: "#EFF6FF", alignItems: "center", justifyContent: "center" }}>
                            <Ionicons name="pencil-outline" size={16} color="#3B82F6" />
                          </View>
                          <TextInput
                            value={logIncomeDescription}
                            onChangeText={setLogIncomeDescription}
                            ref={logIncomeDescRef}
                            placeholder="Description (optional)"
                            placeholderTextColor="#CBD5E1"
                            style={{ flex: 1, fontSize: 14, color: "#0F172A", padding: 0 }}
                            returnKeyType="done"
                            autoCorrect={false}
                            spellCheck={false}
                            autoComplete="off"
                            onFocus={() => setTimeout(() => logIncomeScrollRef.current?.scrollToEnd({ animated: true }), 50)}
                          />
                        </View>
                        <TouchableOpacity onPress={() => setShowDatePicker(!showDatePicker)} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 }} activeOpacity={0.7}>
                          <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: "#FFFBEB", alignItems: "center", justifyContent: "center" }}>
                            <Ionicons name="calendar-outline" size={16} color="#F59E0B" />
                          </View>
                          <Text style={{ flex: 1, fontSize: 14, color: "#64748B" }}>Date</Text>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#F8FAFC", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: "#E2E8F0" }}>
                            <Text style={{ fontSize: 13, fontWeight: "600", color: "#0F172A" }}>
                              {logIncomeDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </Text>
                            <Ionicons name="chevron-down" size={13} color="#94A3B8" />
                          </View>
                        </TouchableOpacity>
                        {showDatePicker && (
                          <DateTimePicker
                            value={logIncomeDate}
                            mode="date"
                            display={Platform.OS === "ios" ? "inline" : "default"}
                            onChange={(event, selectedDate) => {
                              if (Platform.OS === "android") setShowDatePicker(false);
                              if (selectedDate) setLogIncomeDate(selectedDate);
                            }}
                            maximumDate={new Date()}
                            style={{ marginBottom: 8 }}
                            accentColor="#34d399"
                            themeVariant="light"
                          />
                        )}
                      </View>
                    )}

                    {/* Field rows — owed path */}
                    {logIncomePaidStatus === "owed" && (
                      <View style={{ paddingHorizontal: 22, marginTop: 12 }}>
                        {/* Client name */}
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" }}>
                          <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: "#EFF6FF", alignItems: "center", justifyContent: "center" }}>
                            <Ionicons name="person-outline" size={16} color="#3B82F6" />
                          </View>
                          <TextInput
                            value={logIncomeClient}
                            onChangeText={setLogIncomeClient}
                            ref={logIncomeClientRef}
                            placeholder="Client name (required)"
                            placeholderTextColor="#CBD5E1"
                            style={{ flex: 1, fontSize: 14, color: "#0F172A", padding: 0 }}
                            returnKeyType="next"
                            submitBehavior="submit"
                            onSubmitEditing={() => logIncomePhoneRef.current?.focus()}
                            autoCapitalize="words"
                            autoCorrect={false}
                            spellCheck={false}
                            autoComplete="off"
                            onFocus={() => setTimeout(() => logIncomeScrollRef.current?.scrollToEnd({ animated: true }), 50)}
                          />
                        </View>
                        {/* Phone */}
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" }}>
                          <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: "#F0FDF4", alignItems: "center", justifyContent: "center" }}>
                            <Ionicons name="call-outline" size={16} color="#10B981" />
                          </View>
                          <TextInput
                            value={logIncomeClientPhone}
                            onChangeText={setLogIncomeClientPhone}
                            ref={logIncomePhoneRef}
                            placeholder="Phone (optional)"
                            placeholderTextColor="#CBD5E1"
                            keyboardType="phone-pad"
                            inputAccessoryViewID={LOG_INCOME_ACCESSORY_ID}
                            style={{ flex: 1, fontSize: 14, color: "#0F172A", padding: 0 }}
                            returnKeyType="done"
                            onFocus={() => setTimeout(() => logIncomeScrollRef.current?.scrollToEnd({ animated: true }), 50)}
                          />
                        </View>
                        {/* Due date chips */}
                        <View style={{ paddingVertical: 14 }}>
                          <Text style={{ fontSize: 12, fontWeight: "600", color: "#64748B", marginBottom: 10 }}>Due in</Text>
                          <View style={{ flexDirection: "row", gap: 8 }}>
                            {[7, 14, 30].map((d) => (
                              <TouchableOpacity
                                key={d}
                                onPress={() => setLogIncomeDueDays(d)}
                                style={{
                                  paddingHorizontal: 18, paddingVertical: 8,
                                  borderRadius: 20,
                                  backgroundColor: logIncomeDueDays === d ? "#FEF3C7" : "#F8FAFC",
                                  borderWidth: 1.5,
                                  borderColor: logIncomeDueDays === d ? "#F59E0B" : "#E2E8F0",
                                }}
                              >
                                <Text style={{ fontSize: 13, fontWeight: "600", color: logIncomeDueDays === d ? "#92400E" : "#94A3B8" }}>{d} days</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      </View>
                    )}

                    {/* Save button */}
                    <View style={{ paddingHorizontal: 22, marginTop: 16 }}>
                      <TouchableOpacity
                        onPress={handleLogIncomeSubmit}
                        disabled={logIncomeSaving || !logIncomeAmount}
                        activeOpacity={0.85}
                        style={{
                          backgroundColor: !logIncomeAmount
                            ? (logIncomePaidStatus === "owed" ? "#FDE68A" : "#D1FAE5")
                            : (logIncomePaidStatus === "owed" ? "#F59E0B" : "#10B981"),
                          borderRadius: 14,
                          paddingVertical: 15,
                          alignItems: "center",
                          flexDirection: "row",
                          justifyContent: "center",
                          gap: 6,
                        }}
                      >
                        {logIncomeSaving ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Text style={{ fontSize: 15, fontWeight: "700", color: !logIncomeAmount ? (logIncomePaidStatus === "owed" ? "#92400E" : "#6EE7B7") : "#fff" }}>
                              {logIncomePaidStatus === "owed" ? "Add to Owed" : "Save payment"}
                            </Text>
                            <Ionicons name="arrow-forward" size={15} color={!logIncomeAmount ? (logIncomePaidStatus === "owed" ? "#92400E" : "#6EE7B7") : "#fff"} />
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </ScrollView>
                  </Animated.View>
                </KeyboardAvoidingView>
                {Platform.OS === "ios" && (
                  <InputAccessoryView nativeID={LOG_INCOME_ACCESSORY_ID}>
                    <View style={{ flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 20, paddingHorizontal: 18, height: 44, backgroundColor: "#F8FAFC", borderTopWidth: 1, borderTopColor: "#E2E8F0" }}>
                      <Pressable
                        hitSlop={8}
                        onPress={() => {
                          if (logIncomePhoneRef.current?.isFocused()) { Keyboard.dismiss(); return; }
                          if (logIncomePaidStatus === "owed") logIncomeClientRef.current?.focus();
                          else logIncomeDescRef.current?.focus();
                        }}
                      >
                        <Text style={{ fontSize: 16, fontWeight: "600", color: "#3B82F6" }}>Next</Text>
                      </Pressable>
                      <Pressable hitSlop={8} onPress={() => Keyboard.dismiss()}>
                        <Text style={{ fontSize: 16, fontWeight: "700", color: "#0F172A" }}>Done</Text>
                      </Pressable>
                    </View>
                  </InputAccessoryView>
                )}
              </View>
            </Modal>

          </View>

          {/* Projects Section */}
          <View style={styles.section}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#0F172A", letterSpacing: -0.3 }}>
                {`Projects · ${projectDetails.length} active`}
              </Text>
              <TouchableOpacity
                style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: "#EFF6FF" }}
                onPress={() => {
                  track("project_create_started", { source: "home_projects_row" });
                  navigation.navigate("NewProject");
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "600", color: "#2563EB" }}>+ Add</Text>
              </TouchableOpacity>
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

      {/* Remind sheet */}
      <Modal visible={remindSheetVisible} animationType="slide" transparent statusBarTranslucent onRequestClose={() => setRemindSheetVisible(false)}>
        <View style={{ flex: 1 }}>
          <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }} onPress={() => setRemindSheetVisible(false)} />
          <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: Platform.OS === "ios" ? 44 : 28, paddingHorizontal: 22 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "#E5E7EB", alignSelf: "center", marginTop: 12, marginBottom: 20 }} />
            <Text style={{ fontSize: 17, fontWeight: "700", color: "#0F172A", marginBottom: 4 }}>Send Reminder</Text>
            {remindInvoice && (
              <Text style={{ fontSize: 13, color: "#64748B", marginBottom: 22 }}>
                To {remindInvoice.client} · {formatCurrency(remindInvoice.amount, userDetails?.currency || "USD", userDetails?.locale || "en-US")}
              </Text>
            )}
            {/* Prefilled message */}
            <View style={{ backgroundColor: "#F8FAFC", borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: "#E2E8F0" }}>
              <Text style={{ fontSize: 13, color: "#0F172A", lineHeight: 20 }}>
                {getRemindMessage(remindInvoice)}
              </Text>
            </View>
            {/* WhatsApp */}
            <TouchableOpacity
              style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#ECFDF5", borderRadius: 14, padding: 16, marginBottom: 10 }}
              onPress={async () => {
                const phone = remindInvoice?.clientPhone?.replace(/\D/g, "") || "";
                const msg = encodeURIComponent(getRemindMessage(remindInvoice));
                const url = phone ? `https://wa.me/${phone}?text=${msg}` : `https://wa.me/?text=${msg}`;
                try { await Linking.openURL(url); } catch (e) {}
                setRemindSheetVisible(false);
              }}
            >
              <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
              <Text style={{ fontSize: 15, fontWeight: "600", color: "#0F172A" }}>Send via WhatsApp</Text>
            </TouchableOpacity>
            {/* SMS */}
            <TouchableOpacity
              style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#EFF6FF", borderRadius: 14, padding: 16, marginBottom: 16 }}
              onPress={async () => {
                const phone = remindInvoice?.clientPhone || "";
                const msg = encodeURIComponent(getRemindMessage(remindInvoice));
                const url = Platform.OS === "ios" ? `sms:${phone}&body=${msg}` : `sms:${phone}?body=${msg}`;
                try { await Linking.openURL(url); } catch (e) {}
                setRemindSheetVisible(false);
              }}
            >
              <Ionicons name="chatbubble-outline" size={22} color="#3B82F6" />
              <Text style={{ fontSize: 15, fontWeight: "600", color: "#0F172A" }}>Send via SMS</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Post-income success modal */}
      <Modal visible={postIncomeVisible} animationType="fade" transparent statusBarTranslucent onRequestClose={() => setPostIncomeVisible(false)}>
        <View style={styles.backdrop}>
          <View style={{ backgroundColor: "#0A1628", borderRadius: 24, padding: 28, marginHorizontal: 24 }}>
            <View style={{ height: 2, width: "100%", backgroundColor: "#34d399", borderRadius: 1, marginBottom: 20 }} />

            {/* Success header */}
            <View style={{ alignItems: "center" }}>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: "#052e16", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="checkmark-circle" size={28} color="#34d399" />
              </View>
              <Text style={{ fontSize: 10, fontWeight: "700", color: "#34d399", letterSpacing: 2, textTransform: "uppercase", marginTop: 12 }}>
                TRANSACTION RECORDED
              </Text>
              <Text style={{ fontSize: 13, color: "#94A3B8", marginTop: 4 }}>Your balance has been updated</Text>
            </View>

            <View style={{ height: 1, backgroundColor: "#1E293B", marginVertical: 20 }} />

            <Text style={{ fontSize: 10, fontWeight: "600", color: "#64748B", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 }}>
              What's next
            </Text>

            {/* View cash flow row */}
            <TouchableOpacity
              style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#0F172A", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#1E293B", marginBottom: 8 }}
              onPress={() => { setPostIncomeVisible(false); navigation.navigate("CashFlow"); }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "#0c2340", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="stats-chart" size={17} color="#60a5fa" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#F1F5F9", marginTop: 5}}>View cash flow</Text>
                <Text style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>See money in vs out</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color="#334155" />
            </TouchableOpacity>

            {/* Add expense row */}
            <TouchableOpacity
              style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#0F172A", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#1E293B", marginBottom: 8 }}
              onPress={() => { setPostIncomeVisible(false); setReceiptModalVisible(true); }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "#2d1b06", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="card" size={17} color="#f59e0b" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#F1F5F9", marginTop: 5 }}>Add a job expense</Text>
                <Text style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>Track what this job cost you</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color="#334155" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setPostIncomeVisible(false)}
              style={{ alignItems: "center", paddingTop: 16 }}
            >
              <Text style={{ fontSize: 13, color: "#64748B" }}>Back to dashboard</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    borderRadius: 29,
    borderWidth: 1,
    borderColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
  },
  avatarPlaceholder: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitials: {
    fontSize: 18,
    fontWeight: "700",
    color: "#3B82F6",
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

  // v5 Action buttons
  primaryActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  secondaryActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
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
    key: "addIncome",
    headline: "Log a payment received",
    body: "Got paid for a job? Record it here. Your net balance updates instantly.",
  },
  {
    key: "owed",
    headline: "Track what you're owed",
    body: "Add unpaid invoices here. When the client pays, tap Mark Paid and the income records automatically.",
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
