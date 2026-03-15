import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Constants from 'expo-constants';
import { colors } from '@ehestudio-ops/shared';

const commitHash = (Constants.expoConfig?.extra?.commitHash as string) ?? 'dev';
const buildDate =
  (Constants.expoConfig?.extra?.buildDate as string) ?? new Date().toISOString().split('T')[0];

export default function SplashScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.center}>
        <Text style={styles.ehe}>EHE</Text>
        <Text style={styles.studio}>Studio</Text>
        <Text style={styles.ops}>OPS</Text>
        <View style={styles.bar} />
        <Text style={styles.subtitle}>by EHE Ventures Studio</Text>
      </View>
      <Text style={styles.build}>
        Build {commitHash} | {buildDate}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
  },
  ehe: {
    fontSize: 72,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: -1,
  },
  studio: {
    fontSize: 48,
    fontWeight: '300',
    color: '#787878',
    marginTop: 4,
  },
  ops: {
    fontSize: 72,
    fontWeight: '900',
    color: colors.secondary,
    letterSpacing: 2,
    marginTop: 8,
  },
  bar: {
    width: 160,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.secondary,
    opacity: 0.7,
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '400',
    color: '#A0A0A0',
    marginTop: 24,
  },
  build: {
    position: 'absolute',
    bottom: 48,
    fontSize: 11,
    color: '#C8C8C8',
  },
});
