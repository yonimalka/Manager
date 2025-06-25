import * as FileSystem from 'expo-file-system';
import * as Sharing     from 'expo-sharing';
import { StyleSheet } from 'react-native';
import { WebView }      from 'react-native-webview';   // ← in your preview screen
import { useNavigation, useRoute } from "@react-navigation/native";

export default function PdfPreview() {
    const route = useRoute();
    const fileUri = route.params?.quote;
    return <WebView style={styles.container} source={{ uri: fileUri }} useWebKit={true}
        originWhitelist={['*']} />;
  }

  const styles = StyleSheet.create({
    container: {
        flex: 1 
    },
    
  })