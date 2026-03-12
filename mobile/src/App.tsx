import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { colors, typography } from '@ehestudio-ops/shared';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>EHEStudio Ops</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: typography.headingFamilyMobile,
    fontSize: typography.sizes.h1,
    color: colors.text,
  },
});
