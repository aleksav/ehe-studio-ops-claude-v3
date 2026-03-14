import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, borderRadius } from '@ehestudio-ops/shared';
import AssigneeAvatars from './AssigneeAvatars';

const STATUS_COLORS: Record<string, string> = {
  TODO: '#9E9E9E',
  IN_PROGRESS: '#2196F3',
  DONE: '#4CAF50',
  CANCELLED: '#FF9800',
};

const STATUS_LABELS: Record<string, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
};

interface Assignment {
  id: string;
  team_member_id: string;
  team_member: {
    id: string;
    full_name: string;
    email: string;
  };
}

interface Props {
  title: string;
  status: string;
  milestoneName?: string | null;
  assignments?: Assignment[];
}

export default function TaskCard({ title, status, milestoneName, assignments = [] }: Props) {
  const statusColor = STATUS_COLORS[status] ?? '#9E9E9E';

  return (
    <View style={styles.card}>
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>
      <View style={styles.footer}>
        <View style={[styles.statusChip, { backgroundColor: statusColor + '20' }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>
            {STATUS_LABELS[status] ?? status}
          </Text>
        </View>
        {milestoneName && (
          <View style={styles.milestoneChip}>
            <Text style={styles.milestoneText} numberOfLines={1}>
              {milestoneName}
            </Text>
          </View>
        )}
      </View>
      {assignments.length > 0 && (
        <View style={styles.assignees}>
          <AssigneeAvatars assignments={assignments} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: borderRadius.card,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.md,
    marginBottom: spacing.sm,
    height: 88,
    justifyContent: 'space-between' as const,
  },
  title: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    alignItems: 'center',
  },
  statusChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.chip,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  milestoneChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.chip,
    backgroundColor: '#F3E8FF',
  },
  milestoneText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#7C3AED',
  },
  assignees: {
    marginTop: spacing.sm,
  },
});
