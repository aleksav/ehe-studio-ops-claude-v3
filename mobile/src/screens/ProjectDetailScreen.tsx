import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
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
      {/* Project Header */}
      <View style={styles.projectHeader}>
        {project.client && <Text style={styles.clientName}>{project.client.name}</Text>}
        <Text style={styles.projectName}>{project.name}</Text>
        <View style={[styles.statusChip, { backgroundColor: statusColor + '20' }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>
            {STATUS_LABELS[project.status] ?? project.status}
          </Text>
        </View>
        {project.description && <Text style={styles.description}>{project.description}</Text>}
      </View>

      {/* Task Board */}
      <ProjectTaskBoard tasks={tasks} milestones={milestones} />
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
    marginBottom: spacing.lg,
  },
  clientName: {
    fontSize: typography.sizes.caption,
    color: '#666',
    fontWeight: typography.weights.medium,
    marginBottom: 2,
  },
  projectName: {
    fontSize: typography.sizes.h2,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  statusChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.chip,
    marginBottom: spacing.sm,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  description: {
    fontSize: typography.sizes.body2,
    color: '#666',
    marginTop: spacing.sm,
  },
  emptyText: {
    fontSize: typography.sizes.body2,
    color: '#999',
  },
});
