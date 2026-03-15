import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '@ehestudio-ops/shared';
import { TaskType } from '@ehestudio-ops/shared';
import { useAuth } from '../contexts/AuthContext';
import { api, ApiError } from '../lib/api';

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

const TASK_TYPE_LABELS: Record<string, string> = {
  ARCHITECTURE_ENGINEERING_DIRECTION: 'Arch & Eng Direction',
  DESIGN_DELIVERY_RESEARCH: 'Design & Research',
  DEVELOPMENT_TESTING: 'Dev & Testing',
  BUSINESS_SUPPORT: 'Business Support',
};

const TASK_TYPES = Object.values(TaskType);
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
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

// ---------------------------------------------------------------------------
// Tab type
// ---------------------------------------------------------------------------

type TabType = 'grid' | 'quick';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TimeLoggingScreen() {
  const { user } = useAuth();
  const teamMemberId = user?.team_member?.id ?? null;

  const [activeTab, setActiveTab] = useState<TabType>('grid');

  // Shared project list
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.get<Project[]>('/api/projects');
        setProjects(
          data
            .filter((p) => p.status !== 'ARCHIVED')
            .sort((a, b) => {
              const ca = a.client?.name ?? '';
              const cb = b.client?.name ?? '';
              const cmp = ca.localeCompare(cb);
              return cmp !== 0 ? cmp : a.name.localeCompare(b.name);
            }),
        );
      } catch {
        // silently fail
      } finally {
        setProjectsLoading(false);
      }
    })();
  }, []);

  // =====================================================================
  // WEEKLY GRID STATE
  // =====================================================================

  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [cells, setCells] = useState<Record<string, CellData>>({});
  const [gridEntriesLoading, setGridEntriesLoading] = useState(false);
  const [addPickerVisible, setAddPickerVisible] = useState(false);

  const fetchGridEntries = useCallback(async () => {
    if (!teamMemberId || selectedProjectIds.length === 0) {
      setCells({});
      return;
    }
    setGridEntriesLoading(true);

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
      setGridEntriesLoading(false);
    }
  }, [teamMemberId, selectedProjectIds, weekStart, weekDates]);

  useEffect(() => {
    void fetchGridEntries();
  }, [fetchGridEntries]);

  const handleAddProject = (projectId: string) => {
    if (selectedProjectIds.includes(projectId)) return;
    setSelectedProjectIds((prev) => [...prev, projectId]);
    setAddPickerVisible(false);
  };

  const handleRemoveProject = (projectId: string) => {
    setSelectedProjectIds((prev) => prev.filter((id) => id !== projectId));
  };

  const snapToHalf = (value: string): string => {
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) return '';
    const snapped = Math.max(0.5, Math.round(num * 2) / 2);
    return String(snapped);
  };

  const handleHoursChange = (ck: string, value: string) => {
    setCells((prev) => ({
      ...prev,
      [ck]: { ...prev[ck], hours: value },
    }));
  };

  const handleHoursStep = (ck: string, delta: number) => {
    setCells((prev) => {
      const cell = prev[ck];
      if (!cell) return prev;
      const current = parseFloat(cell.hours) || 0;
      const next = Math.max(0.5, Math.round((current + delta) * 2) / 2);
      return {
        ...prev,
        [ck]: { ...prev[ck], hours: String(next) },
      };
    });
  };

  const handleCellBlur = async (projectId: string, dateStr: string) => {
    if (!teamMemberId) return;
    const ck = cellKey(projectId, dateStr);
    const cell = cells[ck];
    if (!cell) return;

    // Snap to nearest 0.5
    const snapped = snapToHalf(cell.hours);
    if (snapped !== cell.hours) {
      setCells((prev) => ({
        ...prev,
        [ck]: { ...prev[ck], hours: snapped },
      }));
    }

    const hoursNum = parseFloat(snapped);
    if (!snapped || isNaN(hoursNum) || hoursNum <= 0) return;

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
    projects.forEach((p) => m.set(p.id, p));
    return m;
  }, [projects]);

  const gridAvailableProjects = projects.filter((p) => !selectedProjectIds.includes(p.id));

  const weekLabel = `Week of ${formatShort(weekStart)}`;

  const [jumpDateText, setJumpDateText] = useState('');
  const [jumpDateVisible, setJumpDateVisible] = useState(false);

  const handleJumpToDate = () => {
    const match = jumpDateText.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const picked = new Date(
        parseInt(match[1], 10),
        parseInt(match[2], 10) - 1,
        parseInt(match[3], 10),
      );
      if (!isNaN(picked.getTime())) {
        setWeekStart(getWeekStart(picked));
        setJumpDateVisible(false);
        setJumpDateText('');
      }
    }
  };

  // =====================================================================
  // QUICK ENTRY STATE
  // =====================================================================

  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectPickerVisible, setProjectPickerVisible] = useState(false);

  const [date, setDate] = useState(todayISO());
  const [hours, setHours] = useState('');
  const [taskType, setTaskType] = useState<string>(TASK_TYPES[0]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);

  const fetchQuickEntries = useCallback(async () => {
    if (!selectedProject || !teamMemberId) return;
    setEntriesLoading(true);
    try {
      const data = await api.get<TimeEntry[]>(
        `/api/time-entries?project_id=${selectedProject.id}&team_member_id=${teamMemberId}`,
      );
      setEntries(data);
    } catch {
      setEntries([]);
    } finally {
      setEntriesLoading(false);
    }
  }, [selectedProject, teamMemberId]);

  useEffect(() => {
    void fetchQuickEntries();
  }, [fetchQuickEntries]);

  const handleSubmit = async () => {
    if (!selectedProject || !teamMemberId || !hours || !taskType) return;

    setSubmitting(true);
    try {
      await api.post('/api/time-entries', {
        project_id: selectedProject.id,
        team_member_id: teamMemberId,
        date,
        hours_worked: parseFloat(hours),
        task_type: taskType,
        notes: notes.trim() || undefined,
      });
      Alert.alert('Success', 'Time entry logged successfully.');
      setHours('');
      setNotes('');
      void fetchQuickEntries();
    } catch (err) {
      Alert.alert(
        'Error',
        err instanceof ApiError ? err.message : 'Something went wrong. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const quickProjectLabel = selectedProject
    ? selectedProject.client
      ? `${selectedProject.client.name} - ${selectedProject.name}`
      : selectedProject.name
    : 'Select project';

  const projectTotal = entries.reduce((sum, e) => sum + parseFloat(String(e.hours_worked)), 0);

  // =====================================================================
  // RENDER
  // =====================================================================

  return (
    <View style={styles.container}>
      {/* Tab Switcher */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'grid' && styles.tabActive]}
          onPress={() => setActiveTab('grid')}
        >
          <Text style={[styles.tabText, activeTab === 'grid' && styles.tabTextActive]}>
            Weekly Grid
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'quick' && styles.tabActive]}
          onPress={() => setActiveTab('quick')}
        >
          <Text style={[styles.tabText, activeTab === 'quick' && styles.tabTextActive]}>
            Quick Entry
          </Text>
        </TouchableOpacity>
      </View>

      {/* ============================================================= */}
      {/* WEEKLY GRID TAB                                                 */}
      {/* ============================================================= */}
      {activeTab === 'grid' && (
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
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
            <TouchableOpacity
              style={styles.todayButton}
              onPress={() => setJumpDateVisible(!jumpDateVisible)}
            >
              <Ionicons name="calendar-outline" size={16} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Jump to date input */}
          {jumpDateVisible && (
            <View style={styles.jumpDateRow}>
              <TextInput
                style={styles.jumpDateInput}
                value={jumpDateText}
                onChangeText={setJumpDateText}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#999"
                keyboardType="numbers-and-punctuation"
                returnKeyType="go"
                onSubmitEditing={handleJumpToDate}
              />
              <TouchableOpacity
                style={[
                  styles.jumpDateGoButton,
                  !jumpDateText.match(/^\d{4}-\d{2}-\d{2}$/) && styles.buttonDisabled,
                ]}
                onPress={handleJumpToDate}
                disabled={!jumpDateText.match(/^\d{4}-\d{2}-\d{2}$/)}
              >
                <Text style={styles.jumpDateGoText}>Go</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Add Project */}
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setAddPickerVisible(true)}
            disabled={projectsLoading || gridAvailableProjects.length === 0}
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
                {gridAvailableProjects.map((p) => (
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
          {gridEntriesLoading ? (
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
                            <View style={styles.stepperRow}>
                              <TouchableOpacity
                                style={styles.stepperButton}
                                onPress={() => {
                                  handleHoursStep(ck, -0.5);
                                  void handleCellBlur(pid, ds);
                                }}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              >
                                <Ionicons name="remove" size={14} color={colors.text} />
                              </TouchableOpacity>
                              <TextInput
                                style={styles.hourInput}
                                value={cell?.hours ?? ''}
                                onChangeText={(v) => handleHoursChange(ck, v)}
                                onBlur={() => void handleCellBlur(pid, ds)}
                                keyboardType="decimal-pad"
                                placeholder="-"
                                placeholderTextColor="#ccc"
                              />
                              <TouchableOpacity
                                style={styles.stepperButton}
                                onPress={() => {
                                  handleHoursStep(ck, 0.5);
                                  void handleCellBlur(pid, ds);
                                }}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              >
                                <Ionicons name="add" size={14} color={colors.text} />
                              </TouchableOpacity>
                            </View>
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
      )}

      {/* ============================================================= */}
      {/* QUICK ENTRY TAB                                                 */}
      {/* ============================================================= */}
      {activeTab === 'quick' && (
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Project Selector */}
          {projectsLoading ? (
            <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />
          ) : (
            <TouchableOpacity style={styles.picker} onPress={() => setProjectPickerVisible(true)}>
              <Text style={[styles.pickerText, !selectedProject && styles.pickerPlaceholder]}>
                {quickProjectLabel}
              </Text>
            </TouchableOpacity>
          )}

          {/* Project Picker Modal */}
          <Modal visible={projectPickerVisible} animationType="slide" presentationStyle="pageSheet">
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Project</Text>
                <TouchableOpacity onPress={() => setProjectPickerVisible(false)}>
                  <Text style={styles.modalClose}>Done</Text>
                </TouchableOpacity>
              </View>
              <ScrollView>
                {projects.map((p) => {
                  const label = p.client ? `${p.client.name} - ${p.name}` : p.name;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[
                        styles.modalItem,
                        selectedProject?.id === p.id && styles.modalItemSelected,
                      ]}
                      onPress={() => {
                        setSelectedProject(p);
                        setProjectPickerVisible(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.modalItemText,
                          selectedProject?.id === p.id && styles.modalItemTextSelected,
                        ]}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </Modal>

          {/* Entry Form */}
          {selectedProject && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Log Time</Text>

              <Text style={styles.fieldLabel}>Date</Text>
              <TextInput
                style={styles.input}
                value={date}
                onChangeText={setDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#999"
              />

              <Text style={styles.fieldLabel}>Hours</Text>
              <View style={styles.quickHoursStepper}>
                <TouchableOpacity
                  style={styles.quickStepperButton}
                  onPress={() => {
                    const current = parseFloat(hours) || 0;
                    const next = Math.max(0.5, Math.round((current - 0.5) * 2) / 2);
                    setHours(String(next));
                  }}
                >
                  <Ionicons name="remove" size={20} color={colors.text} />
                </TouchableOpacity>
                <TextInput
                  style={styles.quickHoursInput}
                  value={hours}
                  onChangeText={setHours}
                  onBlur={() => {
                    const snapped = snapToHalf(hours);
                    if (snapped !== hours) setHours(snapped);
                  }}
                  placeholder="e.g. 2.5"
                  placeholderTextColor="#999"
                  keyboardType="decimal-pad"
                />
                <TouchableOpacity
                  style={styles.quickStepperButton}
                  onPress={() => {
                    const current = parseFloat(hours) || 0;
                    const next = Math.max(0.5, Math.round((current + 0.5) * 2) / 2);
                    setHours(String(next));
                  }}
                >
                  <Ionicons name="add" size={20} color={colors.text} />
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Task Type</Text>
              <View style={styles.taskTypeRow}>
                {TASK_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.taskTypeChip, taskType === t && styles.taskTypeChipActive]}
                    onPress={() => setTaskType(t)}
                  >
                    <Text
                      style={[styles.taskTypeText, taskType === t && styles.taskTypeTextActive]}
                    >
                      {TASK_TYPE_LABELS[t] ?? t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Notes (optional)</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Add notes..."
                placeholderTextColor="#999"
                multiline
              />

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  (submitting || !hours || !taskType) && styles.buttonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={submitting || !hours || !taskType}
              >
                <Text style={styles.submitText}>{submitting ? 'Logging...' : 'Log Entry'}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Entries List */}
          {selectedProject && (
            <View style={styles.card}>
              <View style={styles.entriesHeader}>
                <Text style={styles.cardTitle}>Entries</Text>
                <Text style={styles.totalBadge}>{projectTotal.toFixed(1)}h total</Text>
              </View>

              {entriesLoading ? (
                <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />
              ) : entries.length === 0 ? (
                <Text style={styles.emptyText}>No entries yet for this project.</Text>
              ) : (
                entries.slice(0, 20).map((entry) => (
                  <View key={entry.id} style={styles.entryRow}>
                    <Text style={styles.entryHours}>
                      {parseFloat(String(entry.hours_worked)).toFixed(1)}h
                    </Text>
                    <View style={styles.entryContent}>
                      <Text style={styles.entryTaskType}>
                        {TASK_TYPE_LABELS[entry.task_type] ?? entry.task_type}
                      </Text>
                      <Text style={styles.entryDate}>
                        {new Date(entry.date).toLocaleDateString('en-GB', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                        })}
                      </Text>
                      {entry.notes && <Text style={styles.entryNotes}>{entry.notes}</Text>}
                    </View>
                  </View>
                ))
              )}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scrollContainer: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: typography.sizes.body1,
    fontWeight: typography.weights.medium,
    color: '#999',
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },

  // Weekly Grid styles
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
  jumpDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  jumpDateInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: borderRadius.input,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    fontSize: typography.sizes.body2,
    color: colors.text,
  },
  jumpDateGoButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.button,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  jumpDateGoText: {
    color: '#fff',
    fontSize: typography.sizes.body2,
    fontWeight: typography.weights.semibold,
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
    width: 90,
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
    width: 90,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  stepperButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  hourInput: {
    width: 40,
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
    width: 90,
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

  // Quick Entry styles
  loader: {
    paddingVertical: spacing.lg,
  },
  picker: {
    backgroundColor: '#fff',
    borderRadius: borderRadius.input,
    borderWidth: 1,
    borderColor: colors.divider,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    marginBottom: spacing.md,
  },
  pickerText: {
    fontSize: typography.sizes.body1,
    color: colors.text,
  },
  pickerPlaceholder: {
    color: '#999',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: borderRadius.card,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardTitle: {
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
  },
  input: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: borderRadius.input,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: typography.sizes.body1,
    color: colors.text,
    marginBottom: spacing.md,
  },
  multilineInput: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  quickHoursStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  quickStepperButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  quickHoursInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: borderRadius.input,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: typography.sizes.body1,
    color: colors.text,
    textAlign: 'center',
  },
  taskTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  taskTypeChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.chip,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  taskTypeChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  taskTypeText: {
    fontSize: typography.sizes.caption,
    color: '#666',
  },
  taskTypeTextActive: {
    color: '#fff',
    fontWeight: typography.weights.semibold,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.button,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  submitText: {
    color: '#fff',
    fontSize: typography.sizes.body1,
    fontWeight: typography.weights.semibold,
  },
  entriesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalBadge: {
    fontSize: typography.sizes.caption,
    color: colors.secondary,
    fontWeight: typography.weights.semibold,
  },
  emptyText: {
    fontSize: typography.sizes.body2,
    color: '#999',
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  entryRow: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  entryHours: {
    fontSize: typography.sizes.body2,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    minWidth: 42,
  },
  entryContent: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  entryTaskType: {
    fontSize: typography.sizes.body2,
    fontWeight: typography.weights.medium,
    color: colors.text,
  },
  entryDate: {
    fontSize: typography.sizes.caption,
    color: '#666',
    marginTop: 2,
  },
  entryNotes: {
    fontSize: typography.sizes.body2,
    color: '#666',
    marginTop: 2,
  },

  // Shared modals
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
  modalItemSelected: {
    backgroundColor: colors.primary + '10',
  },
  modalItemText: {
    fontSize: typography.sizes.body1,
    color: colors.text,
  },
  modalItemTextSelected: {
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
});
