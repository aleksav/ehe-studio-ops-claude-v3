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
  milestone_id?: string | null;
  assignments?: TaskAssignment[];
}

interface Milestone {
  id: string;
  project_id: string;
  name: string;
  due_date: string | null;
  is_overdue?: boolean;
}

type StandupViewMode = 'board' | 'milestones' | 'people';

interface SwimlaneData {
  id: string | null;
  name: string;
  due_date: string | null;
  is_overdue?: boolean;
  tasks: Task[];
}

interface PersonRow {
  memberId: string | null;
  memberName: string;
  tasks: Task[];
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

const TASK_STATUS_LABEL: Record<string, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
};

const TASK_STATUS_BG: Record<string, string> = {
  TODO: '#E0E0E0',
  IN_PROGRESS: '#BBDEFB',
  DONE: '#C8E6C9',
  CANCELLED: '#FFE0B2',
};

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
  const [viewMode, setViewMode] = useState<StandupViewMode>('board');
  const [tasksByProject, setTasksByProject] = useState<Record<string, Task[]>>({});
  const [milestonesByProject, setMilestonesByProject] = useState<Record<string, Milestone[]>>({});
  const [loadingProjects, setLoadingProjects] = useState<Set<string>>(new Set());

  const activeProjects = useMemo(() => {
    const active = allProjects.filter((p) => p.status === 'ACTIVE');
    return seededShuffle(active, todaySeed());
  }, [allProjects]);

  const plannedProjects = useMemo(
    () => allProjects.filter((p) => p.status === 'PLANNED'),
    [allProjects],
  );

  // Carousel items: active projects + planned summary slide at the end
  const carouselItems = useMemo(() => {
    const items: Array<{ type: 'active'; project: Project } | { type: 'planned' }> =
      activeProjects.map((p) => ({ type: 'active' as const, project: p }));
    if (plannedProjects.length > 0) {
      items.push({ type: 'planned' as const });
    }
    return items;
  }, [activeProjects, plannedProjects]);

  const currentItem = carouselItems[currentIndex] ?? null;
  const currentProject = currentItem?.type === 'active' ? currentItem.project : null;

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
        const [taskData, milestoneData] = await Promise.all([
          api.get<Task[]>(`/api/projects/${projectId}/tasks`),
          api.get<Milestone[]>(`/api/projects/${projectId}/milestones`),
        ]);
        setTasksByProject((prev) => ({ ...prev, [projectId]: taskData }));
        setMilestonesByProject((prev) => ({ ...prev, [projectId]: milestoneData }));
      } catch {
        setTasksByProject((prev) => ({ ...prev, [projectId]: [] }));
        setMilestonesByProject((prev) => ({ ...prev, [projectId]: [] }));
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
    if (currentIndex < carouselItems.length - 1) {
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

  const currentMilestones = currentProject ? (milestonesByProject[currentProject.id] ?? []) : [];

  const todoTasks = currentTasks.filter((t) => t.status === 'TODO');
  const inProgressTasks = currentTasks.filter((t) => t.status === 'IN_PROGRESS');
  const doneTasks = currentTasks.filter((t) => t.status === 'DONE' && isRecentlyCompleted(t));

  const totalNonCancelled = currentTasks.filter((t) => t.status !== 'CANCELLED').length;
  const doneCount = currentTasks.filter((t) => t.status === 'DONE').length;
  const completionPercent = totalNonCancelled > 0 ? (doneCount / totalNonCancelled) * 100 : 0;

  // ---- Milestone swimlanes ----
  const swimlanes = useMemo<SwimlaneData[]>(() => {
    if (!currentProject) return [];
    const sorted = [...currentMilestones].sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });
    const activeTasks = currentTasks.filter((t) => t.status !== 'CANCELLED');
    const lanes: SwimlaneData[] = sorted.map((m) => ({
      id: m.id,
      name: m.name,
      due_date: m.due_date,
      is_overdue: m.is_overdue,
      tasks: activeTasks.filter((t) => t.milestone_id === m.id),
    }));
    const unassigned = activeTasks.filter((t) => !t.milestone_id);
    if (unassigned.length > 0 || lanes.length > 0) {
      lanes.push({ id: null, name: 'No Milestone', due_date: null, is_overdue: false, tasks: unassigned });
    }
    return lanes;
  }, [currentProject, currentTasks, currentMilestones]);

  // ---- People rows ----
  const personRows = useMemo<PersonRow[]>(() => {
    if (!currentProject) return [];
    const memberMap = new Map<string, { member: TaskAssignment['team_member']; tasks: Task[] }>();
    const unassignedTasks: Task[] = [];
    for (const task of currentTasks) {
      if (task.status === 'CANCELLED') continue;
      const assignments = task.assignments ?? [];
      if (assignments.length === 0) {
        unassignedTasks.push(task);
      } else {
        for (const a of assignments) {
          const mid = a.team_member.id;
          if (!memberMap.has(mid)) memberMap.set(mid, { member: a.team_member, tasks: [] });
          memberMap.get(mid)!.tasks.push(task);
        }
      }
    }
    const rows: PersonRow[] = [];
    const sortedMembers = Array.from(memberMap.entries()).sort((a, b) =>
      a[1].member.full_name.localeCompare(b[1].member.full_name),
    );
    for (const [memberId, { member, tasks: memberTasks }] of sortedMembers) {
      rows.push({ memberId, memberName: member.full_name, tasks: memberTasks });
    }
    if (unassignedTasks.length > 0) {
      rows.push({ memberId: null, memberName: 'Unassigned', tasks: unassignedTasks });
    }
    return rows;
  }, [currentProject, currentTasks]);

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
        {carouselItems.map((item, idx) => (
          <View
            key={idx}
            style={[
              styles.dot,
              idx === currentIndex && [
                styles.dotActive,
                item.type === 'planned' && styles.dotPlanned,
              ],
            ]}
          />
        ))}
      </View>
      <Text style={styles.counter}>
        {currentItem?.type === 'planned'
          ? 'Coming Up Next'
          : `Project ${currentIndex + 1} of ${activeProjects.length}`}
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
            size={28}
            color={currentIndex === 0 ? '#ccc' : '#fff'}
          />
        </TouchableOpacity>

        <View style={styles.projectSpotlight}>
          {/* Planned Projects Slide */}
          {currentItem?.type === 'planned' && (
            <>
              <Text style={styles.spotlightClient}>COMING UP</Text>
              <Text style={styles.spotlightName}>Planned Projects</Text>
              <Text style={styles.plannedSubtitle}>
                {plannedProjects.length} project{plannedProjects.length !== 1 ? 's' : ''} in the
                pipeline
              </Text>
              {plannedProjects.map((project) => (
                <View key={project.id} style={styles.plannedCard}>
                  <View>
                    <Text style={styles.plannedCardName}>{project.name}</Text>
                    {project.client && (
                      <Text style={styles.plannedCardClient}>{project.client.name}</Text>
                    )}
                  </View>
                  <View style={styles.plannedChip}>
                    <Text style={styles.plannedChipText}>Planned</Text>
                  </View>
                </View>
              ))}
            </>
          )}

          {/* Active Project Slide */}
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

              {/* View Toggle */}
              <View style={styles.viewToggleRow}>
                {(['board', 'milestones', 'people'] as const).map((mode) => (
                  <TouchableOpacity
                    key={mode}
                    onPress={() => setViewMode(mode)}
                    style={[styles.viewToggleBtn, viewMode === mode && styles.viewToggleBtnActive]}
                  >
                    <Text
                      style={[
                        styles.viewToggleText,
                        viewMode === mode && styles.viewToggleTextActive,
                      ]}
                    >
                      {mode === 'board' ? 'Board' : mode === 'milestones' ? 'Milestones' : 'People'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Task Views */}
              {isCurrentLoading ? (
                <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />
              ) : viewMode === 'board' ? (
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
              ) : viewMode === 'milestones' ? (
                <View style={styles.milestonesContainer}>
                  {swimlanes.length === 0 ? (
                    <Text style={styles.noTasksText}>No milestones or tasks to display.</Text>
                  ) : (
                    swimlanes.map((lane) => (
                      <View
                        key={lane.id ?? '__none__'}
                        style={[
                          styles.swimlane,
                          lane.is_overdue && styles.swimlaneOverdue,
                        ]}
                      >
                        <View style={styles.swimlaneHeader}>
                          <Text style={styles.swimlaneName}>{lane.name}</Text>
                          {lane.due_date && (
                            <Text style={styles.swimlaneDue}>
                              Due {new Date(lane.due_date).toLocaleDateString()}
                            </Text>
                          )}
                          {lane.is_overdue && (
                            <View style={styles.overdueChip}>
                              <Text style={styles.overdueChipText}>Overdue</Text>
                            </View>
                          )}
                          <View style={styles.countChip}>
                            <Text style={styles.countChipText}>{lane.tasks.length}</Text>
                          </View>
                        </View>
                        {lane.tasks.length === 0 ? (
                          <Text style={styles.noTasksText}>No tasks</Text>
                        ) : (
                          lane.tasks.map((task) => (
                            <View key={task.id} style={styles.milestoneTaskRow}>
                              <View
                                style={[
                                  styles.statusChipSmall,
                                  { backgroundColor: TASK_STATUS_BG[task.status] ?? '#E0E0E0' },
                                ]}
                              >
                                <Text style={styles.statusChipSmallText}>
                                  {TASK_STATUS_LABEL[task.status] ?? task.status}
                                </Text>
                              </View>
                              <Text style={styles.milestoneTaskText} numberOfLines={1}>
                                {task.description}
                              </Text>
                            </View>
                          ))
                        )}
                      </View>
                    ))
                  )}
                </View>
              ) : (
                <View style={styles.peopleContainer}>
                  {personRows.length === 0 ? (
                    <Text style={styles.noTasksText}>No tasks to display.</Text>
                  ) : (
                    personRows.map((row) => (
                      <View key={row.memberId ?? 'unassigned'} style={styles.personSection}>
                        <View style={styles.personHeader}>
                          <View
                            style={[
                              styles.personAvatar,
                              { backgroundColor: row.memberId ? '#1565C0' : '#757575' },
                            ]}
                          >
                            <Text style={styles.personAvatarText}>
                              {row.memberName.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                          <Text style={styles.personName}>{row.memberName}</Text>
                          <View style={styles.countChip}>
                            <Text style={styles.countChipText}>{row.tasks.length}</Text>
                          </View>
                        </View>
                        {row.tasks.map((task) => (
                          <View key={task.id} style={styles.milestoneTaskRow}>
                            <View
                              style={[
                                styles.statusChipSmall,
                                { backgroundColor: TASK_STATUS_BG[task.status] ?? '#E0E0E0' },
                              ]}
                            >
                              <Text style={styles.statusChipSmallText}>
                                {TASK_STATUS_LABEL[task.status] ?? task.status}
                              </Text>
                            </View>
                            <Text style={styles.milestoneTaskText} numberOfLines={1}>
                              {task.description}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ))
                  )}
                </View>
              )}
            </>
          )}
        </View>

        <TouchableOpacity
          onPress={goNext}
          disabled={currentIndex >= carouselItems.length - 1}
          style={[
            styles.navButton,
            currentIndex >= carouselItems.length - 1 && styles.navButtonDisabled,
          ]}
        >
          <Ionicons
            name="chevron-forward"
            size={28}
            color={currentIndex >= carouselItems.length - 1 ? '#ccc' : '#fff'}
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
  dotPlanned: {
    backgroundColor: '#757575',
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
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xxl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  navButtonDisabled: {
    backgroundColor: '#E0E0E0',
    shadowOpacity: 0,
    elevation: 0,
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
  plannedSubtitle: {
    fontSize: typography.sizes.body2,
    color: '#666',
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  plannedCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: '#fff',
    borderRadius: borderRadius.card,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    marginBottom: spacing.sm,
  },
  plannedCardName: {
    fontSize: typography.sizes.body1,
    fontWeight: typography.weights.medium,
    color: colors.text,
  },
  plannedCardClient: {
    fontSize: typography.sizes.caption,
    color: '#666',
    marginTop: 2,
  },
  plannedChip: {
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  plannedChipText: {
    fontSize: typography.sizes.caption,
    color: '#666',
  },
  viewToggleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: spacing.md,
    gap: 0,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D0D0D0',
    overflow: 'hidden',
    alignSelf: 'center',
  },
  viewToggleBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: '#fff',
  },
  viewToggleBtnActive: {
    backgroundColor: colors.primary,
  },
  viewToggleText: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.medium,
    color: '#666',
  },
  viewToggleTextActive: {
    color: '#fff',
    fontWeight: typography.weights.semibold,
  },
  milestonesContainer: {
    paddingHorizontal: spacing.xs,
  },
  swimlane: {
    marginBottom: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    borderRadius: borderRadius.card,
    backgroundColor: '#F5F5F5',
    padding: spacing.sm,
  },
  swimlaneOverdue: {
    borderLeftColor: '#f44336',
    backgroundColor: '#FFF3F0',
  },
  swimlaneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    flexWrap: 'wrap',
  },
  swimlaneName: {
    fontSize: typography.sizes.body1,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  swimlaneDue: {
    fontSize: typography.sizes.caption,
    color: '#666',
  },
  overdueChip: {
    backgroundColor: '#f44336',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  overdueChipText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: typography.weights.semibold,
  },
  countChip: {
    backgroundColor: '#E0E0E0',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 'auto',
  },
  countChipText: {
    fontSize: typography.sizes.caption,
    color: '#666',
  },
  milestoneTaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: '#fff',
    borderRadius: borderRadius.card,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    marginBottom: spacing.xs,
  },
  milestoneTaskText: {
    flex: 1,
    fontSize: typography.sizes.body2,
    color: colors.text,
  },
  statusChipSmall: {
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  statusChipSmallText: {
    fontSize: 10,
    fontWeight: typography.weights.medium,
    color: '#333',
  },
  peopleContainer: {
    paddingHorizontal: spacing.xs,
  },
  personSection: {
    marginBottom: spacing.md,
  },
  personHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  personAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  personAvatarText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: typography.weights.bold,
  },
  personName: {
    fontSize: typography.sizes.body1,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
});
