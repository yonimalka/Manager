import React from "react";
import { StyleSheet } from 'react-native';
import { WebView } from "react-native-webview";
import { useNavigation, useRoute } from "@react-navigation/native";

const ReceiptPreview = () => {
  const route = useRoute();
  const ReceiptUri  = route.params?.item;
  return <WebView style={styles.container} source={{ uri: ReceiptUri.data }} useWebKit={true}
        originWhitelist={['*']} />;
};

const styles = StyleSheet.create({
    container: {
        flex: 1 
    },
    
  })
export default ReceiptPreview;
