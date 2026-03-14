import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { colors, spacing, borderRadius, typography } from '@ehestudio-ops/shared';
import { api } from '../lib/api';

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  preferred_task_type: string | null;
  is_active: boolean;
}

const TASK_TYPE_LABELS: Record<string, string> = {
  ARCHITECTURE_ENGINEERING_DIRECTION: 'Arch & Eng',
  DESIGN_DELIVERY_RESEARCH: 'Design & Research',
  DEVELOPMENT_TESTING: 'Dev & Testing',
  BUSINESS_SUPPORT: 'Business Support',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function TeamScreen() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMembers = useCallback(async () => {
    try {
      const data = await api.get<TeamMember[]>('/api/team-members');
      setMembers(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMembers();
  }, [fetchMembers]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMembers();
    setRefreshing(false);
  };

  const renderMember = ({ item }: { item: TeamMember }) => (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.avatar}>
          <Text style={styles.initials}>{getInitials(item.full_name)}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.name}>{item.full_name}</Text>
          <Text style={styles.email} numberOfLines={1}>
            {item.email}
          </Text>
        </View>
      </View>
      <View style={styles.chipsRow}>
        <View
          style={[
            styles.chip,
            {
              backgroundColor: item.is_active ? '#E8F5E9' : '#F5F5F5',
            },
          ]}
        >
          <Text style={[styles.chipText, { color: item.is_active ? '#4CAF50' : '#999' }]}>
            {item.is_active ? 'Active' : 'Inactive'}
          </Text>
        </View>
        {item.preferred_task_type && (
          <View style={styles.chipOutline}>
            <Text style={styles.chipOutlineText}>
              {TASK_TYPE_LABELS[item.preferred_task_type] ?? item.preferred_task_type}
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      data={members}
      keyExtractor={(item) => item.id}
      renderItem={renderMember}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No team members found.</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  list: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    backgroundColor: '#FAFAFA',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: borderRadius.card,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  initials: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: typography.sizes.body1,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  email: {
    fontSize: typography.sizes.body2,
    color: '#666',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.chip,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  chipOutline: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.chip,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  chipOutlineText: {
    fontSize: 11,
    color: '#666',
  },
  emptyContainer: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.sizes.body2,
    color: '#999',
  },
});
