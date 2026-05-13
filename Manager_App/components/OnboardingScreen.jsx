import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

const { width, height } = Dimensions.get("window");

const SLIDES = [
  {
    id: "1",
    icon: "briefcase",
    iconColor: "#3B82F6",
    iconBg: "#DBEAFE",
    title: "Run your business\nfrom one place",
    subtitle:
      "Projects, invoices, and cash flow — all in one app. No more switching between five different tools mid-client-call.",
  },
  {
    id: "2",
    icon: "cash",
    iconColor: "#10B981",
    iconBg: "#D1FAE5",
    title: "Always know where\nyour money stands",
    subtitle:
      "See your income, expenses, and cash flow in real time. Know exactly what you made this month before your accountant does.",
  },
  {
    id: "3",
    icon: "sparkles",
    iconColor: "#8B5CF6",
    iconBg: "#EDE9FE",
    title: "Ask your AI anything\nabout your numbers",
    subtitle:
      'Questions like "which client owes me the most?" or "did I make more in April or March?" — answered instantly.',
  },
];

const OnboardingScreen = () => {
  const navigation = useNavigation();
  const flatListRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const finish = async () => {
    await AsyncStorage.setItem("onboardingComplete", "true");
    navigation.reset({ index: 0, routes: [{ name: "LoginScreen" }] });
  };

  const next = () => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
      setCurrentIndex(currentIndex + 1);
    } else {
      finish();
    }
  };

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const renderSlide = ({ item }) => (
    <View style={styles.slide}>
      <View style={[styles.iconCircle, { backgroundColor: item.iconBg }]}>
        <Ionicons name={item.icon} size={52} color={item.iconColor} />
      </View>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.subtitle}>{item.subtitle}</Text>
    </View>
  );

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" />

      {/* Skip */}
      <TouchableOpacity style={styles.skipBtn} onPress={finish}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
        scrollEventThrottle={16}
        style={styles.flatList}
      />

      {/* Dots */}
      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === currentIndex && styles.dotActive]}
          />
        ))}
      </View>

      {/* Button */}
      <View style={styles.footer}>
        <TouchableOpacity onPress={next} activeOpacity={0.88} style={styles.btnWrapper}>
          <LinearGradient
            colors={["#3B82F6", "#2563EB"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.btn}
          >
            <Text style={styles.btnText}>
              {currentIndex === SLIDES.length - 1 ? "Get Started" : "Next"}
            </Text>
            <Ionicons
              name={currentIndex === SLIDES.length - 1 ? "checkmark" : "arrow-forward"}
              size={20}
              color="#fff"
            />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FAFBFF",
  },
  skipBtn: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 40,
    right: 24,
    zIndex: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  skipText: {
    fontSize: 15,
    color: "#9CA3AF",
    fontWeight: "600",
  },
  flatList: {
    flex: 1,
  },
  slide: {
    width,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    paddingTop: Platform.OS === "ios" ? 80 : 60,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
    lineHeight: 40,
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 26,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E5E7EB",
  },
  dotActive: {
    width: 24,
    backgroundColor: "#3B82F6",
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === "ios" ? 48 : 32,
  },
  btnWrapper: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#3B82F6",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 18,
    borderRadius: 16,
  },
  btnText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
});

export default OnboardingScreen;
