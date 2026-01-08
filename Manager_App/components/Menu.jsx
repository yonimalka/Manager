import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Dimensions,
  StyleSheet,
  I18nManager,
  Platform,
  
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");
const isRTL = I18nManager.isRTL;

export default function Menu({ visible, onClose }) {

  const slideAnim = useRef(new Animated.Value(!isRTL ? width : -width)).current;
  const navigation = useNavigation();
  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: visible ? 0 : !isRTL ? width : -width,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  return (
    <>
      {/* Overlay */}
      {visible && <TouchableOpacity style={styles.overlay} onPress={onClose} />}

      {/* Menu */}
      <Animated.View
        style={[
          styles.menu,
          {
            transform: [{ translateX: slideAnim }],
            [!isRTL ? "right" : "left"  ]: 0,
          },
        ]}
      >
        <View style={styles.menuHeader}>
          <Text style={styles.menuTitle}>תפריט</Text>
        </View>


        <TouchableOpacity style={styles.menuItem}>
          <Ionicons name="briefcase-outline" size={22} color="#000" />
          <Text style={styles.menuText}>פרויקטים</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem}
                  onPress={()=> {navigation.navigate("Employees"); onClose()}}>
                  <Ionicons name="people-outline" size={22} color="##000" />
                    <Text style={styles.menuText}>עובדים</Text>
                  </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem}>
          <Ionicons name="settings-outline" size={22} color="##000" />
          <Text style={styles.menuText}>הגדרות</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={()=> {navigation.navigate("LoginScreen"); onClose()}}>
          <Ionicons name="log-out-outline" size={22} color="##000" />
          <Text style={styles.menuText}>התנתק</Text>
        </TouchableOpacity>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  menu: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: width * 0.7,
    backgroundColor: "#fff",
    paddingTop: 80,
    paddingHorizontal: 20,
    zIndex: 2,
    borderTopColor: "#e0e0e0",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.15,
        shadowOffset: { width: 0, height: 0 },
        shadowRadius: 5,
      },
      android:{
        elevation: 5,
        shadowColor: "#000",
      }
    }),
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.3)",
    zIndex: 1,
  },
  menuHeader: {
    flexDirection: !isRTL ? "row-reverse" : "row",
    marginBottom: 30,
  },
  menuTitle: {
    fontSize: 24,
    color: "#000",
    fontWeight: "700",
  },
  menuItem: {
    flexDirection: !isRTL ? "row-reverse" : "row",
    alignItems: "center",
    marginBottom: 20,
  },
  menuText: {
    color: "#000",
    fontSize: 18,
    marginHorizontal: 10,
  },
});
