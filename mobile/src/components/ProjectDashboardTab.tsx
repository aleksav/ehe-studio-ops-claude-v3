import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TextInput, Platform } from 'react-native';
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
  budget_hours: number | null;
  hourly_rate: number | null;
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

  const budgetHoursPercent =
    stats.budget_hours && stats.budget_hours > 0
      ? Math.min((stats.total_hours / stats.budget_hours) * 100, 100)
      : null;

  const totalBudget =
    stats.budget_hours && stats.hourly_rate ? stats.budget_hours * stats.hourly_rate : null;

  const costPercent =
    totalBudget && totalBudget > 0 ? Math.min((stats.total_cost / totalBudget) * 100, 100) : null;

  const barColorFn = (pct: number) =>
    pct > 90 ? colors.error : pct > 75 ? colors.warning : colors.primary;

  return (
    <View>
      {/* Date Range Filters */}
      <View style={styles.dateRow}>
        <View style={styles.dateField}>
          <Text style={styles.dateLabel}>Start Date</Text>
          <TextInput
            style={styles.dateInput}
            placeholder="YYYY-MM-DD"
            value={startDate}
            onChangeText={setStartDate}
            keyboardType={Platform.OS === 'ios' ? 'default' : 'default'}
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

      {/* Budget Overview Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Budget Overview</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Hours Logged</Text>
            <Text style={[styles.statValue, { color: colors.primary }]}>
              {stats.total_hours.toFixed(1)}
            </Text>
          </View>
          {stats.budget_hours !== null && (
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Budget Hours</Text>
              <Text style={styles.statValue}>{stats.budget_hours.toFixed(1)}</Text>
            </View>
          )}
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Cost</Text>
            <Text style={[styles.statValue, { color: colors.secondary }]}>
              {formatCurrency(stats.total_cost, stats.currency_code)}
            </Text>
          </View>
          {totalBudget !== null && (
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Remaining</Text>
              <Text style={styles.statValue}>
                {formatCurrency(totalBudget - stats.total_cost, stats.currency_code)}
              </Text>
            </View>
          )}
        </View>
        {budgetHoursPercent !== null && (
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.statLabel}>Hours Used</Text>
              <Text style={styles.statLabel}>{budgetHoursPercent.toFixed(1)}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressBar,
                  {
                    width: `${budgetHoursPercent}%`,
                    backgroundColor: barColorFn(budgetHoursPercent),
                  },
                ]}
              />
            </View>
          </View>
        )}
        {costPercent !== null && (
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.statLabel}>Cost vs Budget</Text>
              <Text style={styles.statLabel}>{costPercent.toFixed(1)}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressBar,
                  {
                    width: `${costPercent}%`,
                    backgroundColor: barColorFn(costPercent),
                  },
                ]}
              />
            </View>
          </View>
        )}
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
  progressSection: {
    marginTop: spacing.md,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E5E5E5',
    overflow: 'hidden',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
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
