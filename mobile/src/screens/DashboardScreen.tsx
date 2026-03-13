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
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';

interface Project {
  id: string;
  name: string;
  status: string;
  client: { id: string; name: string } | null;
}

interface MyTask {
  id: string;
  description: string;
  status: string;
  project_name: string;
  client_name: string | null;
}

interface MyProject {
  id: string;
  name: string;
  status: string;
  client_name: string | null;
  hours_this_week: number;
  budget_spend_pct: number | null;
}

const STATUS_COLORS: Record<string, string> = {
  TODO: '#9E9E9E',
  IN_PROGRESS: '#2196F3',
  DONE: '#4CAF50',
};

const STATUS_LABELS: Record<string, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done',
};

function SummaryCard({
  label,
  value,
  loading,
}: {
  label: string;
  value: string | null;
  loading: boolean;
}) {
  return (
    <View style={summaryStyles.card}>
      <Text style={summaryStyles.label}>{label}</Text>
      {loading ? (
        <ActivityIndicator size="small" color={colors.primary} style={summaryStyles.loader} />
      ) : (
        <Text style={summaryStyles.value}>{value ?? '--'}</Text>
      )}
    </View>
  );
}

const summaryStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: borderRadius.card,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.md,
    minWidth: 100,
  },
  label: {
    fontSize: typography.sizes.caption,
    color: '#666',
    marginBottom: spacing.xs,
  },
  value: {
    fontSize: typography.sizes.h2,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  loader: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
});

export default function DashboardScreen() {
  const { user, logout } = useAuth();
  const displayName = user?.team_member?.full_name ?? user?.email ?? 'there';
  const teamMemberId = user?.team_member?.id ?? null;

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [myTasks, setMyTasks] = useState<MyTask[]>([]);
  const [myTasksLoading, setMyTasksLoading] = useState(true);
  const [myProjects, setMyProjects] = useState<MyProject[]>([]);
  const [myProjectsLoading, setMyProjectsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const activeProjects = projects.filter((p) => p.status === 'ACTIVE');
  const myOpenTasks = useMemo(
    () => myTasks.filter((t) => t.status === 'TODO' || t.status === 'IN_PROGRESS'),
    [myTasks],
  );
  const myHoursThisWeek = useMemo(() => {
    const total = myProjects.reduce((sum, p) => sum + p.hours_this_week, 0);
    return total > 0 ? total.toFixed(1) : '0';
  }, [myProjects]);

  const fetchData = async () => {
    const fetches: Promise<void>[] = [];

    fetches.push(
      api
        .get<Project[]>('/api/projects')
        .then((data) => setProjects(data))
        .catch(() => {})
        .finally(() => setProjectsLoading(false)),
    );

    if (teamMemberId) {
      fetches.push(
        api
          .get<MyTask[]>('/api/me/tasks')
          .then((data) => setMyTasks(data))
          .catch(() => setMyTasks([]))
          .finally(() => setMyTasksLoading(false)),
      );
      fetches.push(
        api
          .get<MyProject[]>('/api/me/projects')
          .then((data) => setMyProjects(data))
          .catch(() => setMyProjects([]))
          .finally(() => setMyProjectsLoading(false)),
      );
    } else {
      setMyTasksLoading(false);
      setMyProjectsLoading(false);
    }

    await Promise.all(fetches);
  };

  useEffect(() => {
    void fetchData();
  }, [teamMemberId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.welcomeTitle}>Welcome, {displayName}</Text>
          <Text style={styles.welcomeSubtitle}>Here's your studio at a glance.</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>
      </View>

      {/* Studio Overview */}
      <Text style={styles.sectionTitle}>Studio Overview</Text>
      <View style={styles.summaryRow}>
        <SummaryCard
          label="Active Projects"
          value={projectsLoading ? null : String(activeProjects.length)}
          loading={projectsLoading}
        />
        <SummaryCard
          label="My Hours (Week)"
          value={myProjectsLoading ? null : myHoursThisWeek}
          loading={myProjectsLoading}
        />
        <SummaryCard
          label="My Open Tasks"
          value={myTasksLoading ? null : String(myOpenTasks.length)}
          loading={myTasksLoading}
        />
      </View>

      {/* My Assigned Tasks */}
      <Text style={styles.sectionTitle}>My Assigned Tasks</Text>
      <View style={styles.card}>
        {myTasksLoading ? (
          <ActivityIndicator size="small" color={colors.primary} style={styles.centerLoader} />
        ) : myOpenTasks.length === 0 ? (
          <Text style={styles.emptyText}>No open tasks assigned to you.</Text>
        ) : (
          myOpenTasks.slice(0, 10).map((task) => {
            const statusColor = STATUS_COLORS[task.status] ?? '#9E9E9E';
            const projectLabel = task.client_name
              ? `${task.client_name} - ${task.project_name}`
              : task.project_name;
            return (
              <View key={task.id} style={styles.taskRow}>
                <View style={styles.taskContent}>
                  <Text style={styles.taskTitle} numberOfLines={1}>
                    {task.description}
                  </Text>
                  <Text style={styles.taskProject}>{projectLabel}</Text>
                </View>
                <View style={[styles.statusChip, { backgroundColor: statusColor + '20' }]}>
                  <Text style={[styles.statusText, { color: statusColor }]}>
                    {STATUS_LABELS[task.status] ?? task.status}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* My Active Projects */}
      <Text style={styles.sectionTitle}>My Active Projects</Text>
      {myProjectsLoading ? (
        <ActivityIndicator size="small" color={colors.primary} style={styles.centerLoader} />
      ) : (
        myProjects
          .filter((p) => p.status === 'ACTIVE')
          .map((project) => {
            const projectLabel = project.client_name
              ? `${project.client_name} - ${project.name}`
              : project.name;
            return (
              <View key={project.id} style={styles.projectCard}>
                <Text style={styles.projectName}>{projectLabel}</Text>
                <Text style={styles.projectHours}>
                  {project.hours_this_week > 0
                    ? `${project.hours_this_week.toFixed(1)}h this week`
                    : 'No hours this week'}
                </Text>
                {project.budget_spend_pct !== null && (
                  <View style={styles.budgetRow}>
                    <Text style={styles.budgetLabel}>Budget</Text>
                    <Text
                      style={[
                        styles.budgetPct,
                        {
                          color:
                            project.budget_spend_pct > 90
                              ? colors.error
                              : project.budget_spend_pct > 75
                                ? colors.warning
                                : '#666',
                        },
                      ]}
                    >
                      {project.budget_spend_pct.toFixed(1)}%
                    </Text>
                  </View>
                )}
              </View>
            );
          })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  headerLeft: {
    flex: 1,
  },
  welcomeTitle: {
    fontSize: typography.sizes.h3,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  welcomeSubtitle: {
    fontSize: typography.sizes.body2,
    color: '#666',
  },
  logoutButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  logoutText: {
    fontSize: typography.sizes.body2,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  sectionTitle: {
    fontSize: typography.sizes.h4,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.md,
    marginTop: spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: borderRadius.card,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.md,
  },
  centerLoader: {
    paddingVertical: spacing.lg,
  },
  emptyText: {
    fontSize: typography.sizes.body2,
    color: '#999',
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  taskContent: {
    flex: 1,
    marginRight: spacing.sm,
  },
  taskTitle: {
    fontSize: typography.sizes.body2,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  taskProject: {
    fontSize: typography.sizes.caption,
    color: '#666',
    marginTop: 2,
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
  projectCard: {
    backgroundColor: '#fff',
    borderRadius: borderRadius.card,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  projectName: {
    fontSize: typography.sizes.body1,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  projectHours: {
    fontSize: typography.sizes.body2,
    color: '#666',
  },
  budgetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  budgetLabel: {
    fontSize: typography.sizes.caption,
    color: '#666',
  },
  budgetPct: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.semibold,
  },
});
