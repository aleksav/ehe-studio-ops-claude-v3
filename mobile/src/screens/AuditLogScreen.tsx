import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '@ehestudio-ops/shared';
import { api } from '../lib/api';

interface AuditLogEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  actor_id: string | null;
  changed_fields: Record<string, unknown> | null;
  created_at: string;
}

interface AuditLogResponse {
  data: AuditLogEntry[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: '#4CAF50',
  UPDATE: '#FF9800',
  DELETE: '#F44336',
};

export default function AuditLogScreen() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const fetchLogs = useCallback(async (pageNum: number, append = false) => {
    if (pageNum > 1) {
      setLoadingMore(true);
    }
    try {
      const result = await api.get<AuditLogResponse>(`/api/audit-logs?page=${pageNum}&per_page=25`);
      if (append) {
        setLogs((prev) => [...prev, ...result.data]);
      } else {
        setLogs(result.data);
      }
      setTotalPages(result.pagination.total_pages);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void fetchLogs(1);
  }, [fetchLogs]);

  const loadMore = () => {
    if (loadingMore || page >= totalPages) return;
    const nextPage = page + 1;
    setPage(nextPage);
    void fetchLogs(nextPage, true);
  };

  const toggleExpanded = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const renderItem = ({ item }: { item: AuditLogEntry }) => {
    const isExpanded = expandedRows.has(item.id);
    const actionColor = ACTION_COLORS[item.action] ?? '#999';

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => item.changed_fields && toggleExpanded(item.id)}
        activeOpacity={item.changed_fields ? 0.7 : 1}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.actionChip, { backgroundColor: actionColor + '20' }]}>
            <Text style={[styles.actionText, { color: actionColor }]}>{item.action}</Text>
          </View>
          <Text style={styles.entityType}>{item.entity_type}</Text>
        </View>

        <Text style={styles.timestamp}>{new Date(item.created_at).toLocaleString()}</Text>

        <Text style={styles.entityId} numberOfLines={1}>
          ID: {item.entity_id}
        </Text>

        {item.actor_id && (
          <Text style={styles.actorId} numberOfLines={1}>
            Actor: {item.actor_id}
          </Text>
        )}

        {item.changed_fields && (
          <Text style={styles.expandHint}>
            {isExpanded ? 'Tap to collapse' : 'Tap to view changes'}
          </Text>
        )}

        {isExpanded && item.changed_fields && (
          <View style={styles.changedFields}>
            <Text style={styles.changedFieldsLabel}>Changed Fields</Text>
            <Text style={styles.changedFieldsJson}>
              {JSON.stringify(item.changed_fields, null, 2)}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      data={logs}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      contentContainerStyle={styles.list}
      onEndReached={loadMore}
      onEndReachedThreshold={0.3}
      ListFooterComponent={
        loadingMore ? (
          <ActivityIndicator size="small" color={colors.primary} style={styles.footerLoader} />
        ) : null
      }
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No audit logs found.</Text>
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  actionChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.chip,
  },
  actionText: {
    fontSize: 11,
    fontWeight: '600',
  },
  entityType: {
    fontSize: typography.sizes.body2,
    fontWeight: typography.weights.medium,
    color: colors.text,
  },
  timestamp: {
    fontSize: typography.sizes.caption,
    color: '#666',
    marginBottom: spacing.xs,
  },
  entityId: {
    fontSize: typography.sizes.caption,
    color: '#999',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  actorId: {
    fontSize: typography.sizes.caption,
    color: '#999',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 2,
  },
  expandHint: {
    fontSize: typography.sizes.caption,
    color: colors.secondary,
    marginTop: spacing.sm,
  },
  changedFields: {
    marginTop: spacing.sm,
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.input,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  changedFieldsLabel: {
    fontSize: typography.sizes.caption,
    color: '#666',
    marginBottom: spacing.xs,
  },
  changedFieldsJson: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: colors.text,
  },
  footerLoader: {
    paddingVertical: spacing.md,
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
