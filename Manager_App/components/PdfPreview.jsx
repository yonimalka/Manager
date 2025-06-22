import * as FileSystem from 'expo-file-system';
import * as Sharing     from 'expo-sharing';
import { WebView }      from 'react-native-webview';   // ← in your preview screen
import { useNavigation, useRoute } from "@react-navigation/native";

export default function PdfPreview() {
    const route = useRoute();
    const fileUri = route.params?.quote;
    return <WebView source={{ uri: fileUri }} style={{ flex: 1 }} useWebKit={true}
        originWhitelist={['*']} />;
  }