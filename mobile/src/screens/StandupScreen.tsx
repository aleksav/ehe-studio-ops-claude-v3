import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '@ehestudio-ops/shared';
import { api } from '../lib/api';
import ProjectTaskBoard from '../components/ProjectTaskBoard';
import type { BoardTask, BoardMilestone } from '../components/ProjectTaskBoard';

interface Client {
  id: string;
  name: string;
}

interface Project {
  id: string;
  name: string;
  status: string;
  external_board_url: string | null;
  client: Client | null;
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

export default function StandupScreen() {
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [tasksByProject, setTasksByProject] = useState<Record<string, BoardTask[]>>({});
  const [milestonesByProject, setMilestonesByProject] = useState<Record<string, BoardMilestone[]>>(
    {},
  );
  const [loadingProjects, setLoadingProjects] = useState<Set<string>>(new Set());
  const [hideEmptyMilestones, setHideEmptyMilestones] = useState(false);

  // Load hideEmptyMilestones from AsyncStorage
  useEffect(() => {
    AsyncStorage.getItem('standup-hide-empty-milestones').then((val) => {
      if (val === 'true') setHideEmptyMilestones(true);
    });
  }, []);

  const handleHideEmptyChange = (checked: boolean) => {
    setHideEmptyMilestones(checked);
    AsyncStorage.setItem('standup-hide-empty-milestones', String(checked));
  };

  // Add task modal
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskStatus, setNewTaskStatus] = useState<string>('TODO');
  const [newTaskMilestoneId, setNewTaskMilestoneId] = useState<string>('');
  const [addTaskSubmitting, setAddTaskSubmitting] = useState(false);

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
          api.get<BoardTask[]>(`/api/projects/${projectId}/tasks`),
          api.get<BoardMilestone[]>(`/api/projects/${projectId}/milestones`),
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

  const handleCreateTask = async () => {
    if (!currentProject || !newTaskDescription.trim() || addTaskSubmitting) return;
    const projectId = currentProject.id;
    setAddTaskSubmitting(true);
    try {
      const body: Record<string, string> = {
        description: newTaskDescription.trim(),
        status: newTaskStatus,
      };
      if (newTaskMilestoneId) body.milestone_id = newTaskMilestoneId;
      await api.post(`/api/projects/${projectId}/tasks`, body);
      setAddTaskOpen(false);
      setNewTaskDescription('');
      setNewTaskStatus('TODO');
      setNewTaskMilestoneId('');
      // Refresh tasks
      const [updatedTasks, updatedMilestones] = await Promise.all([
        api.get<BoardTask[]>(`/api/projects/${projectId}/tasks`),
        api.get<BoardMilestone[]>(`/api/projects/${projectId}/milestones`),
      ]);
      setTasksByProject((prev) => ({ ...prev, [projectId]: updatedTasks }));
      setMilestonesByProject((prev) => ({ ...prev, [projectId]: updatedMilestones }));
    } catch {
      Alert.alert('Error', 'Failed to create task.');
    } finally {
      setAddTaskSubmitting(false);
    }
  };

  const currentTasks = currentProject ? (tasksByProject[currentProject.id] ?? []) : [];
  const isCurrentLoading = currentProject
    ? loadingProjects.has(currentProject.id) && !tasksByProject[currentProject.id]
    : false;

  const currentMilestones = currentProject ? (milestonesByProject[currentProject.id] ?? []) : [];

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
          <Ionicons name="chevron-back" size={28} color={currentIndex === 0 ? '#ccc' : '#fff'} />
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

              {/* Add Task Button */}
              <TouchableOpacity style={styles.addTaskButton} onPress={() => setAddTaskOpen(true)}>
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={styles.addTaskButtonText}>Add Task</Text>
              </TouchableOpacity>

              {/* Task Board */}
              {currentProject.external_board_url ? (
                <View style={styles.externalBoardCard}>
                  <Text style={styles.externalBoardText}>
                    Tasks for this project are managed externally.
                  </Text>
                  <TouchableOpacity
                    style={styles.externalBoardButton}
                    onPress={() => Linking.openURL(currentProject.external_board_url!)}
                  >
                    <Ionicons name="open-outline" size={18} color="#fff" />
                    <Text style={styles.externalBoardButtonText}>Open External Task Board</Text>
                  </TouchableOpacity>
                </View>
              ) : isCurrentLoading ? (
                <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />
              ) : (
                <ProjectTaskBoard
                  tasks={currentTasks}
                  milestones={currentMilestones}
                  filterRecentDone
                  hideEmptyMilestones={hideEmptyMilestones}
                  onHideEmptyChange={handleHideEmptyChange}
                />
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
      {/* Add Task Modal */}
      <Modal visible={addTaskOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Task — {currentProject?.name ?? ''}</Text>

            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={styles.textInput}
              value={newTaskDescription}
              onChangeText={setNewTaskDescription}
              placeholder="Task description"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <Text style={styles.fieldLabel}>Status</Text>
            <View style={styles.statusRow}>
              {(['TODO', 'IN_PROGRESS', 'DONE'] as const).map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.statusChip, newTaskStatus === s && styles.statusChipActive]}
                  onPress={() => setNewTaskStatus(s)}
                >
                  <Text
                    style={[
                      styles.statusChipText,
                      newTaskStatus === s && styles.statusChipTextActive,
                    ]}
                  >
                    {s === 'TODO' ? 'To Do' : s === 'IN_PROGRESS' ? 'In Progress' : 'Done'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Milestone</Text>
            <ScrollView
              horizontal
              style={styles.milestoneScroll}
              showsHorizontalScrollIndicator={false}
            >
              <TouchableOpacity
                style={[styles.statusChip, newTaskMilestoneId === '' && styles.statusChipActive]}
                onPress={() => setNewTaskMilestoneId('')}
              >
                <Text
                  style={[
                    styles.statusChipText,
                    newTaskMilestoneId === '' && styles.statusChipTextActive,
                  ]}
                >
                  None
                </Text>
              </TouchableOpacity>
              {(currentProject ? (milestonesByProject[currentProject.id] ?? []) : []).map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={[
                    styles.statusChip,
                    newTaskMilestoneId === m.id && styles.statusChipActive,
                  ]}
                  onPress={() => setNewTaskMilestoneId(m.id)}
                >
                  <Text
                    style={[
                      styles.statusChipText,
                      newTaskMilestoneId === m.id && styles.statusChipTextActive,
                    ]}
                  >
                    {m.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setAddTaskOpen(false)}
                disabled={addTaskSubmitting}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.createButton,
                  (!newTaskDescription.trim() || addTaskSubmitting) && styles.createButtonDisabled,
                ]}
                onPress={handleCreateTask}
                disabled={!newTaskDescription.trim() || addTaskSubmitting}
              >
                {addTaskSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.createButtonText}>Create Task</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  addTaskButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.button,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignSelf: 'flex-end',
    marginBottom: spacing.md,
    gap: 4,
  },
  addTaskButtonText: {
    color: '#fff',
    fontSize: typography.sizes.body2,
    fontWeight: typography.weights.semibold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: borderRadius.card,
    padding: spacing.lg,
  },
  modalTitle: {
    fontSize: typography.sizes.h4,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontSize: typography.sizes.body2,
    fontWeight: typography.weights.medium,
    color: '#666',
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: borderRadius.input,
    padding: spacing.sm,
    fontSize: typography.sizes.body1,
    minHeight: 80,
    color: colors.text,
  },
  statusRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  milestoneScroll: {
    flexGrow: 0,
    marginBottom: spacing.sm,
  },
  statusChip: {
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: spacing.xs,
  },
  statusChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  statusChipText: {
    fontSize: typography.sizes.body2,
    color: '#666',
  },
  statusChipTextActive: {
    color: '#fff',
    fontWeight: typography.weights.semibold,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  cancelButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  cancelButtonText: {
    fontSize: typography.sizes.body1,
    color: '#666',
  },
  createButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.button,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    color: '#fff',
    fontSize: typography.sizes.body1,
    fontWeight: typography.weights.semibold,
  },
  externalBoardCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: borderRadius.card,
    padding: spacing.lg,
    marginTop: spacing.md,
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
