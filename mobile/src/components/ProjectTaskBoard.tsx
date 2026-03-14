import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Switch } from 'react-native';
import { TouchableOpacity } from 'react-native';
import { colors, spacing, borderRadius, typography } from '@ehestudio-ops/shared';
import TaskCard from './TaskCard';

// ---------------------------------------------------------------------------
// Types (exported for consumers)
// ---------------------------------------------------------------------------

export interface TaskAssignment {
  id: string;
  team_member_id: string;
  team_member: {
    id: string;
    full_name: string;
    email: string;
  };
}

export interface BoardTask {
  id: string;
  project_id: string;
  description: string;
  status: string;
  completed_at?: string | null;
  is_stale?: boolean;
  milestone_id?: string | null;
  assignments?: TaskAssignment[];
}

export interface BoardMilestone {
  id: string;
  project_id: string;
  name: string;
  due_date: string | null;
  is_overdue?: boolean;
}

export type ViewMode = 'board' | 'milestones' | 'people';

interface SwimlaneData {
  id: string | null;
  name: string;
  due_date: string | null;
  is_overdue?: boolean;
  tasks: BoardTask[];
}

interface PersonRow {
  memberId: string | null;
  memberName: string;
  tasks: BoardTask[];
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ProjectTaskBoardProps {
  tasks: BoardTask[];
  milestones: BoardMilestone[];

  /** Filter Done tasks to only recently completed (last 7 days). */
  filterRecentDone?: boolean;

  // ---- Hide empty milestones ----
  hideEmptyMilestones?: boolean;
  onHideEmptyChange?: (checked: boolean) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function isRecentlyCompleted(task: BoardTask): boolean {
  if (!task.completed_at) return true;
  const completedDate = new Date(task.completed_at);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  return completedDate >= sevenDaysAgo;
}

// ---------------------------------------------------------------------------
// StatusColumns: renders three kanban columns horizontally
// ---------------------------------------------------------------------------

function StatusColumns({
  tasks,
  milestoneMap,
  filterRecentDone,
  doneLabel,
}: {
  tasks: BoardTask[];
  milestoneMap?: Map<string, string>;
  filterRecentDone?: boolean;
  doneLabel?: string;
}) {
  const todoTasks = tasks.filter((t) => t.status === 'TODO');
  const inProgressTasks = tasks.filter((t) => t.status === 'IN_PROGRESS');
  const doneTasks = tasks.filter(
    (t) => t.status === 'DONE' && (!filterRecentDone || isRecentlyCompleted(t)),
  );

  const columns = [
    { status: 'TODO' as const, tasks: todoTasks },
    { status: 'IN_PROGRESS' as const, tasks: inProgressTasks },
    { status: 'DONE' as const, tasks: doneTasks },
  ];

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.boardRow}>
        {columns.map(({ status, tasks: colTasks }) => (
          <View key={status} style={[styles.column, { backgroundColor: COLUMN_COLORS[status] }]}>
            <View style={styles.columnHeader}>
              <Text style={styles.columnTitle}>
                {status === 'DONE' && doneLabel ? doneLabel : COLUMN_LABELS[status]}
              </Text>
              <Text style={styles.columnCount}>{colTasks.length}</Text>
            </View>
            {colTasks.map((task) => (
              <TaskCard
                key={task.id}
                title={task.description}
                status={task.status}
                milestoneName={
                  task.milestone_id && milestoneMap ? milestoneMap.get(task.milestone_id) : null
                }
                assignments={task.assignments}
              />
            ))}
            {colTasks.length === 0 && <Text style={styles.noTasks}>No tasks</Text>}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ProjectTaskBoard({
  tasks,
  milestones,
  filterRecentDone,
  hideEmptyMilestones: hideEmptyMilestonesProp,
  onHideEmptyChange,
}: ProjectTaskBoardProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('board');
  const [hideEmptyMilestones, setHideEmptyMilestones] = useState(hideEmptyMilestonesProp ?? false);

  const handleHideEmptyChange = (checked: boolean) => {
    setHideEmptyMilestones(checked);
    onHideEmptyChange?.(checked);
  };

  const milestoneMap = useMemo(() => {
    const m = new Map<string, string>();
    milestones.forEach((ms) => m.set(ms.id, ms.name));
    return m;
  }, [milestones]);

  // ---- Milestone swimlanes ----
  const swimlanes = useMemo<SwimlaneData[]>(() => {
    const sorted = [...milestones].sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });
    const activeTasks = tasks.filter((t) => t.status !== 'CANCELLED');
    const lanes: SwimlaneData[] = sorted.map((m) => ({
      id: m.id,
      name: m.name,
      due_date: m.due_date,
      is_overdue: m.is_overdue,
      tasks: activeTasks.filter((t) => t.milestone_id === m.id),
    }));
    const unassigned = activeTasks.filter((t) => !t.milestone_id);
    if (unassigned.length > 0 || lanes.length > 0) {
      lanes.push({
        id: null,
        name: 'No Milestone',
        due_date: null,
        is_overdue: false,
        tasks: unassigned,
      });
    }
    return lanes;
  }, [tasks, milestones]);

  const filteredSwimlanes = useMemo(() => {
    if (!hideEmptyMilestones) return swimlanes;
    return swimlanes.filter((lane) => {
      return lane.tasks.some((t) => t.status === 'IN_PROGRESS' || t.status === 'DONE');
    });
  }, [swimlanes, hideEmptyMilestones]);

  const hiddenMilestoneCount = swimlanes.length - filteredSwimlanes.length;

  // ---- People rows ----
  const personRows = useMemo<PersonRow[]>(() => {
    const memberMap = new Map<
      string,
      { member: TaskAssignment['team_member']; tasks: BoardTask[] }
    >();
    const unassignedTasks: BoardTask[] = [];
    for (const task of tasks) {
      if (task.status === 'CANCELLED') continue;
      const assigns = task.assignments ?? [];
      if (assigns.length === 0) {
        unassignedTasks.push(task);
      } else {
        assigns.forEach((a) => {
          const mid = a.team_member.id;
          if (!memberMap.has(mid)) {
            memberMap.set(mid, { member: a.team_member, tasks: [] });
          }
          memberMap.get(mid)!.tasks.push(task);
        });
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
  }, [tasks]);

  const doneLabel = filterRecentDone ? 'Done (7d)' : undefined;

  return (
    <View>
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
        <StatusColumns
          tasks={tasks}
          milestoneMap={milestoneMap}
          filterRecentDone={filterRecentDone}
          doneLabel={doneLabel}
        />
      )}

      {/* Milestones View */}
      {viewMode === 'milestones' && (
        <View style={styles.milestonesContainer}>
          {/* Hide empty milestones toggle */}
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Show only active milestones</Text>
            <Switch
              value={hideEmptyMilestones}
              onValueChange={handleHideEmptyChange}
              trackColor={{ false: '#D0D0D0', true: colors.primary + '80' }}
              thumbColor={hideEmptyMilestones ? colors.primary : '#f4f3f4'}
            />
            {hiddenMilestoneCount > 0 && (
              <Text style={styles.hiddenCount}>({hiddenMilestoneCount} hidden)</Text>
            )}
          </View>
          {filteredSwimlanes.length === 0 ? (
            <Text style={styles.noTasks}>No milestones or tasks to display.</Text>
          ) : (
            filteredSwimlanes.map((lane) => {
              const laneTotal = lane.tasks.filter(
                (t) => t.status === 'TODO' || t.status === 'IN_PROGRESS' || t.status === 'DONE',
              ).length;
              return (
                <View
                  key={lane.id ?? '__none__'}
                  style={[styles.swimlane, lane.is_overdue && styles.swimlaneOverdue]}
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
                      <Text style={styles.countChipText}>{laneTotal}</Text>
                    </View>
                  </View>
                  {laneTotal === 0 ? (
                    <Text style={styles.noTasks}>No tasks</Text>
                  ) : (
                    <StatusColumns
                      tasks={lane.tasks}
                      milestoneMap={milestoneMap}
                      filterRecentDone={filterRecentDone}
                      doneLabel={doneLabel}
                    />
                  )}
                </View>
              );
            })
          )}
        </View>
      )}

      {/* People View */}
      {viewMode === 'people' && (
        <View style={styles.peopleContainer}>
          {personRows.length === 0 ? (
            <Text style={styles.noTasks}>No tasks to display.</Text>
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
                <StatusColumns
                  tasks={row.tasks}
                  milestoneMap={milestoneMap}
                  filterRecentDone={filterRecentDone}
                  doneLabel={doneLabel}
                />
              </View>
            ))
          )}
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
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
    minHeight: 150,
    marginHorizontal: spacing.xs,
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
  milestonesContainer: {
    paddingHorizontal: spacing.xs,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  toggleLabel: {
    fontSize: typography.sizes.body2,
    color: '#666',
    flex: 1,
  },
  hiddenCount: {
    fontSize: typography.sizes.caption,
    color: '#999',
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
