import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '@ehestudio-ops/shared';

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
  assignments: Assignment[];
  maxDisplay?: number;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function AssigneeAvatars({ assignments, maxDisplay = 3 }: Props) {
  if (assignments.length === 0) return null;

  const displayed = assignments.slice(0, maxDisplay);
  const overflow = assignments.length - maxDisplay;

  return (
    <View style={styles.container}>
      {displayed.map((a, i) => (
        <View key={a.id} style={[styles.avatar, i > 0 && styles.overlap]}>
          <Text style={styles.initials}>{getInitials(a.team_member.full_name)}</Text>
        </View>
      ))}
      {overflow > 0 && (
        <View style={[styles.avatar, styles.overlap, styles.overflowAvatar]}>
          <Text style={styles.overflowText}>+{overflow}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  overlap: {
    marginLeft: -8,
  },
  initials: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  overflowAvatar: {
    backgroundColor: '#E0E0E0',
  },
  overflowText: {
    color: '#666',
    fontSize: 10,
    fontWeight: '600',
  },
});
