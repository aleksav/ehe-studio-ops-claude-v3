import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { colors, typography } from '@ehestudio-ops/shared';

const appVersion = Constants.expoConfig?.version ?? '0.0.0';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>EHEStudio Ops</Text>
      <Text style={styles.version}>v{appVersion}</Text>
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
  version: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
  },
});
