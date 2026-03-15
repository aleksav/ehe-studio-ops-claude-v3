import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '@ehestudio-ops/shared';
import { api } from '../lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ByTaskType {
  task_type: string;
  hours: number;
  cost: number;
}

interface ByTeamMember {
  team_member_id: string;
  name: string;
  hours: number;
  cost: number;
}

interface ByMonth {
  month: string;
  hours: number;
  cost: number;
}

interface ProjectStats {
  total_hours: number;
  total_cost: number;
  currency_code: string;
  by_task_type: ByTaskType[];
  by_team_member: ByTeamMember[];
  by_month: ByMonth[];
}

interface Props {
  projectId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TASK_TYPE_LABEL: Record<string, string> = {
  ARCHITECTURE_ENGINEERING_DIRECTION: 'Architecture & Eng.',
  DESIGN_DELIVERY_RESEARCH: 'Design & Research',
  DEVELOPMENT_TESTING: 'Dev & Testing',
  BUSINESS_SUPPORT: 'Business Support',
};

function formatTaskType(value: string): string {
  return TASK_TYPE_LABEL[value] ?? value;
}

function formatCurrency(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ProjectDashboardTab({ projectId }: Props) {
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<'month' | 'range'>('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);
      const qs = params.toString();
      const url = `/api/projects/${projectId}/stats${qs ? `?${qs}` : ''}`;
      const data = await api.get<ProjectStats>(url);
      setStats(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [projectId, startDate, endDate]);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  if (loading && !stats) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!stats) return null;

  return (
    <View>
      {/* Filter Mode Toggle */}
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleButton, filterMode === 'month' && styles.toggleButtonActive]}
          onPress={() => {
            setFilterMode('month');
            setStartDate('');
            setEndDate('');
          }}
        >
          <Text style={[styles.toggleText, filterMode === 'month' && styles.toggleTextActive]}>
            Month
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, filterMode === 'range' && styles.toggleButtonActive]}
          onPress={() => {
            setFilterMode('range');
            setStartDate('');
            setEndDate('');
          }}
        >
          <Text style={[styles.toggleText, filterMode === 'range' && styles.toggleTextActive]}>
            Date Range
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filter Inputs */}
      {filterMode === 'month' ? (
        <View style={styles.dateRow}>
          <View style={styles.dateField}>
            <Text style={styles.dateLabel}>Month</Text>
            <TextInput
              style={styles.dateInput}
              placeholder="YYYY-MM"
              value={startDate ? startDate.slice(0, 7) : ''}
              onChangeText={(val) => {
                if (!val || !/^\d{4}-\d{2}$/.test(val)) {
                  setStartDate('');
                  setEndDate('');
                  return;
                }
                const [y, m] = val.split('-').map(Number);
                const lastDay = new Date(y, m, 0).getDate();
                setStartDate(`${val}-01`);
                setEndDate(`${val}-${String(lastDay).padStart(2, '0')}`);
              }}
            />
          </View>
        </View>
      ) : (
        <View style={styles.dateRow}>
          <View style={styles.dateField}>
            <Text style={styles.dateLabel}>Start Date</Text>
            <TextInput
              style={styles.dateInput}
              placeholder="YYYY-MM-DD"
              value={startDate}
              onChangeText={setStartDate}
            />
          </View>
          <View style={styles.dateField}>
            <Text style={styles.dateLabel}>End Date</Text>
            <TextInput
              style={styles.dateInput}
              placeholder="YYYY-MM-DD"
              value={endDate}
              onChangeText={setEndDate}
            />
          </View>
        </View>
      )}

      {/* Overview Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Overview</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Total Hours</Text>
            <Text style={[styles.statValue, { color: colors.primary }]}>
              {stats.total_hours.toFixed(1)}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Total Cost</Text>
            <Text style={[styles.statValue, { color: colors.secondary }]}>
              {formatCurrency(stats.total_cost, stats.currency_code)}
            </Text>
          </View>
        </View>
      </View>

      {/* By Task Type */}
      {stats.by_task_type.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>By Task Type</Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.colName]}>Type</Text>
            <Text style={[styles.tableHeaderText, styles.colNum]}>Hours</Text>
            <Text style={[styles.tableHeaderText, styles.colNum]}>Cost</Text>
          </View>
          {stats.by_task_type.map((row) => (
            <View key={row.task_type} style={styles.tableRow}>
              <Text style={[styles.tableCell, styles.colName]} numberOfLines={1}>
                {formatTaskType(row.task_type)}
              </Text>
              <Text style={[styles.tableCell, styles.colNum]}>{row.hours.toFixed(1)}</Text>
              <Text style={[styles.tableCell, styles.colNum]}>
                {formatCurrency(row.cost, stats.currency_code)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* By Team Member */}
      {stats.by_team_member.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>By Team Member</Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.colName]}>Member</Text>
            <Text style={[styles.tableHeaderText, styles.colNum]}>Hours</Text>
            <Text style={[styles.tableHeaderText, styles.colNum]}>Cost</Text>
          </View>
          {stats.by_team_member.map((row) => (
            <View key={row.team_member_id} style={styles.tableRow}>
              <Text style={[styles.tableCell, styles.colName]} numberOfLines={1}>
                {row.name}
              </Text>
              <Text style={[styles.tableCell, styles.colNum]}>{row.hours.toFixed(1)}</Text>
              <Text style={[styles.tableCell, styles.colNum]}>
                {formatCurrency(row.cost, stats.currency_code)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* By Month */}
      {stats.by_month.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>By Month</Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.colName]}>Month</Text>
            <Text style={[styles.tableHeaderText, styles.colNum]}>Hours</Text>
            <Text style={[styles.tableHeaderText, styles.colNum]}>Cost</Text>
          </View>
          {stats.by_month.map((row) => (
            <View key={row.month} style={styles.tableRow}>
              <Text style={[styles.tableCell, styles.colName]}>{row.month}</Text>
              <Text style={[styles.tableCell, styles.colNum]}>{row.hours.toFixed(1)}</Text>
              <Text style={[styles.tableCell, styles.colNum]}>
                {formatCurrency(row.cost, stats.currency_code)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  loadingContainer: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
    borderRadius: borderRadius.input,
    borderWidth: 1,
    borderColor: colors.divider,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  toggleButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  toggleButtonActive: {
    backgroundColor: colors.primary,
  },
  toggleText: {
    fontSize: typography.sizes.body2,
    color: colors.text,
    fontWeight: typography.weights.medium,
  },
  toggleTextActive: {
    color: '#fff',
  },
  dateRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  dateField: {
    flex: 1,
  },
  dateLabel: {
    fontSize: typography.sizes.caption,
    color: '#666',
    marginBottom: 4,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: borderRadius.input,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: typography.sizes.body2,
    color: colors.text,
    backgroundColor: '#fff',
    minHeight: 44,
  },
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: borderRadius.card,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: typography.sizes.body1,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  statItem: {
    minWidth: '40%',
    flex: 1,
  },
  statLabel: {
    fontSize: typography.sizes.caption,
    color: '#666',
  },
  statValue: {
    fontSize: typography.sizes.h3,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    paddingBottom: spacing.xs,
    marginBottom: spacing.xs,
  },
  tableHeaderText: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.semibold,
    color: '#666',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
    minHeight: 44,
    alignItems: 'center',
  },
  tableCell: {
    fontSize: typography.sizes.body2,
    color: colors.text,
  },
  colName: {
    flex: 1,
  },
  colNum: {
    width: 80,
    textAlign: 'right',
  },
});
