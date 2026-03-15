import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Switch,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
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

  /** Initial view mode. Defaults to 'board'. */
  initialViewMode?: ViewMode;

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

const PAGE_HORIZONTAL_PADDING = spacing.sm;

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
// PageIndicator: dot indicator for swipeable pages
// ---------------------------------------------------------------------------

function PageIndicator({
  total,
  current,
  labels,
}: {
  total: number;
  current: number;
  labels?: string[];
}) {
  if (total <= 1) return null;

  return (
    <View style={styles.indicatorContainer}>
      {labels ? (
        // Mini tab bar with labels
        <View style={styles.miniTabBar}>
          {labels.map((label, index) => (
            <View
              key={index}
              style={[
                styles.miniTab,
                index === current && styles.miniTabActive,
              ]}
            >
              <Text
                style={[
                  styles.miniTabText,
                  index === current && styles.miniTabTextActive,
                ]}
                numberOfLines={1}
              >
                {label}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        // Dot indicators
        <View style={styles.dotsRow}>
          {Array.from({ length: total }).map((_, index) => (
            <View
              key={index}
              style={[styles.dot, index === current && styles.dotActive]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// SwipeablePages: generic paginated horizontal scroll wrapper
// ---------------------------------------------------------------------------

function SwipeablePages({
  children,
  labels,
  pageKey,
}: {
  children: React.ReactNode[];
  labels?: string[];
  pageKey?: string;
}) {
  const [currentPage, setCurrentPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const windowWidth = Dimensions.get('window').width;
  const pageWidth = windowWidth - PAGE_HORIZONTAL_PADDING * 2;

  // Reset page when content changes (e.g. switching views, filtering)
  const prevKeyRef = useRef(pageKey);
  if (pageKey !== prevKeyRef.current) {
    prevKeyRef.current = pageKey;
    if (currentPage !== 0) {
      setCurrentPage(0);
      // Scroll to start on next frame
      setTimeout(() => {
        scrollRef.current?.scrollTo({ x: 0, animated: false });
      }, 0);
    }
  }

  const totalPages = children.length;

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const page = Math.round(offsetX / pageWidth);
      setCurrentPage(Math.max(0, Math.min(page, totalPages - 1)));
    },
    [pageWidth, totalPages],
  );

  if (totalPages === 0) {
    return <Text style={styles.noTasks}>No items to display.</Text>;
  }

  return (
    <View>
      <PageIndicator
        total={totalPages}
        current={currentPage}
        labels={labels}
      />
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        contentContainerStyle={{ paddingHorizontal: 0 }}
        decelerationRate="fast"
        snapToInterval={pageWidth}
        snapToAlignment="start"
      >
        {children.map((child, index) => (
          <View key={index} style={{ width: pageWidth }}>
            {child}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// TaskColumn: a single column of tasks (used as a swipeable page)
// ---------------------------------------------------------------------------

function TaskColumn({
  status,
  tasks,
  milestoneMap,
  doneLabel,
}: {
  status: string;
  tasks: BoardTask[];
  milestoneMap?: Map<string, string>;
  doneLabel?: string;
}) {
  return (
    <ScrollView style={styles.pageScroll} nestedScrollEnabled>
      <View
        style={[styles.column, { backgroundColor: COLUMN_COLORS[status] }]}
      >
        <View style={styles.columnHeader}>
          <Text style={styles.columnTitle}>
            {status === 'DONE' && doneLabel ? doneLabel : COLUMN_LABELS[status]}
          </Text>
          <Text style={styles.columnCount}>{tasks.length}</Text>
        </View>
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            title={task.description}
            status={task.status}
            milestoneName={
              task.milestone_id && milestoneMap
                ? milestoneMap.get(task.milestone_id)
                : null
            }
            assignments={task.assignments}
          />
        ))}
        {tasks.length === 0 && <Text style={styles.noTasks}>No tasks</Text>}
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// BoardSwipeable: Board view with swipeable TODO/IN_PROGRESS/DONE pages
// ---------------------------------------------------------------------------

function BoardSwipeable({
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
    (t) =>
      t.status === 'DONE' && (!filterRecentDone || isRecentlyCompleted(t)),
  );

  const columns = [
    { status: 'TODO' as const, tasks: todoTasks },
    { status: 'IN_PROGRESS' as const, tasks: inProgressTasks },
    { status: 'DONE' as const, tasks: doneTasks },
  ];

  const labels = columns.map(
    ({ status, tasks: colTasks }) =>
      `${COLUMN_LABELS[status]} (${colTasks.length})`,
  );

  return (
    <SwipeablePages labels={labels} pageKey="board">
      {columns.map(({ status, tasks: colTasks }) => (
        <TaskColumn
          key={status}
          status={status}
          tasks={colTasks}
          milestoneMap={milestoneMap}
          doneLabel={doneLabel}
        />
      ))}
    </SwipeablePages>
  );
}

// ---------------------------------------------------------------------------
// MilestonePage: a single milestone swimlane rendered as a full page
// ---------------------------------------------------------------------------

function MilestonePage({
  lane,
  milestoneMap,
  filterRecentDone,
  doneLabel,
}: {
  lane: SwimlaneData;
  milestoneMap: Map<string, string>;
  filterRecentDone?: boolean;
  doneLabel?: string;
}) {
  const activeTasks = lane.tasks.filter(
    (t) => t.status === 'TODO' || t.status === 'IN_PROGRESS' || t.status === 'DONE',
  );

  return (
    <ScrollView style={styles.pageScroll} nestedScrollEnabled>
      <View style={[styles.swimlane, lane.is_overdue && styles.swimlaneOverdue]}>
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
            <Text style={styles.countChipText}>{activeTasks.length}</Text>
          </View>
        </View>
      </View>

      {activeTasks.length === 0 ? (
        <Text style={styles.noTasks}>No tasks</Text>
      ) : (
        activeTasks.map((task) => (
          <TaskCard
            key={task.id}
            title={task.description}
            status={task.status}
            milestoneName={
              task.milestone_id && milestoneMap
                ? milestoneMap.get(task.milestone_id)
                : null
            }
            assignments={task.assignments}
          />
        ))
      )}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// PersonPage: a single person's tasks rendered as a full page
// ---------------------------------------------------------------------------

function PersonPage({
  row,
  milestoneMap,
  filterRecentDone,
  doneLabel,
}: {
  row: PersonRow;
  milestoneMap: Map<string, string>;
  filterRecentDone?: boolean;
  doneLabel?: string;
}) {
  const activeTasks = row.tasks.filter((t) => t.status !== 'CANCELLED');

  return (
    <ScrollView style={styles.pageScroll} nestedScrollEnabled>
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
          <Text style={styles.countChipText}>{activeTasks.length}</Text>
        </View>
      </View>

      {activeTasks.length === 0 ? (
        <Text style={styles.noTasks}>No tasks</Text>
      ) : (
        activeTasks.map((task) => (
          <TaskCard
            key={task.id}
            title={task.description}
            status={task.status}
            milestoneName={
              task.milestone_id && milestoneMap
                ? milestoneMap.get(task.milestone_id)
                : null
            }
            assignments={task.assignments}
          />
        ))
      )}
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
  initialViewMode = 'board',
  hideEmptyMilestones: hideEmptyMilestonesProp,
  onHideEmptyChange,
}: ProjectTaskBoardProps) {
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);
  const [hideEmptyMilestones, setHideEmptyMilestones] = useState(
    hideEmptyMilestonesProp ?? false,
  );

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
      return lane.tasks.some(
        (t) => t.status === 'IN_PROGRESS' || t.status === 'DONE',
      );
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
      rows.push({
        memberId,
        memberName: member.full_name,
        tasks: memberTasks,
      });
    }
    if (unassignedTasks.length > 0) {
      rows.push({
        memberId: null,
        memberName: 'Unassigned',
        tasks: unassignedTasks,
      });
    }
    return rows;
  }, [tasks]);

  const doneLabel = filterRecentDone ? 'Done (7d)' : undefined;

  // Milestone page labels for indicator
  const milestoneLabels = filteredSwimlanes.map((lane) => lane.name);

  // People page labels for indicator
  const peopleLabels = personRows.map((row) => row.memberName);

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
            <Text
              style={[
                styles.tabText,
                viewMode === mode && styles.tabTextActive,
              ]}
            >
              {mode === 'board'
                ? 'Board'
                : mode === 'milestones'
                  ? 'Milestones'
                  : 'People'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Board View */}
      {viewMode === 'board' && (
        <BoardSwipeable
          tasks={tasks}
          milestoneMap={milestoneMap}
          filterRecentDone={filterRecentDone}
          doneLabel={doneLabel}
        />
      )}

      {/* Milestones View */}
      {viewMode === 'milestones' && (
        <View>
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
              <Text style={styles.hiddenCount}>
                ({hiddenMilestoneCount} hidden)
              </Text>
            )}
          </View>
          {filteredSwimlanes.length === 0 ? (
            <Text style={styles.noTasks}>
              No milestones or tasks to display.
            </Text>
          ) : (
            <SwipeablePages
              labels={milestoneLabels.length <= 5 ? milestoneLabels : undefined}
              pageKey={`milestones-${filteredSwimlanes.length}`}
            >
              {filteredSwimlanes.map((lane) => (
                <MilestonePage
                  key={lane.id ?? '__none__'}
                  lane={lane}
                  milestoneMap={milestoneMap}
                  filterRecentDone={filterRecentDone}
                  doneLabel={doneLabel}
                />
              ))}
            </SwipeablePages>
          )}
        </View>
      )}

      {/* People View */}
      {viewMode === 'people' && (
        <View>
          {personRows.length === 0 ? (
            <Text style={styles.noTasks}>No tasks to display.</Text>
          ) : (
            <SwipeablePages
              labels={peopleLabels.length <= 5 ? peopleLabels : undefined}
              pageKey={`people-${personRows.length}`}
            >
              {personRows.map((row) => (
                <PersonPage
                  key={row.memberId ?? 'unassigned'}
                  row={row}
                  milestoneMap={milestoneMap}
                  filterRecentDone={filterRecentDone}
                  doneLabel={doneLabel}
                />
              ))}
            </SwipeablePages>
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

  // Page indicator
  indicatorContainer: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D0D0D0',
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  miniTabBar: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  miniTab: {
    flex: 1,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderRadius: borderRadius.chip,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
  },
  miniTabActive: {
    backgroundColor: colors.primary,
  },
  miniTabText: {
    fontSize: typography.sizes.caption,
    color: '#666',
    fontWeight: typography.weights.medium,
  },
  miniTabTextActive: {
    color: '#fff',
    fontWeight: typography.weights.semibold,
  },

  // Swipeable page content
  pageScroll: {
    flex: 1,
  },

  // Column (used in board pages)
  column: {
    borderRadius: borderRadius.card,
    padding: spacing.sm,
    minHeight: 150,
    margin: spacing.xs,
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

  // Toggle row (milestones)
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.sm,
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

  // Milestone swimlane header (inside a page)
  swimlane: {
    marginBottom: spacing.sm,
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

  // Person header (inside a page)
  personHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
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
