import React from 'react';
import { View, StyleSheet } from 'react-native';
import GoogleSignInButton from './GoogleSignInButton';

export default function App() {
  return (
    <View style={styles.container}>
      <GoogleSignInButton />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
