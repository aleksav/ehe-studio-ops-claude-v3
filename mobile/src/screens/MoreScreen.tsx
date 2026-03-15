import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { colors, spacing, borderRadius, typography } from '@ehestudio-ops/shared';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MoreStackParamList } from '../navigation/types';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://ehestudio-ops-api.onrender.com';
const FRONTEND_VERSION = (Constants.expoConfig?.extra?.commitHash as string) ?? 'unknown';

type Props = NativeStackScreenProps<MoreStackParamList, 'MoreMenu'>;

interface MenuItem {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  screen: keyof MoreStackParamList;
}

const MENU_ITEMS: MenuItem[] = [
  { label: 'Team Calendar', icon: 'calendar-outline', screen: 'TeamCalendar' },
  { label: 'Admin', icon: 'settings-outline', screen: 'Admin' },
];

export default function MoreScreen({ navigation }: Props) {
  const [backendVersion, setBackendVersion] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/version`)
      .then((res) => res.json())
      .then((data: { version: string }) => setBackendVersion(data.version))
      .catch(() => setBackendVersion(null));
  }, []);

  const versionMismatch = backendVersion != null && backendVersion !== FRONTEND_VERSION;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {MENU_ITEMS.map((item) => (
        <TouchableOpacity
          key={item.screen}
          style={styles.menuItem}
          onPress={() => navigation.navigate(item.screen)}
          activeOpacity={0.7}
        >
          <Ionicons name={item.icon} size={22} color={colors.text} style={styles.menuIcon} />
          <Text style={styles.menuLabel}>{item.label}</Text>
          <Ionicons name="chevron-forward" size={20} color="#ccc" />
        </TouchableOpacity>
      ))}

      <View style={styles.versionContainer}>
        {versionMismatch && (
          <Ionicons
            name="warning-outline"
            size={14}
            color="#DC2626"
            style={styles.versionWarningIcon}
          />
        )}
        <Text style={[styles.versionText, versionMismatch && styles.versionMismatch]}>
          FE v{FRONTEND_VERSION}
          {backendVersion != null ? ` / BE v${backendVersion}` : ''}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: borderRadius.card,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  menuIcon: {
    marginRight: spacing.md,
  },
  menuLabel: {
    flex: 1,
    fontSize: typography.sizes.body1,
    fontWeight: typography.weights.medium,
    color: colors.text,
  },
  versionContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
  },
  versionWarningIcon: {
    marginRight: 4,
  },
  versionText: {
    fontSize: 11,
    color: '#999',
  },
  versionMismatch: {
    color: '#DC2626',
    fontWeight: typography.weights.semibold,
  },
});
