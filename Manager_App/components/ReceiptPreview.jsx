import React from "react";
import { WebView } from "react-native-webview";
import { useNavigation, useRoute } from "@react-navigation/native";

const ReceiptPreview = () => {
    const route = useRoute();
  const ReceiptUri  = route.params?.item;
  return <WebView source={{ uri: ReceiptUri.data }} useWebKit={true}
        originWhitelist={['*']} />;
};

export default ReceiptPreview;
