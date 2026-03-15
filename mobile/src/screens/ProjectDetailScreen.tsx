import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '@ehestudio-ops/shared';
import { api } from '../lib/api';
import ProjectTaskBoard from '../components/ProjectTaskBoard';
import type { BoardTask, BoardMilestone } from '../components/ProjectTaskBoard';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProjectsStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<ProjectsStackParamList, 'ProjectDetail'>;

interface Project {
  id: string;
  name: string;
  status: string;
  description: string | null;
  external_board_url: string | null;
  client: { id: string; name: string } | null;
}

const STATUS_COLORS: Record<string, string> = {
  PLANNED: '#9E9E9E',
  ACTIVE: '#4CAF50',
  COMPLETED: '#2196F3',
};

const STATUS_LABELS: Record<string, string> = {
  PLANNED: 'Planned',
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
};

export default function ProjectDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<BoardTask[]>([]);
  const [milestones, setMilestones] = useState<BoardMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const [proj, taskData, msData] = await Promise.all([
        api.get<Project>(`/api/projects/${id}`),
        api.get<BoardTask[]>(`/api/projects/${id}/tasks`),
        api.get<BoardMilestone[]>(`/api/projects/${id}/milestones`),
      ]);
      setProject(proj);
      setTasks(taskData);
      setMilestones(msData);
      navigation.setOptions({
        title: proj.name,
      });
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, [id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!project) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.emptyText}>Project not found.</Text>
      </View>
    );
  }

  const statusColor = STATUS_COLORS[project.status] ?? '#9E9E9E';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Compact Project Header */}
      <View style={styles.projectHeader}>
        <View style={styles.headerRow}>
          <View style={styles.headerTitle}>
            <Text style={styles.projectName} numberOfLines={1}>
              {project.client ? `${project.client.name} — ${project.name}` : project.name}
            </Text>
          </View>
          <View style={[styles.statusChip, { backgroundColor: statusColor + '20' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {STATUS_LABELS[project.status] ?? project.status}
            </Text>
          </View>
        </View>
        {project.description && <Text style={styles.description}>{project.description}</Text>}
      </View>

      {/* Task Board */}
      {project.external_board_url ? (
        <View style={styles.externalBoardCard}>
          <Text style={styles.externalBoardText}>
            Tasks for this project are managed externally.
          </Text>
          <TouchableOpacity
            style={styles.externalBoardButton}
            onPress={() => Linking.openURL(project.external_board_url!)}
          >
            <Ionicons name="open-outline" size={18} color="#fff" />
            <Text style={styles.externalBoardButtonText}>Open External Task Board</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ProjectTaskBoard tasks={tasks} milestones={milestones} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  projectHeader: {
    marginBottom: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerTitle: {
    flex: 1,
  },
  projectName: {
    fontSize: typography.sizes.body1,
    fontWeight: typography.weights.bold,
    color: colors.text,
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
  description: {
    fontSize: typography.sizes.body2,
    color: '#666',
    marginTop: 4,
  },
  emptyText: {
    fontSize: typography.sizes.body2,
    color: '#999',
  },
  externalBoardCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: borderRadius.card,
    padding: spacing.lg,
  },
  externalBoardText: {
    fontSize: typography.sizes.body1,
    color: colors.text,
    marginBottom: spacing.md,
  },
  externalBoardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.button,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    minHeight: 44,
    gap: spacing.xs,
    alignSelf: 'flex-start',
  },
  externalBoardButtonText: {
    color: '#fff',
    fontSize: typography.sizes.body1,
    fontWeight: typography.weights.semibold,
  },
});
