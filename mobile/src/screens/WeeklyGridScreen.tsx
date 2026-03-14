import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '@ehestudio-ops/shared';
import { TaskType } from '@ehestudio-ops/shared';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';

interface Project {
  id: string;
  name: string;
  status: string;
  client: { id: string; name: string } | null;
}

interface TimeEntry {
  id: string;
  project_id: string;
  team_member_id: string;
  date: string;
  hours_worked: string | number;
  task_type: string;
  notes: string | null;
}

interface CellData {
  hours: string;
  taskType: string;
  entryId: string | null;
  saving: boolean;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TASK_TYPES = Object.values(TaskType);

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatShort(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function cellKey(projectId: string, dateStr: string): string {
  return `${projectId}::${dateStr}`;
}

export default function WeeklyGridScreen() {
  const { user } = useAuth();
  const teamMemberId = user?.team_member?.id ?? null;

  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [cells, setCells] = useState<Record<string, CellData>>({});
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [addPickerVisible, setAddPickerVisible] = useState(false);

  // Fetch projects
  useEffect(() => {
    (async () => {
      try {
        const data = await api.get<Project[]>('/api/projects');
        setAllProjects(data);
      } catch {
        // silently fail
      } finally {
        setProjectsLoading(false);
      }
    })();
  }, []);

  // Fetch entries for the week
  const fetchEntries = useCallback(async () => {
    if (!teamMemberId || selectedProjectIds.length === 0) {
      setCells({});
      return;
    }
    setEntriesLoading(true);

    const startDate = formatDate(weekStart);
    const endDate = formatDate(addDays(weekStart, 6));

    try {
      const data = await api.get<TimeEntry[]>(
        `/api/time-entries?team_member_id=${teamMemberId}&start_date=${startDate}&end_date=${endDate}`,
      );

      const newCells: Record<string, CellData> = {};
      for (const pid of selectedProjectIds) {
        for (const d of weekDates) {
          const dk = formatDate(d);
          const ck = cellKey(pid, dk);
          newCells[ck] = {
            hours: '',
            taskType: TASK_TYPES[0],
            entryId: null,
            saving: false,
          };
        }
      }
      for (const entry of data) {
        const dk = entry.date.slice(0, 10);
        const ck = cellKey(entry.project_id, dk);
        if (ck in newCells) {
          newCells[ck] = {
            hours: String(parseFloat(String(entry.hours_worked))),
            taskType: entry.task_type,
            entryId: entry.id,
            saving: false,
          };
        }
      }
      setCells(newCells);
    } catch {
      Alert.alert('Error', 'Failed to load time entries for this week.');
    } finally {
      setEntriesLoading(false);
    }
  }, [teamMemberId, selectedProjectIds, weekStart, weekDates]);

  useEffect(() => {
    void fetchEntries();
  }, [fetchEntries]);

  const handleAddProject = (projectId: string) => {
    if (selectedProjectIds.includes(projectId)) return;
    setSelectedProjectIds((prev) => [...prev, projectId]);
    setAddPickerVisible(false);
  };

  const handleRemoveProject = (projectId: string) => {
    setSelectedProjectIds((prev) => prev.filter((id) => id !== projectId));
  };

  const handleHoursChange = (ck: string, value: string) => {
    setCells((prev) => ({
      ...prev,
      [ck]: { ...prev[ck], hours: value },
    }));
  };

  const handleCellBlur = async (projectId: string, dateStr: string) => {
    if (!teamMemberId) return;
    const ck = cellKey(projectId, dateStr);
    const cell = cells[ck];
    if (!cell) return;

    const hoursNum = parseFloat(cell.hours);
    if (!cell.hours || isNaN(hoursNum) || hoursNum <= 0) return;

    setCells((prev) => ({
      ...prev,
      [ck]: { ...prev[ck], saving: true },
    }));

    try {
      if (cell.entryId) {
        await api.put(`/api/time-entries/${cell.entryId}`, {
          hours_worked: hoursNum,
          task_type: cell.taskType,
        });
      } else {
        const created = await api.post<TimeEntry>('/api/time-entries', {
          project_id: projectId,
          team_member_id: teamMemberId,
          date: dateStr,
          hours_worked: hoursNum,
          task_type: cell.taskType,
        });
        setCells((prev) => ({
          ...prev,
          [ck]: { ...prev[ck], entryId: created.id, saving: false },
        }));
        return;
      }
    } catch {
      Alert.alert('Error', 'Failed to save entry.');
    }

    setCells((prev) => ({
      ...prev,
      [ck]: { ...prev[ck], saving: false },
    }));
  };

  const computeRowTotal = (projectId: string): number => {
    let total = 0;
    for (const d of weekDates) {
      const ck = cellKey(projectId, formatDate(d));
      const val = parseFloat(cells[ck]?.hours ?? '');
      if (!isNaN(val)) total += val;
    }
    return total;
  };

  const computeDayTotal = (dateStr: string): number => {
    let total = 0;
    for (const pid of selectedProjectIds) {
      const ck = cellKey(pid, dateStr);
      const val = parseFloat(cells[ck]?.hours ?? '');
      if (!isNaN(val)) total += val;
    }
    return total;
  };

  const grandTotal = selectedProjectIds.reduce((sum, pid) => sum + computeRowTotal(pid), 0);

  const projectMap = useMemo(() => {
    const m = new Map<string, Project>();
    allProjects.forEach((p) => m.set(p.id, p));
    return m;
  }, [allProjects]);

  const availableProjects = allProjects.filter(
    (p) => p.status !== 'ARCHIVED' && !selectedProjectIds.includes(p.id),
  );

  const weekLabel = `Week of ${formatShort(weekStart)}`;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Weekly Grid</Text>
      <Text style={styles.subtitle}>Batch-log your time for the week.</Text>

      {/* Week Navigation */}
      <View style={styles.weekNav}>
        <TouchableOpacity onPress={() => setWeekStart(addDays(weekStart, -7))}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.weekLabel}>{weekLabel}</Text>
        <TouchableOpacity onPress={() => setWeekStart(addDays(weekStart, 7))}>
          <Ionicons name="chevron-forward" size={24} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.todayButton}
          onPress={() => setWeekStart(getWeekStart(new Date()))}
        >
          <Text style={styles.todayText}>This Week</Text>
        </TouchableOpacity>
      </View>

      {/* Add Project */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setAddPickerVisible(true)}
        disabled={projectsLoading || availableProjects.length === 0}
      >
        <Text style={styles.addButtonText}>+ Add Project</Text>
      </TouchableOpacity>

      {/* Project Picker Modal */}
      <Modal visible={addPickerVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Project</Text>
            <TouchableOpacity onPress={() => setAddPickerVisible(false)}>
              <Text style={styles.modalClose}>Done</Text>
            </TouchableOpacity>
          </View>
          <ScrollView>
            {availableProjects
              .sort((a, b) => {
                const ca = a.client?.name ?? '';
                const cb = b.client?.name ?? '';
                const cmp = ca.localeCompare(cb);
                return cmp !== 0 ? cmp : a.name.localeCompare(b.name);
              })
              .map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={styles.modalItem}
                  onPress={() => handleAddProject(p.id)}
                >
                  <Text style={styles.modalItemText}>
                    {p.client ? `${p.client.name} - ${p.name}` : p.name}
                  </Text>
                </TouchableOpacity>
              ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Grid */}
      {entriesLoading ? (
        <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />
      ) : selectedProjectIds.length === 0 ? (
        <Text style={styles.emptyText}>Add a project above to start logging time.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View>
            {/* Header Row */}
            <View style={styles.gridRow}>
              <View style={styles.projectCell}>
                <Text style={styles.headerText}>Project</Text>
              </View>
              {weekDates.map((d, i) => (
                <View key={formatDate(d)} style={styles.dayCell}>
                  <Text style={styles.dayLabel}>{DAY_LABELS[i]}</Text>
                  <Text style={styles.dateLabel}>{formatShort(d)}</Text>
                </View>
              ))}
              <View style={styles.totalCell}>
                <Text style={styles.headerText}>Total</Text>
              </View>
            </View>

            {/* Project Rows */}
            {selectedProjectIds.map((pid) => {
              const project = projectMap.get(pid);
              const projectLabel = project
                ? project.client
                  ? `${project.client.name} - ${project.name}`
                  : project.name
                : pid;
              const rowTotal = computeRowTotal(pid);

              return (
                <View key={pid} style={styles.gridRow}>
                  <View style={styles.projectCell}>
                    <Text style={styles.projectLabel} numberOfLines={2}>
                      {projectLabel}
                    </Text>
                    <TouchableOpacity onPress={() => handleRemoveProject(pid)}>
                      <Ionicons name="close-circle-outline" size={18} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                  {weekDates.map((d) => {
                    const ds = formatDate(d);
                    const ck = cellKey(pid, ds);
                    const cell = cells[ck];
                    return (
                      <View key={ds} style={styles.inputCell}>
                        <TextInput
                          style={styles.hourInput}
                          value={cell?.hours ?? ''}
                          onChangeText={(v) => handleHoursChange(ck, v)}
                          onBlur={() => void handleCellBlur(pid, ds)}
                          keyboardType="decimal-pad"
                          placeholder="-"
                          placeholderTextColor="#ccc"
                        />
                        {cell?.saving && (
                          <ActivityIndicator
                            size="small"
                            color={colors.primary}
                            style={styles.cellLoader}
                          />
                        )}
                      </View>
                    );
                  })}
                  <View style={styles.totalCell}>
                    <Text style={styles.totalValue}>
                      {rowTotal > 0 ? rowTotal.toFixed(1) : '-'}
                    </Text>
                  </View>
                </View>
              );
            })}

            {/* Footer Row */}
            <View style={styles.gridRow}>
              <View style={styles.projectCell}>
                <Text style={styles.footerLabel}>Daily Total</Text>
              </View>
              {weekDates.map((d) => {
                const ds = formatDate(d);
                const dt = computeDayTotal(ds);
                return (
                  <View key={ds} style={styles.totalCell}>
                    <Text style={styles.totalValue}>{dt > 0 ? dt.toFixed(1) : '-'}</Text>
                  </View>
                );
              })}
              <View style={styles.totalCell}>
                <Text style={styles.grandTotal}>
                  {grandTotal > 0 ? grandTotal.toFixed(1) : '-'}
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
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
  title: {
    fontSize: typography.sizes.h3,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.sizes.body2,
    color: '#666',
    marginBottom: spacing.lg,
  },
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  weekLabel: {
    fontSize: typography.sizes.h4,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  todayButton: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: borderRadius.button,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    marginLeft: spacing.sm,
  },
  todayText: {
    fontSize: typography.sizes.caption,
    color: colors.text,
  },
  addButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.button,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  addButtonText: {
    fontSize: typography.sizes.body2,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  loader: {
    paddingVertical: spacing.xl,
  },
  emptyText: {
    fontSize: typography.sizes.body2,
    color: '#999',
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  gridRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  projectCell: {
    width: 140,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  projectLabel: {
    flex: 1,
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.medium,
    color: colors.text,
  },
  headerText: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  dayCell: {
    width: 70,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  dayLabel: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  dateLabel: {
    fontSize: 10,
    color: '#999',
  },
  inputCell: {
    width: 70,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
  hourInput: {
    width: 56,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 4,
    textAlign: 'center',
    paddingVertical: 4,
    fontSize: typography.sizes.body2,
    color: colors.text,
  },
  cellLoader: {
    position: 'absolute',
    bottom: 0,
  },
  totalCell: {
    width: 70,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  totalValue: {
    fontSize: typography.sizes.body2,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  footerLabel: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  grandTotal: {
    fontSize: typography.sizes.body1,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  modalTitle: {
    fontSize: typography.sizes.h4,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  modalClose: {
    fontSize: typography.sizes.body1,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  modalItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalItemText: {
    fontSize: typography.sizes.body1,
    color: colors.text,
  },
});
