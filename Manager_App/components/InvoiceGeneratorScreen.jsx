import React from "react";
import { View, StyleSheet, StatusBar, SafeAreaView } from "react-native";
import IncomeReceiptGenerator from "./IncomesReceiptGenerator";
import { useNavigation, useRoute } from "@react-navigation/native";

const InvoiceGeneratorScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const onSuccess = route.params?.onSuccess;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safe}>
        <IncomeReceiptGenerator
          onSubmit={(data) => {
            if (onSuccess) onSuccess(data);
            navigation.goBack();
          }}
          onClose={() => navigation.goBack()}
        />
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  safe: { flex: 1 },
});

export default InvoiceGeneratorScreen;
