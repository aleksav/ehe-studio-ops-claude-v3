import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '@ehestudio-ops/shared';
import { api } from '../lib/api';
import TaskCard from '../components/TaskCard';

interface Client {
  id: string;
  name: string;
}

interface Project {
  id: string;
  name: string;
  status: string;
  client: Client | null;
}

interface TaskAssignment {
  id: string;
  team_member_id: string;
  team_member: {
    id: string;
    full_name: string;
    email: string;
  };
}

interface Task {
  id: string;
  project_id: string;
  description: string;
  status: string;
  completed_at?: string | null;
  is_stale?: boolean;
  assignments?: TaskAssignment[];
}

const STANDUP_PROMPTS = [
  'What did you accomplish yesterday?',
  'Any blockers the team can help with?',
  'What wins are we celebrating today?',
  "What's your focus for today?",
  'Anyone need a pair of fresh eyes?',
  'Any risks or concerns to flag?',
  'What are you most excited about?',
  'How can the team support you today?',
];

function dayOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function todaySeed(): number {
  const now = new Date();
  return now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  let s = seed;
  for (let i = result.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const j = ((s >>> 0) % (i + 1)) >>> 0;
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function isRecentlyCompleted(task: Task): boolean {
  if (!task.completed_at) return true;
  const completedDate = new Date(task.completed_at);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  return completedDate >= sevenDaysAgo;
}

const COLUMN_COLORS: Record<string, string> = {
  TODO: '#F5F5F5',
  IN_PROGRESS: '#E3F2FD',
  DONE: '#E8F5E9',
};

const COLUMN_LABELS: Record<string, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done (7d)',
};

const screenWidth = Dimensions.get('window').width;

export default function StandupScreen() {
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [tasksByProject, setTasksByProject] = useState<Record<string, Task[]>>({});
  const [loadingProjects, setLoadingProjects] = useState<Set<string>>(new Set());

  const activeProjects = useMemo(() => {
    const active = allProjects.filter((p) => p.status === 'ACTIVE');
    return seededShuffle(active, todaySeed());
  }, [allProjects]);

  const currentProject = activeProjects[currentIndex] ?? null;

  const standupPrompt = useMemo(() => STANDUP_PROMPTS[dayOfYear() % STANDUP_PROMPTS.length], []);

  // Fetch projects
  useEffect(() => {
    (async () => {
      try {
        const data = await api.get<Project[]>('/api/projects');
        setAllProjects(data.filter((p) => p.status !== 'ARCHIVED' && p.status !== 'COMPLETED'));
      } catch {
        // silently fail
      } finally {
        setProjectsLoading(false);
      }
    })();
  }, []);

  // Fetch tasks for current project
  const fetchProjectTasks = useCallback(
    async (projectId: string) => {
      if (tasksByProject[projectId] || loadingProjects.has(projectId)) return;

      setLoadingProjects((prev) => new Set(prev).add(projectId));
      try {
        const taskData = await api.get<Task[]>(`/api/projects/${projectId}/tasks`);
        setTasksByProject((prev) => ({ ...prev, [projectId]: taskData }));
      } catch {
        setTasksByProject((prev) => ({ ...prev, [projectId]: [] }));
      } finally {
        setLoadingProjects((prev) => {
          const next = new Set(prev);
          next.delete(projectId);
          return next;
        });
      }
    },
    [tasksByProject, loadingProjects],
  );

  useEffect(() => {
    if (activeProjects.length === 0) return;
    const current = activeProjects[currentIndex];
    if (current) fetchProjectTasks(current.id);
    // Prefetch next
    const next = activeProjects[currentIndex + 1];
    if (next) fetchProjectTasks(next.id);
  }, [currentIndex, activeProjects, fetchProjectTasks]);

  const goNext = () => {
    if (currentIndex < activeProjects.length - 1) {
      setCurrentIndex((i) => i + 1);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  };

  const currentTasks = currentProject ? (tasksByProject[currentProject.id] ?? []) : [];
  const isCurrentLoading = currentProject
    ? loadingProjects.has(currentProject.id) && !tasksByProject[currentProject.id]
    : false;

  const todoTasks = currentTasks.filter((t) => t.status === 'TODO');
  const inProgressTasks = currentTasks.filter((t) => t.status === 'IN_PROGRESS');
  const doneTasks = currentTasks.filter((t) => t.status === 'DONE' && isRecentlyCompleted(t));

  const totalNonCancelled = currentTasks.filter((t) => t.status !== 'CANCELLED').length;
  const doneCount = currentTasks.filter((t) => t.status === 'DONE').length;
  const completionPercent = totalNonCancelled > 0 ? (doneCount / totalNonCancelled) * 100 : 0;

  if (projectsLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (activeProjects.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>Standup</Text>
        <Text style={styles.emptyText}>
          No active projects to review. Start a project to see it here.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header & Prompt */}
      <Text style={styles.pageTitle}>Standup</Text>
      <Text style={styles.prompt}>{standupPrompt}</Text>

      {/* Progress Dots */}
      <View style={styles.dotsRow}>
        {activeProjects.map((_, idx) => (
          <View key={idx} style={[styles.dot, idx === currentIndex && styles.dotActive]} />
        ))}
      </View>
      <Text style={styles.counter}>
        Project {currentIndex + 1} of {activeProjects.length}
      </Text>

      {/* Navigation + Project */}
      <View style={styles.carouselRow}>
        <TouchableOpacity
          onPress={goPrev}
          disabled={currentIndex === 0}
          style={[styles.navButton, currentIndex === 0 && styles.navButtonDisabled]}
        >
          <Ionicons
            name="chevron-back"
            size={24}
            color={currentIndex === 0 ? '#ccc' : colors.text}
          />
        </TouchableOpacity>

        <View style={styles.projectSpotlight}>
          {currentProject && (
            <>
              {currentProject.client && (
                <Text style={styles.spotlightClient}>{currentProject.client.name}</Text>
              )}
              <Text style={styles.spotlightName}>{currentProject.name}</Text>

              {/* Completion bar */}
              <View style={styles.progressRow}>
                <Text style={styles.progressLabel}>Completion</Text>
                <Text style={styles.progressPct}>{Math.round(completionPercent)}%</Text>
              </View>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.min(completionPercent, 100)}%` as `${number}%` },
                  ]}
                />
              </View>

              {/* Kanban Columns */}
              {isCurrentLoading ? (
                <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.columnsScroll}
                >
                  {(['TODO', 'IN_PROGRESS', 'DONE'] as const).map((col) => {
                    const colTasks =
                      col === 'TODO'
                        ? todoTasks
                        : col === 'IN_PROGRESS'
                          ? inProgressTasks
                          : doneTasks;
                    return (
                      <View
                        key={col}
                        style={[styles.column, { backgroundColor: COLUMN_COLORS[col] }]}
                      >
                        <View style={styles.columnHeader}>
                          <Text style={styles.columnTitle}>{COLUMN_LABELS[col]}</Text>
                          <Text style={styles.columnCount}>{colTasks.length}</Text>
                        </View>
                        {colTasks.map((task) => (
                          <TaskCard
                            key={task.id}
                            title={task.description}
                            status={task.status}
                            assignments={task.assignments}
                          />
                        ))}
                        {colTasks.length === 0 && <Text style={styles.noTasksText}>No tasks</Text>}
                      </View>
                    );
                  })}
                </ScrollView>
              )}
            </>
          )}
        </View>

        <TouchableOpacity
          onPress={goNext}
          disabled={currentIndex >= activeProjects.length - 1}
          style={[
            styles.navButton,
            currentIndex >= activeProjects.length - 1 && styles.navButtonDisabled,
          ]}
        >
          <Ionicons
            name="chevron-forward"
            size={24}
            color={currentIndex >= activeProjects.length - 1 ? '#ccc' : colors.text}
          />
        </TouchableOpacity>
      </View>
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
  emptyContainer: {
    flex: 1,
    padding: spacing.lg,
    backgroundColor: '#FAFAFA',
  },
  emptyTitle: {
    fontSize: typography.sizes.h3,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: typography.sizes.body1,
    color: '#666',
  },
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  pageTitle: {
    fontSize: typography.sizes.h2,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  prompt: {
    fontSize: typography.sizes.body1,
    color: colors.primary,
    fontStyle: 'italic',
    marginBottom: spacing.lg,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D0D0D0',
  },
  dotActive: {
    width: 24,
    backgroundColor: colors.primary,
  },
  counter: {
    fontSize: typography.sizes.body2,
    color: '#666',
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  carouselRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  navButton: {
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xs,
  },
  navButtonDisabled: {
    opacity: 0.3,
  },
  projectSpotlight: {
    flex: 1,
  },
  spotlightClient: {
    fontSize: typography.sizes.caption,
    color: '#666',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  spotlightName: {
    fontSize: typography.sizes.h3,
    fontWeight: typography.weights.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  progressLabel: {
    fontSize: typography.sizes.body2,
    color: '#666',
  },
  progressPct: {
    fontSize: typography.sizes.body2,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    marginBottom: spacing.lg,
  },
  progressFill: {
    height: 8,
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  loader: {
    paddingVertical: spacing.xl,
  },
  columnsScroll: {
    marginHorizontal: -spacing.md,
  },
  column: {
    width: screenWidth * 0.65,
    borderRadius: borderRadius.card,
    padding: spacing.sm,
    marginHorizontal: spacing.xs,
    minHeight: 150,
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
  noTasksText: {
    fontSize: typography.sizes.body2,
    color: '#999',
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
});
