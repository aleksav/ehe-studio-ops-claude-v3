import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '@ehestudio-ops/shared';
import { api } from '../lib/api';
import TaskCard from '../components/TaskCard';
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

interface TeamMemberRef {
  id: string;
  full_name: string;
  email: string;
}

interface TaskAssignment {
  id: string;
  team_member_id: string;
  team_member: TeamMemberRef;
}

interface Task {
  id: string;
  project_id: string;
  description: string;
  status: string;
  milestone_id: string | null;
  assignments?: TaskAssignment[];
}

interface Milestone {
  id: string;
  project_id: string;
  name: string;
  due_date: string | null;
}

const COLUMNS = ['TODO', 'IN_PROGRESS', 'DONE'] as const;

const COLUMN_COLORS: Record<string, string> = {
  TODO: '#F5F5F5',
  IN_PROGRESS: '#E3F2FD',
  DONE: '#E8F5E9',
};

const COLUMN_LABELS: Record<string, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done',
};

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

type ViewMode = 'board' | 'milestones' | 'people';

export default function ProjectDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('board');

  const milestoneMap = useMemo(() => {
    const m = new Map<string, string>();
    milestones.forEach((ms) => m.set(ms.id, ms.name));
    return m;
  }, [milestones]);

  const fetchData = async () => {
    try {
      const [proj, taskData, msData] = await Promise.all([
        api.get<Project>(`/api/projects/${id}`),
        api.get<Task[]>(`/api/projects/${id}/tasks`),
        api.get<Milestone[]>(`/api/projects/${id}/milestones`),
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

  // Board view: tasks grouped by status
  const tasksByStatus = useMemo(() => {
    const groups: Record<string, Task[]> = { TODO: [], IN_PROGRESS: [], DONE: [] };
    tasks.forEach((t) => {
      if (groups[t.status]) {
        groups[t.status].push(t);
      }
    });
    return groups;
  }, [tasks]);

  // Milestone view: tasks grouped by milestone
  const tasksByMilestone = useMemo(() => {
    const groups: Record<string, Task[]> = {};
    const noMilestone: Task[] = [];
    tasks.forEach((t) => {
      if (t.milestone_id) {
        if (!groups[t.milestone_id]) groups[t.milestone_id] = [];
        groups[t.milestone_id].push(t);
      } else {
        noMilestone.push(t);
      }
    });
    return { groups, noMilestone };
  }, [tasks]);

  // People view: tasks grouped by assignee
  const tasksByPerson = useMemo(() => {
    const groups: Record<string, { name: string; tasks: Task[] }> = {};
    const unassigned: Task[] = [];
    tasks.forEach((t) => {
      const assigns = t.assignments ?? [];
      if (assigns.length === 0) {
        unassigned.push(t);
      } else {
        assigns.forEach((a) => {
          if (!groups[a.team_member_id]) {
            groups[a.team_member_id] = {
              name: a.team_member.full_name,
              tasks: [],
            };
          }
          groups[a.team_member_id].tasks.push(t);
        });
      }
    });
    return { groups, unassigned };
  }, [tasks]);

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

      {/* View Mode Tabs */}
      <View style={styles.tabRow}>
        {(['board', 'milestones', 'people'] as const).map((mode) => (
          <TouchableOpacity
            key={mode}
            style={[styles.tab, viewMode === mode && styles.tabActive]}
            onPress={() => setViewMode(mode)}
          >
            <Text style={[styles.tabText, viewMode === mode && styles.tabTextActive]}>
              {mode === 'board' ? 'Board' : mode === 'milestones' ? 'Milestones' : 'People'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Board View */}
      {viewMode === 'board' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.boardRow}>
            {COLUMNS.map((col) => (
              <View key={col} style={[styles.column, { backgroundColor: COLUMN_COLORS[col] }]}>
                <View style={styles.columnHeader}>
                  <Text style={styles.columnTitle}>{COLUMN_LABELS[col]}</Text>
                  <Text style={styles.columnCount}>{tasksByStatus[col]?.length ?? 0}</Text>
                </View>
                {(tasksByStatus[col] ?? []).map((task) => (
                  <TaskCard
                    key={task.id}
                    title={task.description}
                    status={task.status}
                    milestoneName={task.milestone_id ? milestoneMap.get(task.milestone_id) : null}
                    assignments={task.assignments}
                  />
                ))}
                {(tasksByStatus[col] ?? []).length === 0 && (
                  <Text style={styles.noTasks}>No tasks</Text>
                )}
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {/* Milestones View */}
      {viewMode === 'milestones' && (
        <View>
          {milestones.map((ms) => (
            <View key={ms.id} style={styles.milestoneSection}>
              <View style={styles.milestoneHeader}>
                <Text style={styles.milestoneName}>{ms.name}</Text>
                {ms.due_date && (
                  <Text style={styles.milestoneDue}>
                    Due:{' '}
                    {new Date(ms.due_date).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </Text>
                )}
              </View>
              {(tasksByMilestone.groups[ms.id] ?? []).map((task) => (
                <TaskCard
                  key={task.id}
                  title={task.description}
                  status={task.status}
                  assignments={task.assignments}
                />
              ))}
              {!tasksByMilestone.groups[ms.id]?.length && (
                <Text style={styles.noTasks}>No tasks in this milestone</Text>
              )}
            </View>
          ))}
          {tasksByMilestone.noMilestone.length > 0 && (
            <View style={styles.milestoneSection}>
              <Text style={styles.milestoneName}>No Milestone</Text>
              {tasksByMilestone.noMilestone.map((task) => (
                <TaskCard
                  key={task.id}
                  title={task.description}
                  status={task.status}
                  assignments={task.assignments}
                />
              ))}
            </View>
          )}
        </View>
      )}

      {/* People View */}
      {viewMode === 'people' && (
        <View>
          {Object.entries(tasksByPerson.groups).map(([memberId, group]) => (
            <View key={memberId} style={styles.milestoneSection}>
              <Text style={styles.milestoneName}>{group.name}</Text>
              {group.tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  title={task.description}
                  status={task.status}
                  milestoneName={task.milestone_id ? milestoneMap.get(task.milestone_id) : null}
                />
              ))}
            </View>
          ))}
          {tasksByPerson.unassigned.length > 0 && (
            <View style={styles.milestoneSection}>
              <Text style={styles.milestoneName}>Unassigned</Text>
              {tasksByPerson.unassigned.map((task) => (
                <TaskCard
                  key={task.id}
                  title={task.description}
                  status={task.status}
                  milestoneName={task.milestone_id ? milestoneMap.get(task.milestone_id) : null}
                />
              ))}
            </View>
          )}
        </View>
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
  tabRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: typography.sizes.body2,
    color: '#666',
    fontWeight: typography.weights.medium,
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  boardRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  column: {
    width: 280,
    borderRadius: borderRadius.card,
    padding: spacing.sm,
    minHeight: 200,
  },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  columnTitle: {
    fontSize: typography.sizes.body1,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  columnCount: {
    fontSize: typography.sizes.caption,
    color: '#666',
    backgroundColor: '#E0E0E0',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  noTasks: {
    fontSize: typography.sizes.body2,
    color: '#999',
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  milestoneSection: {
    marginBottom: spacing.lg,
  },
  milestoneHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  milestoneName: {
    fontSize: typography.sizes.body1,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  milestoneDue: {
    fontSize: typography.sizes.caption,
    color: '#666',
  },
  emptyText: {
    fontSize: typography.sizes.body2,
    color: '#999',
  },
});
