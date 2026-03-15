import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, typography } from '@ehestudio-ops/shared';
import ClientsScreen from './ClientsScreen';
import TeamScreen from './TeamScreen';
import AuditLogScreen from './AuditLogScreen';
import TaskRatesScreen from './TaskRatesScreen';
import PublicHolidaysScreen from './PublicHolidaysScreen';
import OfficeEventsScreen from './OfficeEventsScreen';
import TimeEntriesScreen from './TimeEntriesScreen';

const TABS = ['Clients', 'Team', 'Audit Log', 'Task Rates', 'Holidays', 'Events', 'Time'] as const;
type TabKey = (typeof TABS)[number];

const STORAGE_KEY = 'admin-active-tab';

export default function AdminScreen() {
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored) {
        const idx = TABS.indexOf(stored as TabKey);
        if (idx >= 0) setActiveTab(idx);
      }
    });
  }, []);

  const handleTabPress = (index: number) => {
    setActiveTab(index);
    AsyncStorage.setItem(STORAGE_KEY, TABS[index]);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={styles.tabBarContent}
      >
        {TABS.map((tab, index) => {
          const isActive = activeTab === index;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => handleTabPress(index)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <View style={styles.content}>
        {activeTab === 0 && <ClientsScreen />}
        {activeTab === 1 && <TeamScreen />}
        {activeTab === 2 && <AuditLogScreen />}
        {activeTab === 3 && <TaskRatesScreen />}
        {activeTab === 4 && <PublicHolidaysScreen />}
        {activeTab === 5 && <OfficeEventsScreen />}
        {activeTab === 6 && <TimeEntriesScreen />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  tabBar: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    flexGrow: 0,
  },
  tabBarContent: {
    flexDirection: 'row',
  },
  tab: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: typography.sizes.body2,
    fontWeight: '500',
    color: '#999',
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
});
